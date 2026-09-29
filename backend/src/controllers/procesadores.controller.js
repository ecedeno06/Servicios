const { pool } = require('../config/db');

// Catalogo global (no depende de empresa_id) -- ver migracion 018.
async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from procesadores order by nombre asc');
    res.json(rows);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: 'nombre es requerido' });
    const { rows } = await pool.query('insert into procesadores (nombre) values ($1) returning *', [nombre]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: 'nombre es requerido' });
    const { rows } = await pool.query('update procesadores set nombre = $1 where id = $2 returning *', [nombre, req.params.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Procesador no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from procesadores where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Procesador no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, crear, actualizar, eliminar };
