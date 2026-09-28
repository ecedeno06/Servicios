const { pool } = require('../config/db');
const { obtenerGeoIP } = require('./geoip');

// Crea la fila de sesion que respalda un token recien firmado. No se llama
// para un token parcial (login pendiente de seleccionar empresa) -- solo
// cuando el login queda completo. expiraEn debe venir del claim "exp" del
// JWT ya firmado (jwt.decode(token).exp * 1000), para que quede en sync
// exacto con cuando el propio token deja de ser valido.
async function crearSesion({ token, usuarioId, empresaId, rol, ip, expiraEn }) {
  const geo = await obtenerGeoIP(ip);
  await pool.query(
    `insert into sesiones (token, usuario_id, empresa_id, rol, ip_address, geo_pais, geo_region, geo_ciudad, geo_lat, geo_lon, expira_en)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [token, usuarioId, empresaId, rol, ip, geo.pais, geo.region, geo.ciudad, geo.lat, geo.lon, expiraEn]
  );
}

// cambiarPassword() reemite el token (debe_cambiar_password=false) para
// desbloquear de inmediato -- la sesion sigue siendo la misma, solo
// cambia que bearer token la identifica, asi que se actualiza en vez de
// crear una fila nueva (conserva creado_en/ip/geo originales).
async function reemplazarTokenSesion(tokenViejo, tokenNuevo, expiraEn) {
  await pool.query('update sesiones set token = $1, expira_en = $2 where token = $3 and activo = true', [tokenNuevo, expiraEn, tokenViejo]);
}

async function cerrarSesionActual(token, razon = 'logout_usuario') {
  await pool.query(
    `update sesiones set activo = false, razon_salida = $2,
       duracion_segundos = extract(epoch from (now() - creado_en))::integer
     where token = $1 and activo = true`,
    [token, razon]
  );
}

module.exports = { crearSesion, reemplazarTokenSesion, cerrarSesionActual };
