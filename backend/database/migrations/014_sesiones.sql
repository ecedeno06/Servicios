-- Migracion 014: auditoria de sesiones, portada del proyecto "agro 1.1".
--
-- Servicio-Horas usaba JWT sin estado (sin tabla de sesiones, sin logout
-- real en el backend) -- esta migracion agrega el registro de sesiones
-- necesario para poder auditar quien entro, desde donde, y para poder
-- cerrar sesiones activas / bloquear el acceso de un usuario de verdad
-- (no solo cosmeticamente): requireAuth ahora valida en esta tabla en
-- cada peticion, ademas de la firma del JWT.
create table if not exists sesiones (
    id                 uuid primary key default gen_random_uuid(),
    token              text not null unique,
    usuario_id         uuid not null references usuarios(id) on delete cascade,
    -- Empresa activa al momento de iniciar sesion (null para un
    -- super-admin sin ninguna empresa asignada). Acota lo que ve un
    -- admin normal (no super-admin) en la pantalla de auditoria.
    empresa_id         uuid references empresas(id) on delete set null,
    rol                text,
    activo             boolean not null default true,
    razon_salida       text,
    duracion_segundos  integer,
    ip_address         text,
    geo_pais           text,
    geo_region         text,
    geo_ciudad         text,
    geo_lat            double precision,
    geo_lon            double precision,
    creado_en          timestamptz not null default now(),
    expira_en          timestamptz not null
);

create index if not exists idx_sesiones_usuario on sesiones(usuario_id);
create index if not exists idx_sesiones_empresa on sesiones(empresa_id);
create index if not exists idx_sesiones_token_activo on sesiones(token) where activo = true;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists sesiones;
