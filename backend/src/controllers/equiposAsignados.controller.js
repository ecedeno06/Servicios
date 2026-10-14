const { pool } = require('../config/db');

const MAX_ADJUNTOS = 20;
const MAX_IMAGEN_BASE64_CHARS = 4 * 1024 * 1024; // ~4MB de texto base64 (~3MB de archivo real)
const IMAGEN_BASE64_PREFIJO = /^data:(image\/png|image\/jpeg|application\/pdf);base64,/;

const SELECT_BASE = `
  select
    ea.*,
    p.nombre as producto_nombre,
    c.nombre as categoria_nombre,
    pr.nombre as procesador_nombre,
    prov.nombre as proveedor_nombre,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre
  from equipos_asignados ea
  join productos p on p.id = ea.producto_id
  join categorias c on c.id = p.categoria_id
  left join procesadores pr on pr.id = ea.procesador_id
  left join proveedores prov on prov.id = ea.proveedor_id
  join usuarios uc on uc.id = ea.creado_por
  left join usuarios um on um.id = ea.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where ea.empresa_id = $1 order by ea.created_at desc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const {
      producto_id, marca, modelo, fecha_entrada, vida_util_meses, estado, asignada_a, observacion,
      procesador_id, memoria_ram, disco_duro, numero_serie, numero_puertos, numero_puertos_hdmi,
      precio_usd, locacion_pais, proveedor_id, no_factura,
    } = req.body;
    if (!producto_id || !marca || !modelo) {
      return res.status(400).json({ mensaje: 'producto_id, marca y modelo son requeridos' });
    }
    const estadoFinal = estado || 'stock';
    const { rows } = await pool.query(
      `insert into equipos_asignados
         (empresa_id, producto_id, marca, modelo, fecha_entrada, vida_util_meses, estado, asignada_a, observacion,
          procesador_id, memoria_ram, disco_duro, numero_serie, numero_puertos, numero_puertos_hdmi,
          precio_usd, locacion_pais, proveedor_id, no_factura, creado_por)
       values ($1,$2,$3,$4, coalesce($5, current_date), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       returning id`,
      [
        req.empresaId, producto_id, marca, modelo, fecha_entrada, vida_util_meses || null, estadoFinal, asignada_a || null, observacion || null,
        procesador_id || null, memoria_ram || null, disco_duro || null, numero_serie || null, numero_puertos ?? null, numero_puertos_hdmi ?? null,
        precio_usd ?? null, locacion_pais || null, proveedor_id || null, no_factura?.trim() || null,
        req.usuario.id,
      ]
    );

    // Primer movimiento del historico: sin estado ni asignacion anterior.
    await pool.query(
      `insert into equipos_historial (equipo_asignado_id, estado_anterior, estado_nuevo, asignada_a_anterior, asignada_a, registrado_por)
       values ($1, null, $2, null, $3, $4)`,
      [rows[0].id, estadoFinal, asignada_a || null, req.usuario.id]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where ea.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

// El formulario del frontend siempre manda el registro completo (no es un
// patch parcial), asi que aqui se reemplazan los campos tal cual vienen
// -- sin coalesce -- para poder limpiar vida_util_meses/asignada_a/
// observacion con null cuando el usuario los deja vacios.
async function actualizar(req, res, next) {
  try {
    const {
      producto_id, marca, modelo, fecha_entrada, vida_util_meses, estado, asignada_a, observacion,
      procesador_id, memoria_ram, disco_duro, numero_serie, numero_puertos, numero_puertos_hdmi,
      precio_usd, locacion_pais, proveedor_id, no_factura,
    } = req.body;
    if (!producto_id || !marca || !modelo || !estado) {
      return res.status(400).json({ mensaje: 'producto_id, marca, modelo y estado son requeridos' });
    }

    const { rows: actual } = await pool.query(
      'select estado, asignada_a from equipos_asignados where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });
    const estadoAnterior = actual[0].estado;
    const asignadaAnterior = actual[0].asignada_a;
    const asignadaNueva = asignada_a || null;

    const { rows } = await pool.query(
      `update equipos_asignados set
         producto_id = $1,
         marca = $2,
         modelo = $3,
         fecha_entrada = coalesce($4, fecha_entrada),
         vida_util_meses = $5,
         estado = $6,
         asignada_a = $7,
         observacion = $8,
         procesador_id = $9,
         memoria_ram = $10,
         disco_duro = $11,
         numero_serie = $12,
         numero_puertos = $13,
         numero_puertos_hdmi = $14,
         precio_usd = $15,
         locacion_pais = $16,
         proveedor_id = $17,
         no_factura = $18,
         modificado_por = $19
       where id = $20 and empresa_id = $21
       returning id`,
      [
        producto_id, marca, modelo, fecha_entrada, vida_util_meses || null, estado, asignadaNueva, observacion || null,
        procesador_id || null, memoria_ram || null, disco_duro || null, numero_serie || null, numero_puertos ?? null, numero_puertos_hdmi ?? null,
        precio_usd ?? null, locacion_pais || null, proveedor_id || null, no_factura?.trim() || null,
        req.usuario.id, req.params.id, req.empresaId,
      ]
    );

    // Un movimiento nuevo en el historico si el estado cambio o si se
    // reasigno a otra persona (aunque el estado se mantenga igual) --
    // editar otros campos, como observacion, no genera uno.
    if (estado !== estadoAnterior || asignadaNueva !== asignadaAnterior) {
      await pool.query(
        `insert into equipos_historial (equipo_asignado_id, estado_anterior, estado_nuevo, asignada_a_anterior, asignada_a, registrado_por)
         values ($1, $2, $3, $4, $5, $6)`,
        [req.params.id, estadoAnterior, estado, asignadaAnterior, asignadaNueva, req.usuario.id]
      );
    }

    const { rows: completo } = await pool.query(`${SELECT_BASE} where ea.id = $1`, [rows[0].id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from equipos_asignados where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

const ESTADOS_VALIDOS = ['en_uso', 'stock', 'reparacion', 'dano', 'descarte', 'vendida'];

// POST /api/equipos-asignados/:id/movimiento  { estado, asignada_a?, observacion? }
// Cambio rapido de estado desde el boton-icono de la fila (sin pasar por
// el formulario completo). asignada_a solo tiene sentido para 'en_uso' --
// para el resto de los estados se limpia. observacion es la nota de ESE
// movimiento puntual (queda en el historico, no en el equipo).
async function cambiarEstado(req, res, next) {
  try {
    const { estado, asignada_a, observacion } = req.body;
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado invalido' });
    }
    if (estado === 'en_uso' && !asignada_a?.trim()) {
      return res.status(400).json({ mensaje: 'Asignado a es requerido para pasar a "En uso"' });
    }

    const { rows: actual } = await pool.query(
      'select estado, asignada_a from equipos_asignados where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });
    const estadoAnterior = actual[0].estado;
    const asignadaAnterior = actual[0].asignada_a;

    const asignadaFinal = estado === 'en_uso' ? asignada_a.trim() : null;

    const { rows } = await pool.query(
      `update equipos_asignados set estado = $1, asignada_a = $2, modificado_por = $3
       where id = $4 and empresa_id = $5
       returning id`,
      [estado, asignadaFinal, req.usuario.id, req.params.id, req.empresaId]
    );

    // Tambien registra el movimiento si solo cambio a quien esta asignado
    // (reasignar de una persona a otra sin cambiar de "en_uso").
    if (estado !== estadoAnterior || asignadaFinal !== asignadaAnterior) {
      await pool.query(
        `insert into equipos_historial (equipo_asignado_id, estado_anterior, estado_nuevo, asignada_a_anterior, asignada_a, observacion, registrado_por)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, estadoAnterior, estado, asignadaAnterior, asignadaFinal, observacion?.trim() || null, req.usuario.id]
      );
    }

    const { rows: completo } = await pool.query(`${SELECT_BASE} where ea.id = $1`, [rows[0].id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

// GET /api/equipos-asignados/:id/historial
async function historial(req, res, next) {
  try {
    const { rows: equipo } = await pool.query(
      'select id from equipos_asignados where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!equipo[0]) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });

    const { rows } = await pool.query(
      `select h.*, u.nombre as registrado_por_nombre
       from equipos_historial h
       join usuarios u on u.id = h.registrado_por
       where h.equipo_asignado_id = $1
       order by h.fecha_cambio desc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// ADJUNTOS (imagenes/documentos) -- mismo patron que servicio_adjuntos/
// incidente_adjuntos: tabla propia, guardado/borrado inmediato.
// -------------------------------------------------------------
async function verificarEquipo(req) {
  const { rows } = await pool.query(
    'select id from equipos_asignados where id = $1 and empresa_id = $2',
    [req.params.id, req.empresaId]
  );
  return !!rows[0];
}

async function listarAdjuntos(req, res, next) {
  try {
    if (!(await verificarEquipo(req))) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });

    const { rows } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from equipo_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.equipo_asignado_id = $1
       order by a.fecha desc, a.created_at desc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearAdjunto(req, res, next) {
  try {
    const { descripcion, imagen_base64 } = req.body;

    if (!(await verificarEquipo(req))) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });

    if (typeof imagen_base64 !== 'string' || !IMAGEN_BASE64_PREFIJO.test(imagen_base64)) {
      return res.status(400).json({ mensaje: 'Solo se permiten archivos PDF, PNG o JPG' });
    }
    if (imagen_base64.length > MAX_IMAGEN_BASE64_CHARS) {
      return res.status(400).json({ mensaje: 'El archivo supera el tamano maximo permitido (3MB)' });
    }

    const { rows: cuenta } = await pool.query(
      'select count(*)::int as n from equipo_adjuntos where equipo_asignado_id = $1',
      [req.params.id]
    );
    if (cuenta[0].n >= MAX_ADJUNTOS) {
      return res.status(400).json({ mensaje: `No se permiten mas de ${MAX_ADJUNTOS} archivos adjuntos` });
    }

    const { rows } = await pool.query(
      `insert into equipo_adjuntos (equipo_asignado_id, descripcion, imagen_base64, creado_por)
       values ($1, $2, $3, $4)
       returning id`,
      [req.params.id, descripcion ? descripcion.trim() : null, imagen_base64, req.usuario.id]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from equipo_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarAdjunto(req, res, next) {
  try {
    const { descripcion } = req.body;

    if (!(await verificarEquipo(req))) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });

    const { rows: adj } = await pool.query(
      'select id from equipo_adjuntos where id = $1 and equipo_asignado_id = $2',
      [req.params.adjuntoId, req.params.id]
    );
    if (!adj[0]) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });

    await pool.query(
      'update equipo_adjuntos set descripcion = $1 where id = $2',
      [descripcion ? descripcion.trim() : null, req.params.adjuntoId]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from equipo_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.id = $1`,
      [req.params.adjuntoId]
    );
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarAdjunto(req, res, next) {
  try {
    if (!(await verificarEquipo(req))) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });

    const { rowCount } = await pool.query(
      'delete from equipo_adjuntos where id = $1 and equipo_asignado_id = $2',
      [req.params.adjuntoId, req.params.id]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });
    res.json({ ok: true, mensaje: 'Adjunto eliminado correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar, crear, actualizar, eliminar, historial, cambiarEstado,
  listarAdjuntos, crearAdjunto, actualizarAdjunto, eliminarAdjunto,
};
