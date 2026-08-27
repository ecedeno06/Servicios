const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `select id, nombre, email, rol, activo, created_at
       from usuarios order by created_at desc`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtener(req, res, next) {
  try {
    const { rows } = await pool.query(
      `select id, nombre, email, rol, activo, created_at from usuarios where id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre, email, password, rol, activo } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `insert into usuarios (nombre, email, password_hash, rol, activo)
       values ($1, $2, $3, coalesce($4,'tecnico'), coalesce($5, true))
       returning id, nombre, email, rol, activo, created_at`,
      [nombre, email, password_hash, rol, activo]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, email, rol, activo, password } = req.body;
    let password_hash = null;
    if (password) password_hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `update usuarios set
         nombre = coalesce($1, nombre),
         email = coalesce($2, email),
         rol = coalesce($3, rol),
         activo = coalesce($4, activo),
         password_hash = coalesce($5, password_hash)
       where id = $6
       returning id, nombre, email, rol, activo, created_at`,
      [nombre, email, rol, activo, password_hash, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from usuarios where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
