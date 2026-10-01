const { pool } = require('../config/db');
const { invalidarCache } = require('../utils/permisos');

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from menus order by orden asc');
    res.json(rows);
  } catch (err) { next(err); }
}

// No crea pantallas nuevas -- "ruta" debe apuntar a un componente Angular
// que ya existe. Esto es principalmente para reordenar/renombrar/ocultar
// y para colgarle permisos a pantallas existentes desde la matriz.
async function actualizar(req, res, next) {
  try {
    const { nombre, icono, orden, activo } = req.body;
    const { rows } = await pool.query(
      `update menus set
         nombre = coalesce($1, nombre),
         icono = coalesce($2, icono),
         orden = coalesce($3, orden),
         activo = coalesce($4, activo)
       where id = $5
       returning *`,
      [nombre, icono, orden, activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Menu no encontrado' });
    invalidarCache();
    res.json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = { listar, actualizar };
