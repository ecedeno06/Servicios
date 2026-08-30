const { pool } = require('../config/db');

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      'select * from tipos_servicio where empresa_id = $1 order by nombre asc',
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtener(req, res, next) {
  try {
    const { rows } = await pool.query(
      'select * from tipos_servicio where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Tipo de servicio no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion, activo } = req.body;
    const { rows } = await pool.query(
      `insert into tipos_servicio (empresa_id, nombre, descripcion, activo)
       values ($1,$2,$3, coalesce($4, true)) returning *`,
      [req.empresaId, nombre, descripcion, activo]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, descripcion, activo } = req.body;
    const { rows } = await pool.query(
      `update tipos_servicio set
         nombre = coalesce($1, nombre),
         descripcion = coalesce($2, descripcion),
         activo = coalesce($3, activo)
       where id = $4 and empresa_id = $5 returning *`,
      [nombre, descripcion, activo, req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Tipo de servicio no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from tipos_servicio where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Tipo de servicio no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
