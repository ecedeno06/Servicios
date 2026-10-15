const { pool } = require('../config/db');

const SELECT_BASE = `
  select
    c.*,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre
  from checklists c
  join usuarios uc on uc.id = c.creado_por
  left join usuarios um on um.id = c.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where c.empresa_id = $1 order by c.descripcion asc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where c.id = $1 and c.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Checklist no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { descripcion, observacion, activo } = req.body;
    if (!descripcion) {
      return res.status(400).json({ mensaje: 'La descripcion es requerida' });
    }

    const { rows } = await pool.query(
      `insert into checklists (empresa_id, descripcion, observacion, activo, creado_por)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        req.empresaId,
        descripcion.trim(),
        observacion ? observacion.trim() : null,
        activo ?? true,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { descripcion, observacion, activo } = req.body;
    if (!descripcion) {
      return res.status(400).json({ mensaje: 'La descripcion es requerida' });
    }

    const { rows: actual } = await pool.query(
      'select id from checklists where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Checklist no encontrado' });

    await pool.query(
      `update checklists set
         descripcion = $1,
         observacion = $2,
         activo = $3,
         modificado_por = $4
       where id = $5 and empresa_id = $6`,
      [
        descripcion.trim(),
        observacion ? observacion.trim() : null,
        activo ?? true,
        req.usuario.id,
        req.params.id,
        req.empresaId,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [req.params.id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from checklists where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Checklist no encontrado' });
    res.json({ ok: true, mensaje: 'Checklist eliminado correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};
