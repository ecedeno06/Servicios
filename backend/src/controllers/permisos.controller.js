const { pool } = require('../config/db');

// Catalogo fijo de acciones (ver/crear/editar/eliminar) -- de solo
// lectura, no tiene UI de administracion (raramente cambia).
async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from permisos order by id');
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { listar };
