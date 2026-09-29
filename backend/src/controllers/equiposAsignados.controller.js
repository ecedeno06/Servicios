const { pool } = require('../config/db');

const SELECT_BASE = `
  select
    ea.*,
    p.nombre as producto_nombre,
    c.nombre as categoria_nombre,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre
  from equipos_asignados ea
  join productos p on p.id = ea.producto_id
  join categorias c on c.id = p.categoria_id
  join usuarios uc on uc.id = ea.creado_por
  left join usuarios um on um.id = ea.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where ea.empresa_id = $1 order by ea.created_at desc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { producto_id, marca, modelo, fecha_entrada, vida_util_meses, estado, asignada_a, observacion } = req.body;
    if (!producto_id || !marca || !modelo) {
      return res.status(400).json({ mensaje: 'producto_id, marca y modelo son requeridos' });
    }
    const { rows } = await pool.query(
      `insert into equipos_asignados
         (empresa_id, producto_id, marca, modelo, fecha_entrada, vida_util_meses, estado, asignada_a, observacion, creado_por)
       values ($1,$2,$3,$4, coalesce($5, current_date), $6, coalesce($7, 'stock'), $8, $9, $10)
       returning id`,
      [req.empresaId, producto_id, marca, modelo, fecha_entrada, vida_util_meses || null, estado, asignada_a || null, observacion || null, req.usuario.id]
    );
    const { rows: completo } = await pool.query(`${SELECT_BASE} where ea.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

// El formulario del frontend siempre manda el registro completo (no es un
// patch parcial), asi que aqui se reemplazan los campos tal cual vienen
// -- sin coalesce -- para poder limpiar vida_util_meses/asignada_a/
// observacion con null cuando el usuario los deja vacios.
async function actualizar(req, res, next) {
  try {
    const { producto_id, marca, modelo, fecha_entrada, vida_util_meses, estado, asignada_a, observacion } = req.body;
    if (!producto_id || !marca || !modelo || !estado) {
      return res.status(400).json({ mensaje: 'producto_id, marca, modelo y estado son requeridos' });
    }
    const { rows } = await pool.query(
      `update equipos_asignados set
         producto_id = $1,
         marca = $2,
         modelo = $3,
         fecha_entrada = coalesce($4, fecha_entrada),
         vida_util_meses = $5,
         estado = $6,
         asignada_a = $7,
         observacion = $8,
         modificado_por = $9
       where id = $10 and empresa_id = $11
       returning id`,
      [producto_id, marca, modelo, fecha_entrada, vida_util_meses || null, estado, asignada_a || null, observacion || null, req.usuario.id, req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });
    const { rows: completo } = await pool.query(`${SELECT_BASE} where ea.id = $1`, [rows[0].id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from equipos_asignados where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Equipo asignado no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { listar, crear, actualizar, eliminar };
