const { pool } = require('../config/db');

// GET /api/contratos  (con nombre de cliente incluido)
async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `select c.*, cl.nombre as cliente_nombre
       from contratos c
       join clientes cl on cl.id = c.cliente_id
       order by c.created_at desc`
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
       where c.id = $1`,
      [req.params.id]
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
    const { rows } = await pool.query(
      `insert into contratos (cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos)
       values ($1,$2,$3,$4, coalesce($5,'activo'), $6, coalesce($7,'[]'::jsonb)) returning *`,
      [cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos ? JSON.stringify(documentos) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos } = req.body;
    const { rows } = await pool.query(
      `update contratos set
         cliente_id = coalesce($1, cliente_id),
         numero_contrato = coalesce($2, numero_contrato),
         fecha_inicio = coalesce($3, fecha_inicio),
         fecha_fin = coalesce($4, fecha_fin),
         estado = coalesce($5, estado),
         observaciones = coalesce($6, observaciones),
         documentos = coalesce($7, documentos)
       where id = $8 returning *`,
      [cliente_id, numero_contrato, fecha_inicio, fecha_fin, estado, observaciones, documentos ? JSON.stringify(documentos) : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Contrato no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from contratos where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Contrato no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ----- Horas establecidas por tipo de servicio dentro del contrato -----

// POST /api/contratos/:id/servicios  { tipo_servicio_id, horas_contratadas }
async function agregarServicio(req, res, next) {
  try {
    const { tipo_servicio_id, horas_contratadas } = req.body;
    const { rows } = await pool.query(
      `insert into contrato_servicios (contrato_id, tipo_servicio_id, horas_contratadas)
       values ($1,$2,$3) returning *`,
      [req.params.id, tipo_servicio_id, horas_contratadas]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// PUT /api/contratos/:id/servicios/:contratoServicioId
async function actualizarServicio(req, res, next) {
  try {
    const { horas_contratadas } = req.body;
    const { rows } = await pool.query(
      `update contrato_servicios set horas_contratadas = coalesce($1, horas_contratadas)
       where id = $2 and contrato_id = $3 returning *`,
      [horas_contratadas, req.params.contratoServicioId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Servicio de contrato no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// DELETE /api/contratos/:id/servicios/:contratoServicioId
async function eliminarServicio(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from contrato_servicios where id = $1 and contrato_id = $2',
      [req.params.contratoServicioId, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Servicio de contrato no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = {
  listar, obtener, crear, actualizar, eliminar,
  agregarServicio, actualizarServicio, eliminarServicio,
};
