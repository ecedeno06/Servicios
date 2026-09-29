const { pool } = require('../config/db');

// Catalogo global (no depende de empresa_id) -- ver migracion 015.
async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from categorias order by nombre asc');
    res.json(rows);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: 'nombre es requerido' });
    const { rows } = await pool.query('insert into categorias (nombre) values ($1) returning *', [nombre]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: 'nombre es requerido' });
    const { rows } = await pool.query('update categorias set nombre = $1 where id = $2 returning *', [nombre, req.params.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Categoria no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// Si tiene productos asociados, la FK (on delete restrict) hace fallar
// esto con 23503 -- el errorHandler generico ya lo traduce a un mensaje
// legible.
async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from categorias where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Categoria no encontrada' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, crear, actualizar, eliminar };
