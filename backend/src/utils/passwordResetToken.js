const crypto = require('crypto');
const { pool } = require('../config/db');

function generarTokenReset() {
  return 'rst_' + crypto.randomBytes(32).toString('hex');
}

// Crea un token de reset de un solo uso (1 hora) para el usuario indicado
// y devuelve el token generado -- usado tanto por el "olvide mi
// contrasena" self-service como por el reseteo que dispara un admin
// desde Usuarios.
async function crearTokenReset(usuarioId) {
  const token = generarTokenReset();
  const expiraEn = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
  await pool.query(
    'insert into password_reset_tokens (usuario_id, token, expira_en) values ($1, $2, $3)',
    [usuarioId, token, expiraEn]
  );
  return token;
}

module.exports = { generarTokenReset, crearTokenReset };
