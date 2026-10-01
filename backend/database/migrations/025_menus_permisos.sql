-- Migracion 025: catalogo de menus/acciones y la matriz rol x menu x
-- permiso. Las 3 pantallas de configuracion cross-empresa (Empresas,
-- Politica de password, Equipos/catalogo) quedan afuera a proposito --
-- siguen gateadas solo por es_super_admin, no por esta matriz (ver plan).
create table if not exists permisos (
    id      serial primary key,
    codigo  text not null unique,
    nombre  text not null
);

insert into permisos (codigo, nombre) values
    ('ver', 'Ver'),
    ('crear', 'Crear'),
    ('editar', 'Editar'),
    ('eliminar', 'Eliminar')
on conflict (codigo) do nothing;

create table if not exists menus (
    id          serial primary key,
    codigo      text not null unique,
    nombre      text not null,
    ruta        text,
    icono       text,
    padre_id    integer references menus(id) on delete cascade,
    orden       integer not null default 0,
    activo      boolean not null default true
);

insert into menus (codigo, nombre, ruta, icono, orden) values
    ('dashboard', 'Resumen', '/dashboard', 'dashboard', 10),
    ('contratos', 'Contratos', '/contratos', 'contratos', 20),
    ('horas', 'Registro de horas', '/horas', 'horas', 30),
    ('reportes', 'Reportes', '/reportes', 'reportes', 40),
    ('clientes', 'Clientes', '/clientes', 'clientes', 50),
    ('tipos_servicio', 'Tipos de servicio', '/tipos-servicio', 'tipos_servicio', 60),
    ('usuarios', 'Usuarios', '/usuarios', 'usuarios', 70),
    ('equipos_asignados', 'Equipos asignados', '/equipos-asignados', 'equipos_asignados', 80),
    ('auditoria_sesiones', 'Auditoria de sesiones', '/auditoria-sesiones', 'auditoria_sesiones', 90)
on conflict (codigo) do nothing;

create table if not exists rol_menu_permisos (
    id          serial primary key,
    rol_id      integer not null references roles(id) on delete cascade,
    menu_id     integer not null references menus(id) on delete cascade,
    permiso_id  integer not null references permisos(id) on delete cascade,
    unique (rol_id, menu_id, permiso_id)
);

create index if not exists idx_rol_menu_permisos_rol on rol_menu_permisos(rol_id);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists rol_menu_permisos;
-- drop table if exists menus;
-- drop table if exists permisos;
