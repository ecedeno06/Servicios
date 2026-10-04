const { pool } = require('../config/db');

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
    (select coalesce(sum(f.monto_factura), 0)::numeric from facturas_servicios_proveedores f where f.servicio_proveedor_id = sp.id and f.estado = 'pagada') as monto_total_pagado
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

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where sp.id = $1 and sp.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    // Cargar tambien facturas asociadas
    const { rows: facturas } = await pool.query(
      `select f.*, uc.nombre as creado_por_nombre
       from facturas_servicios_proveedores f
       join usuarios uc on uc.id = f.creado_por
       where f.servicio_proveedor_id = $1
       order by f.fecha_factura desc, f.created_at desc`,
      [req.params.id]
    );

    res.json({ ...rows[0], facturas });
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { proveedor_id, servicio, costo_mensual, costo_anual, fecha_inicio, fecha_fin, es_indefinido, dias_aviso_vencimiento, no_contrato, contactos, estado, observacion } = req.body;
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
         (empresa_id, proveedor_id, servicio, costo_mensual, costo_anual, fecha_inicio, fecha_fin, es_indefinido, dias_aviso_vencimiento, no_contrato, contactos, estado, observacion, creado_por)
       values ($1, $2, $3, $4, $5, coalesce($6, current_date), $7, $8, $9, $10, $11::jsonb, $12, $13, $14)
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
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where sp.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { proveedor_id, servicio, costo_mensual, costo_anual, fecha_inicio, fecha_fin, es_indefinido, dias_aviso_vencimiento, no_contrato, contactos, estado, observacion } = req.body;
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
         modificado_por = $13
       where id = $14 and empresa_id = $15`,
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

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  listarFacturas,
  crearFactura,
  actualizarFactura,
  eliminarFactura,
};
