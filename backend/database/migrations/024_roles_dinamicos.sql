-- Migracion 024: roles dinamicos. Hasta ahora el rol de
-- usuarios_empresas_rol estaba fijo a 4 valores por un CHECK; se reemplaza
-- por una tabla "roles" + FK, para que un super-admin pueda crear roles
-- nuevos desde la UI. La columna usuarios_empresas_rol.rol sigue siendo
-- texto (el mismo "codigo" de rol) -- nada de lo que hoy compara
-- req.usuario.rol === 'admin'/'cliente' en el codigo existente cambia.
create table if not exists roles (
    id          serial primary key,
    codigo      text not null unique,
    nombre      text not null,
    -- Los 4 roles originales son "de sistema": no se pueden borrar ni
    -- renombrar su codigo, porque hay logica propia del codebase que
    -- depende literalmente de esos strings (ej. scoping de datos del
    -- rol 'cliente', o que un super-admin que selecciona empresa recibe
    -- 'admin' para esa sesion).
    es_sistema  boolean not null default false,
    activo      boolean not null default true,
    created_at  timestamptz not null default now()
);

insert into roles (codigo, nombre, es_sistema) values
    ('admin', 'Administrador', true),
    ('supervisor', 'Supervisor', true),
    ('tecnico', 'Tecnico', true),
    ('cliente', 'Cliente', true)
on conflict (codigo) do nothing;

alter table usuarios_empresas_rol drop constraint if exists usuarios_empresas_rol_rol_check;
alter table usuarios_empresas_rol
    add constraint usuarios_empresas_rol_rol_fkey foreign key (rol) references roles(codigo);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table usuarios_empresas_rol drop constraint if exists usuarios_empresas_rol_rol_fkey;
-- alter table usuarios_empresas_rol add constraint usuarios_empresas_rol_rol_check
--     check (rol in ('admin', 'supervisor', 'tecnico', 'cliente'));
-- drop table if exists roles;
