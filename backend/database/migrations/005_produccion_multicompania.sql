-- =========================================================
-- Migracion 005: multicompania para produccion (Supabase)
--
-- Lleva el esquema original (mono-tenant) directo al estado final
-- documentado en schema.sql: empresas + usuarios_empresas_rol +
-- empresa_id, con borrado fisico (sin columnas "activo" extra ni
-- indices unicos parciales -- esos fueron pasos intermedios que se
-- probaron y luego se revirtieron en desarrollo local, no aplican aca).
--
-- Idempotente: puede correr mas de una vez sin romper nada.
-- =========================================================

-- 1. Tabla empresas
create table if not exists empresas (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    identificacion  text unique,
    email           text,
    telefono        text,
    direccion       text,
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- 2. Empresa por defecto (solo si todavia no existe ninguna)
insert into empresas (nombre)
select 'Empresa Principal'
where not exists (select 1 from empresas);

-- 3. empresa_id nullable en tablas existentes (se pone NOT NULL luego del backfill)
alter table clientes        add column if not exists empresa_id uuid references empresas(id);
alter table tipos_servicio  add column if not exists empresa_id uuid references empresas(id);
alter table contratos       add column if not exists empresa_id uuid references empresas(id);
alter table registro_horas  add column if not exists empresa_id uuid references empresas(id);

-- 4. Backfill de empresa_id con la empresa por defecto
update clientes       set empresa_id = (select id from empresas order by created_at limit 1) where empresa_id is null;
update tipos_servicio set empresa_id = (select id from empresas order by created_at limit 1) where empresa_id is null;
update contratos      set empresa_id = (select id from empresas order by created_at limit 1) where empresa_id is null;
update registro_horas set empresa_id = (select id from empresas order by created_at limit 1) where empresa_id is null;

-- 5. Tabla usuarios_empresas_rol (relacion N:M, rol es atributo de la relacion)
create table if not exists usuarios_empresas_rol (
    id              uuid primary key default gen_random_uuid(),
    usuario_id      uuid not null references usuarios(id) on delete cascade,
    empresa_id      uuid not null references empresas(id) on delete cascade,
    rol             text not null check (rol in ('admin', 'supervisor', 'tecnico')) default 'tecnico',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (usuario_id, empresa_id)
);

create index if not exists idx_usuarios_empresas_rol_usuario on usuarios_empresas_rol(usuario_id);
create index if not exists idx_usuarios_empresas_rol_empresa on usuarios_empresas_rol(empresa_id);

-- 6. Backfill de usuarios_empresas_rol desde usuarios.rol (solo si la columna todavia existe)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'usuarios' and column_name = 'rol') then
    insert into usuarios_empresas_rol (usuario_id, empresa_id, rol)
    select u.id, (select id from empresas order by created_at limit 1), u.rol
    from usuarios u
    where not exists (select 1 from usuarios_empresas_rol uer where uer.usuario_id = u.id);
  end if;
end $$;

-- 7. es_super_admin en usuarios
alter table usuarios add column if not exists es_super_admin boolean not null default false;

-- 8. empresa_id NOT NULL (ya poblados en el paso 4)
alter table clientes        alter column empresa_id set not null;
alter table tipos_servicio  alter column empresa_id set not null;
alter table contratos       alter column empresa_id set not null;
alter table registro_horas  alter column empresa_id set not null;

-- 9. unique globales -> unique por empresa
alter table clientes       drop constraint if exists clientes_identificacion_key;
alter table tipos_servicio drop constraint if exists tipos_servicio_nombre_key;
alter table contratos      drop constraint if exists contratos_numero_contrato_key;

alter table clientes       add constraint uq_clientes_empresa_identificacion unique (empresa_id, identificacion);
alter table tipos_servicio add constraint uq_tipos_servicio_empresa_nombre unique (empresa_id, nombre);
alter table contratos      add constraint uq_contratos_empresa_numero unique (empresa_id, numero_contrato);

-- 10. Eliminar usuarios.rol (ya migrado a usuarios_empresas_rol en el paso 6)
alter table usuarios drop column if exists rol;

-- 11. Indices por empresa_id
create index if not exists idx_clientes_empresa on clientes(empresa_id);
create index if not exists idx_tipos_servicio_empresa on tipos_servicio(empresa_id);
create index if not exists idx_contratos_empresa on contratos(empresa_id);
create index if not exists idx_registro_horas_empresa on registro_horas(empresa_id);

-- 12. Vista vista_consumo_horas actualizada con empresa_id
drop view if exists vista_consumo_horas;
create view vista_consumo_horas as
select
    cs.id                   as contrato_servicio_id,
    c.id                    as contrato_id,
    c.empresa_id,
    c.numero_contrato,
    c.estado                as estado_contrato,
    cl.id                   as cliente_id,
    cl.nombre               as cliente_nombre,
    ts.id                   as tipo_servicio_id,
    ts.nombre               as tipo_servicio_nombre,
    cs.horas_contratadas,
    coalesce(sum(rh.horas), 0)                              as horas_ejecutadas,
    cs.horas_contratadas - coalesce(sum(rh.horas), 0)       as horas_disponibles
from contrato_servicios cs
join contratos c        on c.id = cs.contrato_id
join clientes cl         on cl.id = c.cliente_id
join tipos_servicio ts   on ts.id = cs.tipo_servicio_id
left join registro_horas rh
       on rh.contrato_id = cs.contrato_id
      and rh.tipo_servicio_id = cs.tipo_servicio_id
group by cs.id, c.id, c.empresa_id, c.numero_contrato, c.estado, cl.id, cl.nombre, ts.id, ts.nombre, cs.horas_contratadas;

-- 13. Trigger de updated_at para las tablas nuevas (la funcion set_updated_at ya existe)
do $$
declare
    t text;
begin
    foreach t in array array['empresas','usuarios_empresas_rol']
    loop
        execute format('drop trigger if exists trg_set_updated_at on %I', t);
        execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
    end loop;
end $$;
