function notFound(req, res, next) {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === '23505') {
    return res.status(409).json({ mensaje: 'El registro ya existe (violacion de unicidad).', detalle: err.detail });
  }
  if (err.code === '23503') {
    return res.status(409).json({ mensaje: 'Operacion invalida: referencia a un registro relacionado.', detalle: err.detail });
  }
  if (err.code === '23514') {
    if (err.constraint === 'chk_fechas') {
      return res.status(400).json({ mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
    }
    return res.status(400).json({ mensaje: 'Dato invalido: no cumple una restriccion de la tabla.', detalle: err.detail });
  }

  res.status(err.status || 500).json({ mensaje: err.mensaje || err.message || 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
