const { pool } = require('../config/db');

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from empresas where activo = true order by nombre');
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtener(req, res, next) {
  try {
    const { rows } = await pool.query('select * from empresas where id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre, identificacion, email, telefono, direccion, activo } = req.body;
    const { rows } = await pool.query(
      `insert into empresas (nombre, identificacion, email, telefono, direccion, activo)
       values ($1,$2,$3,$4,$5, coalesce($6, true)) returning *`,
      [nombre, identificacion, email, telefono, direccion, activo]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, identificacion, email, telefono, direccion, activo } = req.body;
    const { rows } = await pool.query(
      `update empresas set
         nombre = coalesce($1, nombre),
         identificacion = coalesce($2, identificacion),
         email = coalesce($3, email),
         telefono = coalesce($4, telefono),
         direccion = coalesce($5, direccion),
         activo = coalesce($6, activo)
       where id = $7 returning *`,
      [nombre, identificacion, email, telefono, direccion, activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from empresas where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
