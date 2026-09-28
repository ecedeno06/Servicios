const { pool } = require('../config/db');

// Solo super-admin (ve todas las empresas) o el rol 'admin' de una empresa
// (solo ve/actua sobre su propia empresa) pueden consultar o actuar sobre
// la auditoria de sesiones.
function puedeVerAuditoria(req) {
  return !!req.usuario?.es_super_admin || req.usuario?.rol === 'admin';
}

/**
 * GET /api/auditoria/sesiones?desde=&hasta=&usuario=
 *
 * Como no hay un job que cierre sesiones cuando el JWT simplemente expira
 * sin que el usuario haga logout explicito, se calculan 3 situaciones
 * posibles en vez de confiar solo en las columnas guardadas:
 *   1) activo = false             -> ya se cerro, se usa razon_salida/duracion_segundos tal cual.
 *   2) activo = true, sin expirar -> sesion todavia en curso.
 *   3) activo = true, expirada    -> quedo abandonada (nadie hizo logout) antes de vencer.
 *
 * Un 'admin' (no super-admin) solo ve las sesiones de su propia empresa.
 */
async function listarSesiones(req, res, next) {
  try {
    if (!puedeVerAuditoria(req)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para consultar la auditoria de sesiones' });
    }

    const { desde, hasta, usuario } = req.query;
    const condiciones = [];
    const valores = [req.token];

    if (!req.usuario.es_super_admin) {
      valores.push(req.usuario.empresa_id);
      condiciones.push(`s.empresa_id = $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`s.creado_en::date >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`s.creado_en::date <= $${valores.length}`);
    }
    if (usuario) {
      valores.push(`%${usuario}%`);
      condiciones.push(`(u.nombre ilike $${valores.length} or u.email ilike $${valores.length})`);
    }

    const where = condiciones.length ? `where ${condiciones.join(' and ')}` : '';

    const { rows } = await pool.query(
      `select
         s.id,
         s.usuario_id,
         u.nombre as usuario_nombre,
         u.email as usuario_email,
         s.rol,
         e.nombre as empresa_nombre,
         s.ip_address,
         s.geo_pais,
         s.geo_region,
         s.geo_ciudad,
         s.geo_lat,
         s.geo_lon,
         (s.token = $1) as es_sesion_actual,
         s.creado_en as login_en,
         s.activo,
         case when s.activo = false
           then s.creado_en + (coalesce(s.duracion_segundos, 0) || ' seconds')::interval
         end as logout_en,
         case
           when s.activo = false then s.duracion_segundos
           when s.expira_en <= now() then extract(epoch from (s.expira_en - s.creado_en))::integer
           else extract(epoch from (now() - s.creado_en))::integer
         end as duracion_segundos,
         case
           when s.activo = false then coalesce(s.razon_salida, 'logout_usuario')
           when s.expira_en <= now() then 'expirada_sin_cerrar'
           else 'en_curso'
         end as motivo_salida
       from sesiones s
       join usuarios u on u.id = s.usuario_id
       left join empresas e on e.id = s.empresa_id
       ${where}
       order by s.creado_en desc`,
      valores
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auditoria/sesiones/cerrar { ids: string[] }
 * Cierra a la fuerza las sesiones indicadas ("terminar sesion" desde la
 * pantalla de Auditoria). Un 'admin' solo puede cerrar sesiones de su
 * propia empresa.
 */
async function cerrarSesiones(req, res, next) {
  try {
    if (!puedeVerAuditoria(req)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para cerrar sesiones' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ mensaje: 'Debes indicar al menos una sesion' });
    }

    const condiciones = ['id = any($1::uuid[])', 'activo = true'];
    const valores = [ids];

    if (!req.usuario.es_super_admin) {
      valores.push(req.usuario.empresa_id);
      condiciones.push(`empresa_id = $${valores.length}`);
    }

    const { rowCount } = await pool.query(
      `update sesiones
       set activo = false,
           razon_salida = 'cerrada_por_admin',
           duracion_segundos = extract(epoch from (now() - creado_en))::integer
       where ${condiciones.join(' and ')}`,
      valores
    );

    res.json({ cerradas: rowCount });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auditoria/usuarios/:id/bloquear
 * Desactiva la cuenta (no podra volver a iniciar sesion, mismo flag
 * "activo" que usa la pantalla de Usuarios) y cierra de inmediato todas
 * sus sesiones activas. Un 'admin' solo puede bloquear usuarios de su
 * propia empresa.
 */
async function bloquearUsuario(req, res, next) {
  try {
    if (!puedeVerAuditoria(req)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para bloquear usuarios' });
    }

    const { id } = req.params;
    if (id === req.usuario.id) {
      return res.status(400).json({ mensaje: 'No puedes bloquear tu propia cuenta' });
    }

    if (!req.usuario.es_super_admin) {
      const { rows } = await pool.query(
        'select 1 from usuarios_empresas_rol where usuario_id = $1 and empresa_id = $2',
        [id, req.usuario.empresa_id]
      );
      if (!rows[0]) return res.status(403).json({ mensaje: 'No tienes permiso sobre ese usuario' });
    }

    const { rows } = await pool.query('update usuarios set activo = false where id = $1 returning nombre', [id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    await pool.query(
      `update sesiones
       set activo = false,
           razon_salida = 'cerrada_por_admin',
           duracion_segundos = extract(epoch from (now() - creado_en))::integer
       where usuario_id = $1 and activo = true`,
      [id]
    );

    res.json({ mensaje: `Se bloqueo el acceso de ${rows[0].nombre} y se cerraron sus sesiones activas.` });
  } catch (err) {
    next(err);
  }
}

module.exports = { listarSesiones, cerrarSesiones, bloquearUsuario };
