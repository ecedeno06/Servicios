const { pool } = require('../config/db');

const SELECT_BASE = `
  select
    e.*,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre,
    (select count(*)::int from servicios_proveedores sp where sp.estado_id = e.id) as servicios_count
  from estados_servicios_proveedores e
  join usuarios uc on uc.id = e.creado_por
  left join usuarios um on um.id = e.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where e.empresa_id = $1 order by e.nombre asc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where e.id = $1 and e.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Estado no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre, clase_badge, activo } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del estado es requerido' });
    }

    const { rows } = await pool.query(
      `insert into estados_servicios_proveedores (empresa_id, nombre, clase_badge, activo, creado_por)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        req.empresaId,
        nombre.trim(),
        clase_badge || 'badge-slate',
        activo ?? true,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where e.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, clase_badge, activo } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del estado es requerido' });
    }

    const { rows: actual } = await pool.query(
      'select id from estados_servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Estado no encontrado' });

    await pool.query(
      `update estados_servicios_proveedores set
         nombre = $1,
         clase_badge = $2,
         activo = $3,
         modificado_por = $4
       where id = $5 and empresa_id = $6`,
      [
        nombre.trim(),
        clase_badge || 'badge-slate',
        activo ?? true,
        req.usuario.id,
        req.params.id,
        req.empresaId,
      ]
    );

    // Mantener sincronizado el texto legacy 'estado' en servicios_proveedores
    await pool.query(
      `update servicios_proveedores set estado = $1 where estado_id = $2 and empresa_id = $3`,
      [nombre.trim(), req.params.id, req.empresaId]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where e.id = $1`, [req.params.id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rows: servicios } = await pool.query(
      'select count(*)::int as count from servicios_proveedores where estado_id = $1',
      [req.params.id]
    );

    if (servicios[0] && servicios[0].count > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar el estado porque esta asignado a ${servicios[0].count} servicio(s).`
      });
    }

    const { rowCount } = await pool.query(
      'delete from estados_servicios_proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Estado no encontrado' });
    res.json({ ok: true, mensaje: 'Estado eliminado correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};
