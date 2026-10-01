const { pool } = require('../config/db');
const { invalidarCache } = require('../utils/permisos');

// Catalogo global de roles (no depende de empresa_id).
async function listar(req, res, next) {
  try {
    const { rows } = await pool.query('select * from roles order by es_sistema desc, nombre asc');
    res.json(rows);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { codigo, nombre } = req.body;
    if (!codigo || !nombre) return res.status(400).json({ mensaje: 'codigo y nombre son requeridos' });
    const codigoNormalizado = String(codigo).trim().toLowerCase().replace(/\s+/g, '_');
    if (!codigoNormalizado) return res.status(400).json({ mensaje: 'codigo invalido' });
    const { rows } = await pool.query(
      'insert into roles (codigo, nombre) values ($1, $2) returning *',
      [codigoNormalizado, nombre]
    );
    invalidarCache();
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// Solo nombre/activo son editables -- el codigo queda fijo tras crearse
// (lo reusan el JWT, usuarios_empresas_rol.rol, etc; cambiarlo a mitad de
// camino dejaria huerfanas las asignaciones existentes).
async function actualizar(req, res, next) {
  try {
    const { nombre, activo } = req.body;
    const { rows } = await pool.query('select es_sistema from roles where id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Rol no encontrado' });

    const { rows: actualizado } = await pool.query(
      'update roles set nombre = coalesce($1, nombre), activo = coalesce($2, activo) where id = $3 returning *',
      [nombre, activo, req.params.id]
    );
    invalidarCache();
    res.json(actualizado[0]);
  } catch (err) { next(err); }
}

// Un rol "de sistema" (admin/supervisor/tecnico/cliente) no se puede
// borrar: hay logica propia del codebase que depende literalmente de
// esos codigos (scoping de datos de 'cliente', etc).
async function eliminar(req, res, next) {
  try {
    const { rows } = await pool.query('select es_sistema, codigo from roles where id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Rol no encontrado' });
    if (rows[0].es_sistema) {
      return res.status(400).json({ mensaje: `El rol "${rows[0].codigo}" es de sistema y no se puede eliminar` });
    }
    await pool.query('delete from roles where id = $1', [req.params.id]);
    invalidarCache();
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, crear, actualizar, eliminar };
