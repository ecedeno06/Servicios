const { pool } = require('../config/db');

// GET /api/contratos  (con nombre de cliente incluido)
async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `select c.*, cl.nombre as cliente_nombre
       from contratos c
       join clientes cl on cl.id = c.cliente_id
       where c.empresa_id = $1
       order by c.created_at desc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/contratos/:id  (incluye servicios/horas establecidas y consumo)
async function obtener(req, res, next) {
  try {
    const { rows } = await pool.query(
      `select c.*, cl.nombre as cliente_nombre
       from contratos c join clientes cl on cl.id = c.cliente_id
       where c.id = $1 and c.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Contrato no encontrado' });

    const { rows: servicios } = await pool.query(
      `select * from vista_consumo_horas where contrato_id = $1 order by tipo_servicio_nombre`,
      [req.params.id]
    );

    res.json({ ...rows[0], servicios });
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos } = req.body;

    const cliente = await pool.query('select id from clientes where id = $1 and empresa_id = $2', [cliente_id, req.empresaId]);
    if (!cliente.rows[0]) return res.status(400).json({ mensaje: 'El cliente indicado no pertenece a esta empresa' });

    const { rows } = await pool.query(
      `insert into contratos (empresa_id, cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos)
       values ($1,$2,$3,$4,$5, coalesce($6,'activo'), $7, coalesce($8,'[]'::jsonb)) returning *`,
      [req.empresaId, cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos ? JSON.stringify(documentos) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos } = req.body;

    if (cliente_id) {
      const cliente = await pool.query('select id from clientes where id = $1 and empresa_id = $2', [cliente_id, req.empresaId]);
      if (!cliente.rows[0]) return res.status(400).json({ mensaje: 'El cliente indicado no pertenece a esta empresa' });
    }

    const { rows } = await pool.query(
      `update contratos set
         cliente_id = coalesce($1, cliente_id),
         numero_contrato = coalesce($2, numero_contrato),
         fecha_inicio = coalesce($3, fecha_inicio),
         fecha_fin = coalesce($4, fecha_fin),
         estado = coalesce($5, estado),
         observaciones = coalesce($6, observaciones),
         documentos = coalesce($7, documentos)
       where id = $8 and empresa_id = $9 returning *`,
      [cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos ? JSON.stringify(documentos) : null, req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Contrato no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from contratos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Contrato no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ----- Horas establecidas por tipo de servicio dentro del contrato -----

// POST /api/contratos/:id/servicios  { tipo_servicio_id, horas_contratadas, contactos }
// contactos: arreglo [{ nombre, correo, telefono }, ...] -- un servicio puede
// tener mas de un contacto asociado.
async function agregarServicio(req, res, next) {
  try {
    const { tipo_servicio_id, horas_contratadas, contactos } = req.body;

    const contrato = await pool.query('select id from contratos where id = $1 and empresa_id = $2', [req.params.id, req.empresaId]);
    if (!contrato.rows[0]) return res.status(404).json({ mensaje: 'Contrato no encontrado' });

    const tipoServicio = await pool.query('select id from tipos_servicio where id = $1 and empresa_id = $2', [tipo_servicio_id, req.empresaId]);
    if (!tipoServicio.rows[0]) return res.status(400).json({ mensaje: 'El tipo de servicio indicado no pertenece a esta empresa' });

    const { rows } = await pool.query(
      `insert into contrato_servicios (contrato_id, tipo_servicio_id, horas_contratadas, contactos)
       values ($1,$2,$3,$4) returning *`,
      [req.params.id, tipo_servicio_id, horas_contratadas, contactos ? JSON.stringify(contactos) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// PUT /api/contratos/:id/servicios/:contratoServicioId
async function actualizarServicio(req, res, next) {
  try {
    const { horas_contratadas, contactos } = req.body;
    const { rows } = await pool.query(
      `update contrato_servicios cs set
         horas_contratadas = coalesce($1, cs.horas_contratadas),
         contactos = coalesce($2, cs.contactos)
       from contratos c
       where cs.id = $3 and cs.contrato_id = $4 and cs.contrato_id = c.id and c.empresa_id = $5
       returning cs.*`,
      [horas_contratadas, contactos !== undefined ? JSON.stringify(contactos) : null, req.params.contratoServicioId, req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Servicio de contrato no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// DELETE /api/contratos/:id/servicios/:contratoServicioId
async function eliminarServicio(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      `delete from contrato_servicios cs
       using contratos c
       where cs.id = $1 and cs.contrato_id = $2 and cs.contrato_id = c.id and c.empresa_id = $3`,
      [req.params.contratoServicioId, req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Servicio de contrato no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = {
  listar, obtener, crear, actualizar, eliminar,
  agregarServicio, actualizarServicio, eliminarServicio,
};
