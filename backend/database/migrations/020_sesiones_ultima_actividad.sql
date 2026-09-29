-- Migracion 020: el sistema de inactividad (15 min por defecto, ver
-- SESSION_INACTIVITY_LIMIT_MINUTES) era puramente del cliente -- si el
-- navegador se cerraba, se quedaba sin red o la maquina se suspendia
-- antes de que el temporizador JS pudiera avisarle al backend, la fila
-- de sesion se quedaba "activo = true" (EN CURSO en Auditoria) para
-- siempre, hasta que el JWT expirara solo (JWT_EXPIRES_IN, 8h por
-- defecto) o un admin la cerrara a mano.
--
-- Esta columna registra la ultima peticion autenticada real de esa
-- sesion (requireAuth la actualiza en cada request). Con eso, tanto
-- requireAuth como el listado de Auditoria pueden detectar y tratar
-- como cerrada una sesion abandonada mucho antes de que el JWT expire,
-- sin depender de que el navegador vuelva a conectarse.
alter table sesiones
    add column if not exists ultima_actividad timestamptz not null default now();

-- Sesiones ya existentes: se usa creado_en como ultima actividad conocida
-- (no hay otro dato mejor), asi las que ya estaban abandonadas por horas
-- se detectan como inactivas de inmediato en vez de esperar otros 15 min
-- desde el momento de esta migracion.
update sesiones set ultima_actividad = creado_en;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table sesiones drop column if exists ultima_actividad;
