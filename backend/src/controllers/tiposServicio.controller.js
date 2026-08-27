const { pool } = require('../config/db');

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from tipos_servicio order by nombre asc');
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtener(req, res, next) {
  try {
    const { rows } = await pool.query('select * from tipos_servicio where id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Tipo de servicio no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion, activo } = req.body;
    const { rows } = await pool.query(
      `insert into tipos_servicio (nombre, descripcion, activo)
       values ($1,$2, coalesce($3, true)) returning *`,
      [nombre, descripcion, activo]
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
       where id = $4 returning *`,
      [nombre, descripcion, activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Tipo de servicio no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from tipos_servicio where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Tipo de servicio no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
