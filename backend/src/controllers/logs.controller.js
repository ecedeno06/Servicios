const { pool } = require('../config/db');

const CAMPOS_SENSIBLES = ['password', 'password_actual', 'password_nueva', 'password_confirmar', 'token', 'authorization'];

function sanitizarBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const limpio = {};
  for (const [k, v] of Object.entries(body)) {
    limpio[k] = CAMPOS_SENSIBLES.includes(k.toLowerCase()) ? '[OCULTO]' : v;
  }
  return limpio;
}

// Llamado desde el error-handler global (backend/src/middleware/errorHandler.js)
// con el status/response ya resueltos -- nunca debe tirar: si el insert
// falla, solo se loguea por consola y la respuesta de error original (ya
// enviada por errorHandler) no se ve afectada.
function registrarError(req, err, statusHttp) {
  pool
    .query(
      `insert into logs_errores
         (nivel, mensaje, stack, codigo, metodo_http, ruta, status_http, empresa_id, usuario_id, ip_address, body)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'error',
        err.mensaje || err.message || 'Error interno del servidor',
        err.stack || null,
        err.code || null,
        req.method,
        req.originalUrl,
        statusHttp,
        req.empresaId || req.usuario?.empresa_id || null,
        req.usuario?.id || null,
        req.ip,
        JSON.stringify(sanitizarBody(req.body)),
      ]
    )
    .catch((e) => console.error('No se pudo registrar el log de error', e));
}

// GET /api/logs?desde=&hasta=&nivel=&ruta=&mensaje=
async function listar(req, res, next) {
  try {
    const { desde, hasta, nivel, ruta, mensaje } = req.query;
    const condiciones = [];
    const valores = [];

    if (desde) {
      valores.push(desde);
      condiciones.push(`l.created_at::date >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`l.created_at::date <= $${valores.length}`);
    }
    if (nivel) {
      valores.push(nivel);
      condiciones.push(`l.nivel = $${valores.length}`);
    }
    if (ruta) {
      valores.push(`%${ruta}%`);
      condiciones.push(`l.ruta ilike $${valores.length}`);
    }
    if (mensaje) {
      valores.push(`%${mensaje}%`);
      condiciones.push(`l.mensaje ilike $${valores.length}`);
    }

    const where = condiciones.length ? `where ${condiciones.join(' and ')}` : '';

    const { rows } = await pool.query(
      `select
         l.*,
         u.nombre as usuario_nombre,
         u.email as usuario_email,
         e.nombre as empresa_nombre
       from logs_errores l
       left join usuarios u on u.id = l.usuario_id
       left join empresas e on e.id = l.empresa_id
       ${where}
       order by l.created_at desc
       limit 500`,
      valores
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/logs/eliminar { ids: string[] }
async function eliminar(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ mensaje: 'Debes indicar al menos un log' });
    }
    const { rowCount } = await pool.query('delete from logs_errores where id = any($1::uuid[])', [ids]);
    res.json({ eliminados: rowCount });
  } catch (err) {
    next(err);
  }
}

module.exports = { registrarError, listar, eliminar };
