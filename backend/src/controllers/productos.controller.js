const { pool } = require('../config/db');

// Catalogo global (no depende de empresa_id) -- ver migracion 015.
async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `select p.*, c.nombre as categoria_nombre
       from productos p
       join categorias c on c.id = p.categoria_id
       order by c.nombre asc, p.nombre asc`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { categoria_id, nombre } = req.body;
    if (!categoria_id || !nombre) return res.status(400).json({ mensaje: 'categoria_id y nombre son requeridos' });
    const { rows } = await pool.query(
      'insert into productos (categoria_id, nombre) values ($1, $2) returning *',
      [categoria_id, nombre]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { categoria_id, nombre } = req.body;
    const { rows } = await pool.query(
      `update productos set
         categoria_id = coalesce($1, categoria_id),
         nombre = coalesce($2, nombre)
       where id = $3 returning *`,
      [categoria_id, nombre, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from productos where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, crear, actualizar, eliminar };
