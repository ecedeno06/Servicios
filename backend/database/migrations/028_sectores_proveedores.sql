-- Migracion 028: tabla sectores_proveedores y vinculacion con proveedores.

create table if not exists sectores_proveedores (
    id              uuid primary key default gen_random_uuid(),
    empresa_id      uuid not null references empresas(id) on delete cascade,
    nombre          text not null,
    descripcion     text,
    activo          boolean not null default true,
    creado_por      uuid not null references usuarios(id),
    modificado_por  uuid references usuarios(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_sectores_proveedores_empresa on sectores_proveedores(empresa_id);

drop trigger if exists trg_set_updated_at on sectores_proveedores;
create trigger trg_set_updated_at before update on sectores_proveedores for each row execute function set_updated_at();

-- Agregar sector_id a la tabla proveedores
alter table proveedores add column if not exists sector_id uuid references sectores_proveedores(id) on delete restrict;

-- Siembra de sectores por defecto para todas las empresas existentes
do $$
declare
    e_rec record;
    u_id uuid;
    sec_id uuid;
begin
    for e_rec in select id from empresas loop
        -- Obtener un usuario de la empresa para creado_por
        select usuario_id into u_id from usuarios_empresas_rol where empresa_id = e_rec.id limit 1;
        if u_id is null then
            select id into u_id from usuarios order by created_at limit 1;
        end if;

        if u_id is not null then
            -- Comunicaciones
            insert into sectores_proveedores (empresa_id, nombre, descripcion, creado_por)
            values (e_rec.id, 'Comunicaciones', 'Servicios de telefonía, internet, enlaces dedicados y telefonía móvil', u_id)
            on conflict do nothing;

            -- Energía
            insert into sectores_proveedores (empresa_id, nombre, descripcion, creado_por)
            values (e_rec.id, 'Energía', 'Energía eléctrica, plantas de respaldo y combustible', u_id)
            on conflict do nothing;

            -- Data / Cloud
            insert into sectores_proveedores (empresa_id, nombre, descripcion, creado_por)
            values (e_rec.id, 'Data / Cloud', 'Servidores cloud, licencias SaaS, dominios y hosting', u_id)
            on conflict do nothing;

            -- Agua / Servicios Básicos
            insert into sectores_proveedores (empresa_id, nombre, descripcion, creado_por)
            values (e_rec.id, 'Agua / Servicios Básicos', 'Suministro de agua, aseo y mantenimiento de instalaciones', u_id)
            on conflict do nothing;

            -- Alquiler / Bienes Raíces
            insert into sectores_proveedores (empresa_id, nombre, descripcion, creado_por)
            values (e_rec.id, 'Alquiler / Bienes Raíces', 'Arriendo de oficinas, bodegas y locales comerciales', u_id)
            on conflict do nothing;

            -- Otro
            insert into sectores_proveedores (empresa_id, nombre, descripcion, creado_por)
            values (e_rec.id, 'Otro', 'Otros servicios y suministros generales', u_id)
            on conflict do nothing;
        end if;
    end loop;
end $$;

-- Backfill para proveedores existentes sin sector_id (vincular al sector con nombre mas cercano o 'Otro')
update proveedores p
set sector_id = (
    select id from sectores_proveedores sp
    where sp.empresa_id = p.empresa_id
      and (lower(sp.nombre) like lower(p.sector || '%') or lower(sp.nombre) = lower(p.sector))
    limit 1
)
where p.sector_id is null;

-- Si aun quedan proveedores sin sector_id, asignar el sector 'Otro' de su empresa
update proveedores p
set sector_id = (
    select id from sectores_proveedores sp
    where sp.empresa_id = p.empresa_id
    order by sp.created_at asc
    limit 1
)
where p.sector_id is null;
