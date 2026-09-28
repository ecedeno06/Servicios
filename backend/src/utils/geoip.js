// Geolocalizacion aproximada por IP (ip-api.com, gratuito) -- sin pedir
// permiso al usuario, solo para mostrar en Auditoria de sesiones donde
// entro cada quien. Precision a nivel de ciudad, no GPS.
const IP_API_URL = 'http://ip-api.com/json';
const TIMEOUT_MS = 3000;

function obtenerIpCliente(req) {
  const ip = req.ip || req.connection?.remoteAddress || null;
  return ip ? ip.replace('::ffff:', '') : null;
}

function esIpPrivada(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

async function obtenerGeoIP(ip) {
  const vacio = { pais: null, region: null, ciudad: null, lat: null, lon: null };
  if (esIpPrivada(ip)) return vacio;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `${IP_API_URL}/${encodeURIComponent(ip)}?fields=status,country,regionName,city,lat,lon`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const data = await response.json();
    if (data.status !== 'success') return vacio;

    return {
      pais: data.country || null,
      region: data.regionName || null,
      ciudad: data.city || null,
      lat: typeof data.lat === 'number' ? data.lat : null,
      lon: typeof data.lon === 'number' ? data.lon : null,
    };
  } catch (error) {
    console.error('Error al geolocalizar IP:', error.message);
    return vacio;
  }
}

module.exports = { obtenerIpCliente, obtenerGeoIP };
