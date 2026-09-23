const jwt = require('jsonwebtoken');

// Rutas que siguen accesibles aunque el token traiga debe_cambiar_password
// -- sin esto el usuario quedaria atrapado sin poder ni cambiar su propia
// contrasena ni cerrar sesion.
const RUTAS_EXENTAS_CAMBIO_PASSWORD = ['/api/auth/password', '/api/auth/me'];

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, nombre, email, rol, empresa_id, cliente_id, es_super_admin, debe_cambiar_password } o { id, nombre, email, parcial: true }

    if (payload.debe_cambiar_password) {
      const ruta = (req.originalUrl || '').split('?')[0];
      if (!RUTAS_EXENTAS_CAMBIO_PASSWORD.includes(ruta)) {
        return res.status(403).json({ mensaje: 'Debes cambiar tu contrasena antes de continuar', requiereCambioPassword: true });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token invalido o expirado' });
  }
}

function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tienes permisos para esta accion' });
    }
    next();
  };
}

// Deja disponible req.empresaId a partir de la empresa activa del token, y
// req.clienteId cuando el rol activo es 'cliente' (null para el resto).
// Bloquea tokens parciales (login pendiente de seleccionar empresa) y a
// usuarios sin ninguna empresa activa asociada.
function requireEmpresa(req, res, next) {
  if (!req.usuario || !req.usuario.empresa_id) {
    return res.status(403).json({ mensaje: 'La sesion no tiene una empresa activa seleccionada' });
  }
  req.empresaId = req.usuario.empresa_id;
  req.clienteId = req.usuario.rol === 'cliente' ? req.usuario.cliente_id : null;
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.usuario || !req.usuario.es_super_admin) {
    return res.status(403).json({ mensaje: 'Requiere permisos de super administrador' });
  }
  next();
}

// Bloquea al rol 'cliente' de acciones que no le corresponden (crear
// registros, ver el listado de contratos, etc.) sin tener que enumerar
// el resto de roles en cada ruta.
function bloquearCliente(req, res, next) {
  if (req.usuario?.rol === 'cliente') {
    return res.status(403).json({ mensaje: 'Tu usuario no tiene permisos para esta accion' });
  }
  next();
}

module.exports = { requireAuth, requireRol, requireEmpresa, requireSuperAdmin, bloquearCliente };
