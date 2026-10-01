const { pool } = require('../config/db');
const { invalidarCache } = require('../utils/permisos');

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from menus order by orden asc');
    res.json(rows);
  } catch (err) { next(err); }
}

// Crear un menu aqui NO crea una pantalla nueva: "ruta" tiene que apuntar
// a un componente Angular que ya existe (y el codigo solo controla el
// sidebar/los guards del front -- para que el backend realmente exija el
// permiso en una ruta nueva, un desarrollador todavia tiene que llamar a
// requirePermiso('<codigo>', ...) en el router correspondiente). El
// "codigo" queda fijo despues de creado: es lo que usan requirePermiso()
// en el backend y los guards en el frontend.
async function crear(req, res, next) {
  try {
    const { codigo, nombre, ruta, icono, padre_id, orden } = req.body;
    if (!codigo || !nombre) return res.status(400).json({ mensaje: 'codigo y nombre son requeridos' });
    const codigoNormalizado = String(codigo).trim().toLowerCase().replace(/\s+/g, '_');
    if (!codigoNormalizado) return res.status(400).json({ mensaje: 'codigo invalido' });
    const { rows } = await pool.query(
      `insert into menus (codigo, nombre, ruta, icono, padre_id, orden)
       values ($1, $2, $3, $4, $5, coalesce($6, 0))
       returning *`,
      [codigoNormalizado, nombre, ruta || null, icono || null, padre_id || null, orden]
    );
    invalidarCache();
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, ruta, icono, padre_id, orden, activo } = req.body;
    const { rows } = await pool.query(
      `update menus set
         nombre = coalesce($1, nombre),
         ruta = $2,
         icono = coalesce($3, icono),
         padre_id = $4,
         orden = coalesce($5, orden),
         activo = coalesce($6, activo)
       where id = $7
       returning *`,
      [nombre, ruta || null, icono, padre_id || null, orden, activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Menu no encontrado' });
    invalidarCache();
    res.json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = { listar, crear, actualizar };
