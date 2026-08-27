const { pool } = require('../config/db');

// Calcula las horas ejecutadas (decimal) a partir de "HH:MM" - "HH:MM".
// Retorna null si el rango es invalido (fin <= inicio).
function calcularHoras(horaInicio, horaFin) {
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutos <= 0) return null;
  return Math.round((minutos / 60) * 100) / 100;
}

// GET /api/horas?contrato_id=&tipo_servicio_id=&usuario_id=&desde=&hasta=
async function listar(req, res, next) {
  try {
    const { contrato_id, tipo_servicio_id, usuario_id, desde, hasta } = req.query;
    const condiciones = [];
    const valores = [];

    if (contrato_id) { valores.push(contrato_id); condiciones.push(`rh.contrato_id = $${valores.length}`); }
    if (tipo_servicio_id) { valores.push(tipo_servicio_id); condiciones.push(`rh.tipo_servicio_id = $${valores.length}`); }
    if (usuario_id) { valores.push(usuario_id); condiciones.push(`rh.usuario_id = $${valores.length}`); }
    if (desde) { valores.push(desde); condiciones.push(`rh.fecha >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`rh.fecha <= $${valores.length}`); }

    const where = condiciones.length ? `where ${condiciones.join(' and ')}` : '';

    const { rows } = await pool.query(
      `select rh.*, c.numero_contrato, cl.nombre as cliente_nombre,
              ts.nombre as tipo_servicio_nombre, u.nombre as usuario_nombre
       from registro_horas rh
       join contratos c on c.id = rh.contrato_id
       join clientes cl on cl.id = c.cliente_id
       join tipos_servicio ts on ts.id = rh.tipo_servicio_id
       join usuarios u on u.id = rh.usuario_id
       ${where}
       order by rh.fecha desc, rh.created_at desc`,
      valores
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtener(req, res, next) {
  try {
    const { rows } = await pool.query('select * from registro_horas where id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// POST /api/horas
// Valida que exista una "bolsa" de horas (contrato_servicios) para ese
// contrato + tipo de servicio antes de permitir registrar la ejecucion.
async function crear(req, res, next) {
  try {
    const { contrato_id, tipo_servicio_id, fecha, hora_inicio, hora_fin, descripcion, documentos } = req.body;
    const usuario_id = req.body.usuario_id || req.usuario.id; // por defecto quien ejecuta la peticion

    if (!hora_inicio || !hora_fin) {
      return res.status(400).json({ mensaje: 'Hora de inicio y hora de fin son requeridas.' });
    }
    const horas = calcularHoras(hora_inicio, hora_fin);
    if (horas === null) {
      return res.status(400).json({ mensaje: 'La hora de fin debe ser posterior a la hora de inicio.' });
    }

    const bolsa = await pool.query(
      `select id, horas_contratadas from contrato_servicios
       where contrato_id = $1 and tipo_servicio_id = $2`,
      [contrato_id, tipo_servicio_id]
    );
    if (!bolsa.rows[0]) {
      return res.status(400).json({
        mensaje: 'Este contrato no tiene horas establecidas para el tipo de servicio indicado. Agrega primero las horas contratadas.',
      });
    }

    const { rows } = await pool.query(
      `insert into registro_horas (contrato_id, tipo_servicio_id, usuario_id, fecha, hora_inicio, hora_fin, horas, descripcion, documentos)
       values ($1,$2,$3, coalesce($4, current_date), $5, $6, $7, $8, coalesce($9,'[]'::jsonb)) returning *`,
      [contrato_id, tipo_servicio_id, usuario_id, fecha, hora_inicio, hora_fin, horas, descripcion, documentos ? JSON.stringify(documentos) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { fecha, hora_inicio, hora_fin, descripcion, documentos } = req.body;

    let horas = null;
    if (hora_inicio && hora_fin) {
      horas = calcularHoras(hora_inicio, hora_fin);
      if (horas === null) {
        return res.status(400).json({ mensaje: 'La hora de fin debe ser posterior a la hora de inicio.' });
      }
    }

    const { rows } = await pool.query(
      `update registro_horas set
         fecha = coalesce($1, fecha),
         hora_inicio = coalesce($2, hora_inicio),
         hora_fin = coalesce($3, hora_fin),
         horas = coalesce($4, horas),
         descripcion = coalesce($5, descripcion),
         documentos = coalesce($6, documentos)
       where id = $7 returning *`,
      [fecha, hora_inicio, hora_fin, horas, descripcion, documentos ? JSON.stringify(documentos) : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query('delete from registro_horas where id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

// GET /api/horas/consumo  -> resumen de horas por servicio de TODOS los contratos
async function consumoGeneral(req, res, next) {
  try {
    const { rows } = await pool.query('select * from vista_consumo_horas order by cliente_nombre, tipo_servicio_nombre');
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/horas/consumo/:contratoId  -> resumen de horas por servicio de un contrato
async function consumoPorContrato(req, res, next) {
  try {
    const { rows } = await pool.query(
      'select * from vista_consumo_horas where contrato_id = $1 order by tipo_servicio_nombre',
      [req.params.contratoId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, consumoPorContrato, consumoGeneral };
