const { pool } = require('../config/db');
const { invalidarCache } = require('../utils/permisos');

// GET /api/rol-menu-permisos/:rolId -> [{ menu_id, permiso_id }] concedidos a ese rol
async function obtenerDeRol(req, res, next) {
  try {
    const { rows } = await pool.query(
      'select menu_id, permiso_id from rol_menu_permisos where rol_id = $1',
      [req.params.rolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// POST /api/rol-menu-permisos  { rolId, concesiones: [{menuId, permisoId}] }
// Reemplaza toda la matriz de ese rol de una vez (borra + reinserta),
// igual que la pantalla de administracion la edita (una grilla completa
// de checkboxes, no un toggle individual).
async function guardarDeRol(req, res, next) {
  const client = await pool.connect();
  try {
    const { rolId, concesiones } = req.body;
    if (!rolId) return res.status(400).json({ mensaje: 'rolId es requerido' });
    if (!Array.isArray(concesiones)) return res.status(400).json({ mensaje: 'concesiones debe ser un arreglo' });

    const { rows: rolRows } = await client.query('select es_sistema, codigo from roles where id = $1', [rolId]);
    if (!rolRows[0]) return res.status(404).json({ mensaje: 'Rol no encontrado' });

    await client.query('begin');
    await client.query('delete from rol_menu_permisos where rol_id = $1', [rolId]);
    for (const { menuId, permisoId } of concesiones) {
      if (!menuId || !permisoId) continue;
      await client.query(
        'insert into rol_menu_permisos (rol_id, menu_id, permiso_id) values ($1, $2, $3) on conflict do nothing',
        [rolId, menuId, permisoId]
      );
    }
    await client.query('commit');
    invalidarCache();
    res.json({ mensaje: 'Matriz de permisos actualizada', total: concesiones.length });
  } catch (err) {
    await client.query('rollback');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { obtenerDeRol, guardarDeRol };
