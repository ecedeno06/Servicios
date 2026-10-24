const { pool } = require('../config/db');

const ORDEN_ESTADOS = ['en_construccion', 'en_revision', 'aprobada', 'cerrada'];

const SELECT_BASE = `
  select
    c.*,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre,
    (select count(*)::int from carrito_detalles d where d.carrito_id = c.id) as detalles_count,
    (select coalesce(sum(d.cantidad_propuesta), 0)::int from carrito_detalles d where d.carrito_id = c.id) as cantidad_propuesta_total,
    (select coalesce(sum(d.cantidad_aprobada), 0)::int from carrito_detalles d where d.carrito_id = c.id) as cantidad_aprobada_total
  from carritos c
  join usuarios uc on uc.id = c.creado_por
  left join usuarios um on um.id = c.modificado_por
`;

const SELECT_DETALLE = `
  select
    d.*,
    p.nombre as producto_nombre,
    p.categoria_id as categoria_id,
    cat.nombre as categoria_nombre,
    pr.nombre as proveedor_nombre,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre
  from carrito_detalles d
  join productos p on p.id = d.producto_id
  left join categorias cat on cat.id = p.categoria_id
  left join proveedores pr on pr.id = d.proveedor_id
  join usuarios uc on uc.id = d.creado_por
  left join usuarios um on um.id = d.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where c.empresa_id = $1 order by c.created_at desc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where c.id = $1 and c.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const { rows: detalles } = await pool.query(
      `${SELECT_DETALLE} where d.carrito_id = $1 order by d.created_at asc`,
      [req.params.id]
    );

    res.json({ ...rows[0], detalles });
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { titulo, fecha_solicitud } = req.body;
    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ mensaje: 'El titulo es requerido' });
    }

    const { rows } = await pool.query(
      `insert into carritos (empresa_id, titulo, fecha_solicitud, creado_por)
       values ($1, $2, coalesce($3, current_date), $4)
       returning id`,
      [req.empresaId, titulo.trim(), fecha_solicitud || null, req.usuario.id]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { titulo, fecha_solicitud } = req.body;
    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ mensaje: 'El titulo es requerido' });
    }

    const { rows: actual } = await pool.query(
      'select estado from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    if (actual[0].estado !== 'en_construccion') {
      return res.status(400).json({ mensaje: 'Solo se puede editar un carrito mientras esta "En Construccion"' });
    }

    await pool.query(
      `update carritos set titulo = $1, fecha_solicitud = coalesce($2, fecha_solicitud), modificado_por = $3
       where id = $4 and empresa_id = $5`,
      [titulo.trim(), fecha_solicitud || null, req.usuario.id, req.params.id, req.empresaId]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [req.params.id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    res.json({ ok: true, mensaje: 'Carrito eliminado correctamente' });
  } catch (err) { next(err); }
}

// POST /:id/avanzar  { estado }
// El frontend solo ofrece un boton con el UNICO siguiente estado valido,
// pero igual se revalida aqui contra el estado actual en BD -- asi
// saltarse pasos queda estructuralmente imposible, no solo validado.
async function avanzarEstado(req, res, next) {
  try {
    const { rows: actual } = await pool.query(
      'select estado from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const idxActual = ORDEN_ESTADOS.indexOf(actual[0].estado);
    const siguiente = ORDEN_ESTADOS[idxActual + 1];
    if (!siguiente) return res.status(400).json({ mensaje: 'El carrito ya esta en su ultimo estado' });
    if (req.body.estado !== siguiente) {
      return res.status(400).json({ mensaje: `Solo se puede avanzar a "${siguiente}" desde el estado actual` });
    }

    const esAprobacion = siguiente === 'aprobada';
    const { rows } = await pool.query(
      `update carritos set
         estado = $1,
         fecha_aprobacion = case when $2 then coalesce(fecha_aprobacion, current_date) else fecha_aprobacion end,
         modificado_por = $3
       where id = $4 and empresa_id = $5
       returning id`,
      [siguiente, esAprobacion, req.usuario.id, req.params.id, req.empresaId]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [rows[0].id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

// POST /:id/retroceder  { estado }
// Permite corregir un avance equivocado, salvo la transicion final: una
// vez "cerrada" el carrito queda bloqueado para siempre (ver
// ORDEN_ESTADOS -- no hay "anterior" valido desde el ultimo estado).
async function retrocederEstado(req, res, next) {
  try {
    const { rows: actual } = await pool.query(
      'select estado from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    if (actual[0].estado === 'cerrada') {
      return res.status(400).json({ mensaje: 'Un carrito "Cerrado" no se puede reabrir' });
    }

    const idxActual = ORDEN_ESTADOS.indexOf(actual[0].estado);
    const anterior = ORDEN_ESTADOS[idxActual - 1];
    if (!anterior) return res.status(400).json({ mensaje: 'El carrito ya esta en su primer estado' });
    if (req.body.estado !== anterior) {
      return res.status(400).json({ mensaje: `Solo se puede devolver a "${anterior}" desde el estado actual` });
    }

    // Al devolver desde "aprobada" se limpia fecha_aprobacion -- si mas
    // adelante se vuelve a aprobar, debe quedar la fecha de ESA
    // aprobacion, no la de un intento anterior que se corrigio.
    const limpiarFechaAprobacion = actual[0].estado === 'aprobada';
    const { rows } = await pool.query(
      `update carritos set
         estado = $1,
         fecha_aprobacion = case when $2 then null else fecha_aprobacion end,
         modificado_por = $3
       where id = $4 and empresa_id = $5
       returning id`,
      [anterior, limpiarFechaAprobacion, req.usuario.id, req.params.id, req.empresaId]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [rows[0].id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// DETALLES (lineas de equipos a comprar)
// -------------------------------------------------------------

async function verificarCarrito(req) {
  const { rows } = await pool.query(
    'select id, estado from carritos where id = $1 and empresa_id = $2',
    [req.params.id, req.empresaId]
  );
  return rows[0] || null;
}

async function listarDetalles(req, res, next) {
  try {
    if (!(await verificarCarrito(req))) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const { rows } = await pool.query(
      `${SELECT_DETALLE} where d.carrito_id = $1 order by d.created_at asc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearDetalle(req, res, next) {
  try {
    const carrito = await verificarCarrito(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    if (carrito.estado !== 'en_construccion') {
      return res.status(400).json({ mensaje: 'Solo se pueden agregar lineas mientras el carrito esta "En Construccion"' });
    }

    const { producto_id, marca, modelo, url, proveedor_id, cantidad_propuesta, costo_estimado, observacion } = req.body;
    if (!producto_id || !marca || !marca.trim() || !modelo || !modelo.trim()) {
      return res.status(400).json({ mensaje: 'producto_id, marca y modelo son requeridos' });
    }
    if (!cantidad_propuesta || Number(cantidad_propuesta) <= 0) {
      return res.status(400).json({ mensaje: 'La cantidad propuesta debe ser mayor a cero' });
    }
    if (costo_estimado !== undefined && costo_estimado !== null && Number(costo_estimado) < 0) {
      return res.status(400).json({ mensaje: 'El costo estimado no puede ser negativo' });
    }

    const { rows: prod } = await pool.query('select id from productos where id = $1', [producto_id]);
    if (!prod[0]) return res.status(400).json({ mensaje: 'El producto seleccionado no existe' });

    if (proveedor_id) {
      const { rows: prov } = await pool.query(
        'select id from proveedores where id = $1 and empresa_id = $2',
        [proveedor_id, req.empresaId]
      );
      if (!prov[0]) return res.status(400).json({ mensaje: 'El proveedor seleccionado no existe o no pertenece a la empresa' });
    }

    const { rows } = await pool.query(
      `insert into carrito_detalles
         (carrito_id, producto_id, marca, modelo, url, proveedor_id, cantidad_propuesta, costo_estimado, observacion, creado_por)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        req.params.id,
        producto_id,
        marca.trim(),
        modelo.trim(),
        url ? url.trim() : null,
        proveedor_id || null,
        cantidad_propuesta,
        costo_estimado ?? null,
        observacion ? observacion.trim() : null,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_DETALLE} where d.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarDetalle(req, res, next) {
  try {
    const carrito = await verificarCarrito(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const { rows: det } = await pool.query(
      'select id from carrito_detalles where id = $1 and carrito_id = $2',
      [req.params.detalleId, req.params.id]
    );
    if (!det[0]) return res.status(404).json({ mensaje: 'Linea no encontrada' });

    if (carrito.estado === 'en_construccion') {
      const { producto_id, marca, modelo, url, proveedor_id, cantidad_propuesta, costo_estimado, observacion } = req.body;
      if (!producto_id || !marca || !marca.trim() || !modelo || !modelo.trim()) {
        return res.status(400).json({ mensaje: 'producto_id, marca y modelo son requeridos' });
      }
      if (!cantidad_propuesta || Number(cantidad_propuesta) <= 0) {
        return res.status(400).json({ mensaje: 'La cantidad propuesta debe ser mayor a cero' });
      }
      if (costo_estimado !== undefined && costo_estimado !== null && Number(costo_estimado) < 0) {
        return res.status(400).json({ mensaje: 'El costo estimado no puede ser negativo' });
      }

      const { rows: prod } = await pool.query('select id from productos where id = $1', [producto_id]);
      if (!prod[0]) return res.status(400).json({ mensaje: 'El producto seleccionado no existe' });

      if (proveedor_id) {
        const { rows: prov } = await pool.query(
          'select id from proveedores where id = $1 and empresa_id = $2',
          [proveedor_id, req.empresaId]
        );
        if (!prov[0]) return res.status(400).json({ mensaje: 'El proveedor seleccionado no existe o no pertenece a la empresa' });
      }

      await pool.query(
        `update carrito_detalles set
           producto_id = $1, marca = $2, modelo = $3, url = $4, proveedor_id = $5,
           cantidad_propuesta = $6, costo_estimado = $7, observacion = $8, modificado_por = $9
         where id = $10`,
        [
          producto_id,
          marca.trim(),
          modelo.trim(),
          url ? url.trim() : null,
          proveedor_id || null,
          cantidad_propuesta,
          costo_estimado ?? null,
          observacion ? observacion.trim() : null,
          req.usuario.id,
          req.params.detalleId,
        ]
      );
    } else if (carrito.estado === 'en_revision') {
      // En revision solo se carga la cantidad aprobada y se puede ajustar
      // la observacion -- el resto de la linea (que es lo que se pidio
      // comprar) ya quedo fijo al salir de "en_construccion".
      const { cantidad_aprobada, observacion } = req.body;
      if (cantidad_aprobada !== undefined && cantidad_aprobada !== null && Number(cantidad_aprobada) < 0) {
        return res.status(400).json({ mensaje: 'La cantidad aprobada no puede ser negativa' });
      }

      await pool.query(
        `update carrito_detalles set
           cantidad_aprobada = $1, observacion = $2, modificado_por = $3
         where id = $4`,
        [
          cantidad_aprobada ?? null,
          observacion !== undefined ? (observacion ? observacion.trim() : null) : null,
          req.usuario.id,
          req.params.detalleId,
        ]
      );
    } else {
      return res.status(400).json({ mensaje: 'Las lineas de un carrito "Aprobado" o "Cerrado" no se pueden editar' });
    }

    const { rows: completo } = await pool.query(`${SELECT_DETALLE} where d.id = $1`, [req.params.detalleId]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarDetalle(req, res, next) {
  try {
    const carrito = await verificarCarrito(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    if (carrito.estado !== 'en_construccion') {
      return res.status(400).json({ mensaje: 'Solo se pueden eliminar lineas mientras el carrito esta "En Construccion"' });
    }

    const { rowCount } = await pool.query(
      'delete from carrito_detalles where id = $1 and carrito_id = $2',
      [req.params.detalleId, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Linea no encontrada' });
    res.json({ ok: true, mensaje: 'Linea eliminada correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  avanzarEstado,
  retrocederEstado,
  listarDetalles,
  crearDetalle,
  actualizarDetalle,
  eliminarDetalle,
};
