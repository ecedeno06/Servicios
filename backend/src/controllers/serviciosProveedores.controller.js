const { pool } = require('../config/db');

const MAX_ADJUNTOS = 20;
const MAX_IMAGEN_BASE64_CHARS = 4 * 1024 * 1024; // ~4MB de texto base64 (~3MB de archivo real)
const IMAGEN_BASE64_PREFIJO = /^data:(image\/png|image\/jpeg|application\/pdf);base64,/;

const SELECT_BASE = `
  select
    sp.*,
    p.nombre as proveedor_nombre,
    p.sector as proveedor_sector,
    p.sector_id as proveedor_sector_id,
    p.telefono as proveedor_telefono,
    p.telefono_codigo_pais as proveedor_telefono_codigo_pais,
    p.acepta_whatsapp as proveedor_acepta_whatsapp,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre,
    (select count(*)::int from facturas_servicios_proveedores f where f.servicio_proveedor_id = sp.id) as facturas_count,
    (select count(*)::int from facturas_servicios_proveedores f where f.servicio_proveedor_id = sp.id and f.estado = 'pendiente') as facturas_pendientes_count,
    (select coalesce(sum(f.monto_factura), 0)::numeric from facturas_servicios_proveedores f where f.servicio_proveedor_id = sp.id and f.estado = 'pagada') as monto_total_pagado,
    (select f.monto_factura from facturas_servicios_proveedores f where f.servicio_proveedor_id = sp.id and f.estado = 'pagada' order by f.fecha_factura desc, f.created_at desc limit 1) as ultimo_pago_monto,
    (select f.monto_factura from facturas_servicios_proveedores f where f.servicio_proveedor_id = sp.id and f.estado = 'pagada' order by f.fecha_factura desc, f.created_at desc limit 1 offset 1) as penultimo_pago_monto,
    (select count(*)::int from servicio_incidentes i where i.servicio_proveedor_id = sp.id and i.estado = 'abierto') as incidentes_abiertos_count
  from servicios_proveedores sp
  join proveedores p on p.id = sp.proveedor_id
  join usuarios uc on uc.id = sp.creado_por
  left join usuarios um on um.id = sp.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where sp.empresa_id = $1 order by sp.created_at desc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/servicios-proveedores/reporte/pagos?desde=&hasta=
// Una fila por servicio, con los pagos ("pagada") sumados solo dentro del
// rango de fechas pedido -- distinto de monto_total_pagado en SELECT_BASE,
// que es el acumulado historico completo.
async function reportePagos(req, res, next) {
  try {
    const { desde, hasta } = req.query;
    const { rows } = await pool.query(
      `select
         sp.id,
         sp.servicio,
         sp.costo_mensual,
         sp.estado,
         p.nombre as proveedor_nombre,
         coalesce(sec.nombre, p.sector) as sector_nombre,
         coalesce((
           select sum(f.monto_factura)
           from facturas_servicios_proveedores f
           where f.servicio_proveedor_id = sp.id
             and f.estado = 'pagada'
             and ($1::date is null or f.fecha_factura >= $1::date)
             and ($2::date is null or f.fecha_factura <= $2::date)
         ), 0)::numeric as pagos_total_rango
       from servicios_proveedores sp
       join proveedores p on p.id = sp.proveedor_id
       left join sectores_proveedores sec on sec.id = p.sector_id
       where sp.empresa_id = $3
       order by sp.servicio asc`,
      [desde || null, hasta || null, req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where sp.id = $1 and sp.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    // Cargar tambien facturas y adjuntos asociados
    const { rows: facturas } = await pool.query(
      `select f.*, uc.nombre as creado_por_nombre
       from facturas_servicios_proveedores f
       join usuarios uc on uc.id = f.creado_por
       where f.servicio_proveedor_id = $1
       order by f.fecha_factura desc, f.created_at desc`,
      [req.params.id]
    );
    const { rows: imagenes } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from servicio_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.servicio_proveedor_id = $1
       order by a.fecha desc, a.created_at desc`,
      [req.params.id]
    );
    const { rows: incidentes } = await pool.query(
      `select i.*, uc.nombre as creado_por_nombre, um.nombre as modificado_por_nombre
       from servicio_incidentes i
       join usuarios uc on uc.id = i.creado_por
       left join usuarios um on um.id = i.modificado_por
       where i.servicio_proveedor_id = $1
       order by i.fecha_incidente desc, i.created_at desc`,
      [req.params.id]
    );

    res.json({ ...rows[0], facturas, imagenes, incidentes });
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { proveedor_id, servicio, costo_mensual, costo_anual, fecha_inicio, fecha_fin, es_indefinido, dias_aviso_vencimiento, no_contrato, contactos, estado, observacion, url, responsable } = req.body;
    if (!proveedor_id || !servicio) {
      return res.status(400).json({ mensaje: 'proveedor_id y servicio son requeridos' });
    }

    // Validar que el proveedor exista y pertenezca a la empresa
    const { rows: prov } = await pool.query(
      'select id from proveedores where id = $1 and empresa_id = $2',
      [proveedor_id, req.empresaId]
    );
    if (!prov[0]) return res.status(400).json({ mensaje: 'El proveedor seleccionado no existe o no pertenece a la empresa' });

    const contactosJson = JSON.stringify(Array.isArray(contactos) ? contactos : []);
    const estadoFinal = estado || 'activo';
    // es_indefinido=true manda sobre cualquier fecha_fin/aviso que llegue:
    // un contrato indefinido no tiene fecha de vencimiento ni aviso previo.
    const indefinidoFinal = es_indefinido === undefined ? true : !!es_indefinido;
    const fechaFinFinal = indefinidoFinal ? null : (fecha_fin || null);
    const diasAvisoFinal = indefinidoFinal ? null : (dias_aviso_vencimiento ?? null);

    const { rows } = await pool.query(
      `insert into servicios_proveedores
         (empresa_id, proveedor_id, servicio, costo_mensual, costo_anual, fecha_inicio, fecha_fin, es_indefinido, dias_aviso_vencimiento, no_contrato, contactos, estado, observacion, url, responsable, creado_por)
       values ($1, $2, $3, $4, $5, coalesce($6, current_date), $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16)
       returning id`,
      [
        req.empresaId,
        proveedor_id,
        servicio.trim(),
        costo_mensual ?? 0.00,
        costo_anual ?? 0.00,
        fecha_inicio || null,
        fechaFinFinal,
        indefinidoFinal,
        diasAvisoFinal,
        no_contrato ? no_contrato.trim() : null,
        contactosJson,
        estadoFinal,
        observacion ? observacion.trim() : null,
        url ? url.trim() : null,
        responsable ? responsable.trim() : null,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where sp.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { proveedor_id, servicio, costo_mensual, costo_anual, fecha_inicio, fecha_fin, es_indefinido, dias_aviso_vencimiento, no_contrato, contactos, estado, observacion, url, responsable } = req.body;
    if (!proveedor_id || !servicio) {
      return res.status(400).json({ mensaje: 'proveedor_id y servicio son requeridos' });
    }

    const { rows: actual } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const contactosJson = JSON.stringify(Array.isArray(contactos) ? contactos : []);
    const indefinidoFinal = es_indefinido === undefined ? true : !!es_indefinido;
    const fechaFinFinal = indefinidoFinal ? null : (fecha_fin || null);
    const diasAvisoFinal = indefinidoFinal ? null : (dias_aviso_vencimiento ?? null);

    await pool.query(
      `update servicios_proveedores set
         proveedor_id = $1,
         servicio = $2,
         costo_mensual = $3,
         costo_anual = $4,
         fecha_inicio = coalesce($5, fecha_inicio),
         fecha_fin = $6,
         es_indefinido = $7,
         dias_aviso_vencimiento = $8,
         no_contrato = $9,
         contactos = $10::jsonb,
         estado = $11,
         observacion = $12,
         url = $13,
         responsable = $14,
         modificado_por = $15
       where id = $16 and empresa_id = $17`,
      [
        proveedor_id,
        servicio.trim(),
        costo_mensual ?? 0.00,
        costo_anual ?? 0.00,
        fecha_inicio || null,
        fechaFinFinal,
        indefinidoFinal,
        diasAvisoFinal,
        no_contrato ? no_contrato.trim() : null,
        contactosJson,
        estado || 'activo',
        observacion ? observacion.trim() : null,
        url ? url.trim() : null,
        responsable ? responsable.trim() : null,
        req.usuario.id,
        req.params.id,
        req.empresaId,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where sp.id = $1`, [req.params.id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Servicio no encontrado' });
    res.json({ ok: true, mensaje: 'Servicio eliminado correctamente' });
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// FACTURAS / TRANSACCIONES
// -------------------------------------------------------------

async function listarFacturas(req, res, next) {
  try {
    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows } = await pool.query(
      `select f.*, uc.nombre as creado_por_nombre, um.nombre as modificado_por_nombre
       from facturas_servicios_proveedores f
       join usuarios uc on uc.id = f.creado_por
       left join usuarios um on um.id = f.modificado_por
       where f.servicio_proveedor_id = $1
       order by f.fecha_factura desc, f.created_at desc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearFactura(req, res, next) {
  try {
    const { fecha_factura, monto_factura, estado, forma_pago, observaciones } = req.body;
    if (monto_factura === undefined || monto_factura === null) {
      return res.status(400).json({ mensaje: 'El monto de la factura es requerido' });
    }

    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows } = await pool.query(
      `insert into facturas_servicios_proveedores
         (servicio_proveedor_id, fecha_factura, monto_factura, estado, forma_pago, observaciones, creado_por)
       values ($1, coalesce($2, current_date), $3, $4, $5, $6, $7)
       returning *`,
      [
        req.params.id,
        fecha_factura || null,
        monto_factura,
        estado || 'pendiente',
        forma_pago || 'transferencia',
        observaciones ? observaciones.trim() : null,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(
      `select f.*, uc.nombre as creado_por_nombre
       from facturas_servicios_proveedores f
       join usuarios uc on uc.id = f.creado_por
       where f.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarFactura(req, res, next) {
  try {
    const { fecha_factura, monto_factura, estado, forma_pago, observaciones } = req.body;

    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows: fact } = await pool.query(
      'select id from facturas_servicios_proveedores where id = $1 and servicio_proveedor_id = $2',
      [req.params.facturaId, req.params.id]
    );
    if (!fact[0]) return res.status(404).json({ mensaje: 'Factura no encontrada' });

    await pool.query(
      `update facturas_servicios_proveedores set
         fecha_factura = coalesce($1, fecha_factura),
         monto_factura = coalesce($2, monto_factura),
         estado = coalesce($3, estado),
         forma_pago = coalesce($4, forma_pago),
         observaciones = $5,
         modificado_por = $6
       where id = $7`,
      [
        fecha_factura || null,
        monto_factura ?? null,
        estado || null,
        forma_pago || null,
        observaciones ? observaciones.trim() : null,
        req.usuario.id,
        req.params.facturaId,
      ]
    );

    const { rows: completo } = await pool.query(
      `select f.*, uc.nombre as creado_por_nombre, um.nombre as modificado_por_nombre
       from facturas_servicios_proveedores f
       join usuarios uc on uc.id = f.creado_por
       left join usuarios um on um.id = f.modificado_por
       where f.id = $1`,
      [req.params.facturaId]
    );
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarFactura(req, res, next) {
  try {
    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rowCount } = await pool.query(
      'delete from facturas_servicios_proveedores where id = $1 and servicio_proveedor_id = $2',
      [req.params.facturaId, req.params.id]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Factura no encontrada' });
    res.json({ ok: true, mensaje: 'Factura eliminada correctamente' });
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// INCIDENTES
// -------------------------------------------------------------

const ESTADOS_INCIDENTE = ['abierto', 'en pausa', 'cerrado'];

async function listarIncidentes(req, res, next) {
  try {
    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows } = await pool.query(
      `select i.*, uc.nombre as creado_por_nombre, um.nombre as modificado_por_nombre
       from servicio_incidentes i
       join usuarios uc on uc.id = i.creado_por
       left join usuarios um on um.id = i.modificado_por
       where i.servicio_proveedor_id = $1
       order by i.fecha_incidente desc, i.created_at desc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearIncidente(req, res, next) {
  try {
    const { fecha_incidente, reportado_por, descripcion, no_ticket_fabricante, estado } = req.body;
    if (!reportado_por || !reportado_por.trim()) {
      return res.status(400).json({ mensaje: 'El campo "reportado por" es requerido' });
    }
    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ mensaje: 'La descripcion del incidente es requerida' });
    }
    if (estado && !ESTADOS_INCIDENTE.includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado de incidente invalido' });
    }

    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows } = await pool.query(
      `insert into servicio_incidentes
         (servicio_proveedor_id, fecha_incidente, reportado_por, descripcion, no_ticket_fabricante, estado, creado_por)
       values ($1, coalesce($2, current_date), $3, $4, $5, $6, $7)
       returning id`,
      [
        req.params.id,
        fecha_incidente || null,
        reportado_por.trim(),
        descripcion.trim(),
        no_ticket_fabricante ? no_ticket_fabricante.trim() : null,
        estado || 'abierto',
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(
      `select i.*, uc.nombre as creado_por_nombre
       from servicio_incidentes i
       join usuarios uc on uc.id = i.creado_por
       where i.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarIncidente(req, res, next) {
  try {
    const { fecha_incidente, reportado_por, descripcion, no_ticket_fabricante, estado } = req.body;
    if (estado && !ESTADOS_INCIDENTE.includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado de incidente invalido' });
    }

    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows: inc } = await pool.query(
      'select id from servicio_incidentes where id = $1 and servicio_proveedor_id = $2',
      [req.params.incidenteId, req.params.id]
    );
    if (!inc[0]) return res.status(404).json({ mensaje: 'Incidente no encontrado' });

    // no_ticket_fabricante usa coalesce igual que el resto -- a diferencia
    // de observaciones en Facturas, este endpoint recibe actualizaciones
    // parciales reales (cambiarEstadoIncidente solo manda {estado}), asi
    // que sobreescribirlo siempre borraria el ticket en cada cambio de
    // estado.
    await pool.query(
      `update servicio_incidentes set
         fecha_incidente = coalesce($1, fecha_incidente),
         reportado_por = coalesce($2, reportado_por),
         descripcion = coalesce($3, descripcion),
         no_ticket_fabricante = coalesce($4, no_ticket_fabricante),
         estado = coalesce($5, estado),
         modificado_por = $6
       where id = $7`,
      [
        fecha_incidente || null,
        reportado_por ? reportado_por.trim() : null,
        descripcion ? descripcion.trim() : null,
        no_ticket_fabricante ? no_ticket_fabricante.trim() : null,
        estado || null,
        req.usuario.id,
        req.params.incidenteId,
      ]
    );

    const { rows: completo } = await pool.query(
      `select i.*, uc.nombre as creado_por_nombre, um.nombre as modificado_por_nombre
       from servicio_incidentes i
       join usuarios uc on uc.id = i.creado_por
       left join usuarios um on um.id = i.modificado_por
       where i.id = $1`,
      [req.params.incidenteId]
    );
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarIncidente(req, res, next) {
  try {
    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rowCount } = await pool.query(
      'delete from servicio_incidentes where id = $1 and servicio_proveedor_id = $2',
      [req.params.incidenteId, req.params.id]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Incidente no encontrado' });
    res.json({ ok: true, mensaje: 'Incidente eliminado correctamente' });
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// ADJUNTOS DE INCIDENTE (imagenes/documentos -- PDF/PNG/JPG en base64)
// -------------------------------------------------------------

async function verificarIncidente(req) {
  const { rows: inc } = await pool.query(
    `select i.id
     from servicio_incidentes i
     join servicios_proveedores sp on sp.id = i.servicio_proveedor_id
     where i.id = $1 and i.servicio_proveedor_id = $2 and sp.empresa_id = $3`,
    [req.params.incidenteId, req.params.id, req.empresaId]
  );
  return !!inc[0];
}

async function listarAdjuntosIncidente(req, res, next) {
  try {
    if (!(await verificarIncidente(req))) return res.status(404).json({ mensaje: 'Incidente no encontrado' });

    const { rows } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from incidente_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.incidente_id = $1
       order by a.fecha desc, a.created_at desc`,
      [req.params.incidenteId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearAdjuntoIncidente(req, res, next) {
  try {
    const { descripcion, imagen_base64 } = req.body;

    if (!(await verificarIncidente(req))) return res.status(404).json({ mensaje: 'Incidente no encontrado' });

    if (typeof imagen_base64 !== 'string' || !IMAGEN_BASE64_PREFIJO.test(imagen_base64)) {
      return res.status(400).json({ mensaje: 'Solo se permiten archivos PDF, PNG o JPG' });
    }
    if (imagen_base64.length > MAX_IMAGEN_BASE64_CHARS) {
      return res.status(400).json({ mensaje: 'El archivo supera el tamano maximo permitido (3MB)' });
    }

    const { rows: cuenta } = await pool.query(
      'select count(*)::int as n from incidente_adjuntos where incidente_id = $1',
      [req.params.incidenteId]
    );
    if (cuenta[0].n >= MAX_ADJUNTOS) {
      return res.status(400).json({ mensaje: `No se permiten mas de ${MAX_ADJUNTOS} archivos adjuntos` });
    }

    const { rows } = await pool.query(
      `insert into incidente_adjuntos (incidente_id, descripcion, imagen_base64, creado_por)
       values ($1, $2, $3, $4)
       returning id`,
      [req.params.incidenteId, descripcion ? descripcion.trim() : null, imagen_base64, req.usuario.id]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from incidente_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarAdjuntoIncidente(req, res, next) {
  try {
    const { descripcion } = req.body;

    if (!(await verificarIncidente(req))) return res.status(404).json({ mensaje: 'Incidente no encontrado' });

    const { rows: adj } = await pool.query(
      'select id from incidente_adjuntos where id = $1 and incidente_id = $2',
      [req.params.adjuntoId, req.params.incidenteId]
    );
    if (!adj[0]) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });

    await pool.query(
      'update incidente_adjuntos set descripcion = $1 where id = $2',
      [descripcion ? descripcion.trim() : null, req.params.adjuntoId]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from incidente_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.id = $1`,
      [req.params.adjuntoId]
    );
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarAdjuntoIncidente(req, res, next) {
  try {
    if (!(await verificarIncidente(req))) return res.status(404).json({ mensaje: 'Incidente no encontrado' });

    const { rowCount } = await pool.query(
      'delete from incidente_adjuntos where id = $1 and incidente_id = $2',
      [req.params.adjuntoId, req.params.incidenteId]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });
    res.json({ ok: true, mensaje: 'Adjunto eliminado correctamente' });
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// ADJUNTOS (imagenes/documentos -- PDF/PNG/JPG en base64)
// -------------------------------------------------------------

async function listarAdjuntos(req, res, next) {
  try {
    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from servicio_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.servicio_proveedor_id = $1
       order by a.fecha desc, a.created_at desc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearAdjunto(req, res, next) {
  try {
    const { descripcion, imagen_base64 } = req.body;

    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    if (typeof imagen_base64 !== 'string' || !IMAGEN_BASE64_PREFIJO.test(imagen_base64)) {
      return res.status(400).json({ mensaje: 'Solo se permiten archivos PDF, PNG o JPG' });
    }
    if (imagen_base64.length > MAX_IMAGEN_BASE64_CHARS) {
      return res.status(400).json({ mensaje: 'El archivo supera el tamano maximo permitido (3MB)' });
    }

    const { rows: cuenta } = await pool.query(
      'select count(*)::int as n from servicio_adjuntos where servicio_proveedor_id = $1',
      [req.params.id]
    );
    if (cuenta[0].n >= MAX_ADJUNTOS) {
      return res.status(400).json({ mensaje: `No se permiten mas de ${MAX_ADJUNTOS} archivos adjuntos` });
    }

    const { rows } = await pool.query(
      `insert into servicio_adjuntos (servicio_proveedor_id, descripcion, imagen_base64, creado_por)
       values ($1, $2, $3, $4)
       returning id`,
      [req.params.id, descripcion ? descripcion.trim() : null, imagen_base64, req.usuario.id]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from servicio_adjuntos a
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

    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rows: adj } = await pool.query(
      'select id from servicio_adjuntos where id = $1 and servicio_proveedor_id = $2',
      [req.params.adjuntoId, req.params.id]
    );
    if (!adj[0]) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });

    await pool.query(
      'update servicio_adjuntos set descripcion = $1 where id = $2',
      [descripcion ? descripcion.trim() : null, req.params.adjuntoId]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from servicio_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.id = $1`,
      [req.params.adjuntoId]
    );
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarAdjunto(req, res, next) {
  try {
    const { rows: me } = await pool.query(
      'select id from servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!me[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { rowCount } = await pool.query(
      'delete from servicio_adjuntos where id = $1 and servicio_proveedor_id = $2',
      [req.params.adjuntoId, req.params.id]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });
    res.json({ ok: true, mensaje: 'Adjunto eliminado correctamente' });
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// ADJUNTOS DE FACTURA (imagenes/documentos -- PDF/PNG/JPG en base64)
// -------------------------------------------------------------

async function verificarFactura(req) {
  const { rows: fact } = await pool.query(
    `select f.id
     from facturas_servicios_proveedores f
     join servicios_proveedores sp on sp.id = f.servicio_proveedor_id
     where f.id = $1 and f.servicio_proveedor_id = $2 and sp.empresa_id = $3`,
    [req.params.facturaId, req.params.id, req.empresaId]
  );
  return !!fact[0];
}

async function listarAdjuntosFactura(req, res, next) {
  try {
    if (!(await verificarFactura(req))) return res.status(404).json({ mensaje: 'Factura no encontrada' });

    const { rows } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from factura_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.factura_id = $1
       order by a.fecha desc, a.created_at desc`,
      [req.params.facturaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearAdjuntoFactura(req, res, next) {
  try {
    const { descripcion, imagen_base64 } = req.body;

    if (!(await verificarFactura(req))) return res.status(404).json({ mensaje: 'Factura no encontrada' });

    if (typeof imagen_base64 !== 'string' || !IMAGEN_BASE64_PREFIJO.test(imagen_base64)) {
      return res.status(400).json({ mensaje: 'Solo se permiten archivos PDF, PNG o JPG' });
    }
    if (imagen_base64.length > MAX_IMAGEN_BASE64_CHARS) {
      return res.status(400).json({ mensaje: 'El archivo supera el tamano maximo permitido (3MB)' });
    }

    const { rows: cuenta } = await pool.query(
      'select count(*)::int as n from factura_adjuntos where factura_id = $1',
      [req.params.facturaId]
    );
    if (cuenta[0].n >= MAX_ADJUNTOS) {
      return res.status(400).json({ mensaje: `No se permiten mas de ${MAX_ADJUNTOS} archivos adjuntos` });
    }

    const { rows } = await pool.query(
      `insert into factura_adjuntos (factura_id, descripcion, imagen_base64, creado_por)
       values ($1, $2, $3, $4)
       returning id`,
      [req.params.facturaId, descripcion ? descripcion.trim() : null, imagen_base64, req.usuario.id]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from factura_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarAdjuntoFactura(req, res, next) {
  try {
    const { descripcion } = req.body;

    if (!(await verificarFactura(req))) return res.status(404).json({ mensaje: 'Factura no encontrada' });

    const { rows: adj } = await pool.query(
      'select id from factura_adjuntos where id = $1 and factura_id = $2',
      [req.params.adjuntoId, req.params.facturaId]
    );
    if (!adj[0]) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });

    await pool.query(
      'update factura_adjuntos set descripcion = $1 where id = $2',
      [descripcion ? descripcion.trim() : null, req.params.adjuntoId]
    );

    const { rows: completo } = await pool.query(
      `select a.*, u.nombre as creado_por_nombre
       from factura_adjuntos a
       join usuarios u on u.id = a.creado_por
       where a.id = $1`,
      [req.params.adjuntoId]
    );
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarAdjuntoFactura(req, res, next) {
  try {
    if (!(await verificarFactura(req))) return res.status(404).json({ mensaje: 'Factura no encontrada' });

    const { rowCount } = await pool.query(
      'delete from factura_adjuntos where id = $1 and factura_id = $2',
      [req.params.adjuntoId, req.params.facturaId]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Adjunto no encontrado' });
    res.json({ ok: true, mensaje: 'Adjunto eliminado correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  reportePagos,
  listarFacturas,
  crearFactura,
  actualizarFactura,
  eliminarFactura,
  listarAdjuntos,
  crearAdjunto,
  actualizarAdjunto,
  eliminarAdjunto,
  listarAdjuntosFactura,
  crearAdjuntoFactura,
  actualizarAdjuntoFactura,
  eliminarAdjuntoFactura,
  listarIncidentes,
  crearIncidente,
  actualizarIncidente,
  eliminarIncidente,
  listarAdjuntosIncidente,
  crearAdjuntoIncidente,
  actualizarAdjuntoIncidente,
  eliminarAdjuntoIncidente,
};
