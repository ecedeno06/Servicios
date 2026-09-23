const { pool } = require('../config/db');
const { obtenerPolitica } = require('../utils/politicaPassword');

// GET /api/politica-password -- publico (sin requireAuth): el formulario
// de cambio de contrasena necesita mostrar/validar los requisitos. No
// expone nada sensible, solo la configuracion de forma.
async function obtener(req, res, next) {
  try {
    res.json(await obtenerPolitica());
  } catch (err) { next(err); }
}

// PUT /api/politica-password -- solo super admin.
async function actualizar(req, res, next) {
  try {
    const {
      longitud_minima, mayuscula_minima, minuscula_minima, requiere_numero,
      requiere_caracter_especial, caracteres_numericos, caracteres_especiales,
      pista_longitud_minima, pista_similitud_maxima_porcentaje,
    } = req.body;

    const { rows } = await pool.query(
      `update politica_password set
         longitud_minima = coalesce($1, longitud_minima),
         mayuscula_minima = coalesce($2, mayuscula_minima),
         minuscula_minima = coalesce($3, minuscula_minima),
         requiere_numero = coalesce($4, requiere_numero),
         requiere_caracter_especial = coalesce($5, requiere_caracter_especial),
         caracteres_numericos = coalesce($6, caracteres_numericos),
         caracteres_especiales = coalesce($7, caracteres_especiales),
         pista_longitud_minima = coalesce($8, pista_longitud_minima),
         pista_similitud_maxima_porcentaje = coalesce($9, pista_similitud_maxima_porcentaje),
         updated_at = now()
       where id = 1
       returning *`,
      [longitud_minima, mayuscula_minima, minuscula_minima, requiere_numero, requiere_caracter_especial, caracteres_numericos, caracteres_especiales, pista_longitud_minima, pista_similitud_maxima_porcentaje]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23514') return res.status(400).json({ mensaje: 'Alguno de los valores esta fuera de rango.' });
    next(err);
  }
}

module.exports = { obtener, actualizar };
