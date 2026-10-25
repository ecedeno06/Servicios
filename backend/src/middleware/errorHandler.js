const { registrarError } = require('../controllers/logs.controller');

function notFound(req, res, next) {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  let statusHttp = err.status || 500;
  let body = { mensaje: err.mensaje || err.message || 'Error interno del servidor' };

  if (err.code === '23505') {
    statusHttp = 409;
    body = { mensaje: 'El registro ya existe (violacion de unicidad).', detalle: err.detail };
  } else if (err.code === '23503') {
    statusHttp = 409;
    body = { mensaje: 'Operacion invalida: referencia a un registro relacionado.', detalle: err.detail };
  } else if (err.code === '23514') {
    statusHttp = 400;
    body =
      err.constraint === 'chk_fechas'
        ? { mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.' }
        : { mensaje: 'Dato invalido: no cumple una restriccion de la tabla.', detalle: err.detail };
  }

  registrarError(req, err, statusHttp);
  res.status(statusHttp).json(body);
}

module.exports = { notFound, errorHandler };
