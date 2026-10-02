const { pool } = require('../config/db');

const SELECT_BASE = `
  select
    sp.*,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre,
    (select count(*)::int from proveedores p where p.sector_id = sp.id) as proveedores_count
  from sectores_proveedores sp
  join usuarios uc on uc.id = sp.creado_por
  left join usuarios um on um.id = sp.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where sp.empresa_id = $1 order by sp.nombre asc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where sp.id = $1 and sp.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Sector no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion, activo } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del sector es requerido' });
    }

    const { rows } = await pool.query(
      `insert into sectores_proveedores (empresa_id, nombre, descripcion, activo, creado_por)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        req.empresaId,
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        activo ?? true,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where sp.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, descripcion, activo } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del sector es requerido' });
    }

    const { rows: actual } = await pool.query(
      'select id from sectores_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Sector no encontrado' });

    await pool.query(
      `update sectores_proveedores set
         nombre = $1,
         descripcion = $2,
         activo = $3,
         modificado_por = $4
       where id = $5 and empresa_id = $6`,
      [
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        activo ?? true,
        req.usuario.id,
        req.params.id,
        req.empresaId,
      ]
    );

    // Actualizar también el campo de texto legacy 'sector' en la tabla proveedores para mantener sincronicidad
    await pool.query(
      `update proveedores set sector = $1 where sector_id = $2 and empresa_id = $3`,
      [nombre.trim(), req.params.id, req.empresaId]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where sp.id = $1`, [req.params.id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rows: provs } = await pool.query(
      'select count(*)::int as count from proveedores where sector_id = $1',
      [req.params.id]
    );

    if (provs[0] && provs[0].count > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar el sector porque está asignado a ${provs[0].count} proveedor(es).`
      });
    }

    const { rowCount } = await pool.query(
      'delete from sectores_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Sector no encontrado' });
    res.json({ ok: true, mensaje: 'Sector eliminado correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};
