-- Migracion 048: catalogo con CRUD para los Estados de un Servicio
-- Contratado (Activo/Cancelado/No Renovar/etc.), antes una lista fija en
-- el frontend. Mismo patron que sectores_proveedores (migracion 028):
-- se agrega estado_id como FK y se mantiene la columna 'estado' de texto
-- (denormalizada, sincronizada en cada guardado/renombrado) para no
-- romper filtros/ordenamiento existentes que ya trabajan sobre ese texto.

create table if not exists estados_servicios_proveedores (
    id              uuid primary key default gen_random_uuid(),
    empresa_id      uuid not null references empresas(id) on delete cascade,
    nombre          text not null,
    clase_badge     text not null default 'badge-slate',
    activo          boolean not null default true,
    creado_por      uuid not null references usuarios(id),
    modificado_por  uuid references usuarios(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_estados_servicios_proveedores_empresa on estados_servicios_proveedores(empresa_id);

drop trigger if exists trg_set_updated_at on estados_servicios_proveedores;
create trigger trg_set_updated_at before update on estados_servicios_proveedores for each row execute function set_updated_at();

alter table servicios_proveedores add column if not exists estado_id uuid references estados_servicios_proveedores(id) on delete restrict;

-- Siembra de los mismos 6 estados que hoy estan fijos en el frontend, para todas las empresas existentes
do $$
declare
    e_rec record;
    u_id uuid;
begin
    for e_rec in select id from empresas loop
        select usuario_id into u_id from usuarios_empresas_rol where empresa_id = e_rec.id limit 1;
        if u_id is null then
            select id into u_id from usuarios order by created_at limit 1;
        end if;

        if u_id is not null then
            insert into estados_servicios_proveedores (empresa_id, nombre, clase_badge, creado_por) values (e_rec.id, 'Activo', 'badge-green', u_id) on conflict do nothing;
            insert into estados_servicios_proveedores (empresa_id, nombre, clase_badge, creado_por) values (e_rec.id, 'En Pausa', 'badge-amber', u_id) on conflict do nothing;
            insert into estados_servicios_proveedores (empresa_id, nombre, clase_badge, creado_por) values (e_rec.id, 'No Renovar', 'badge-red-solid', u_id) on conflict do nothing;
            insert into estados_servicios_proveedores (empresa_id, nombre, clase_badge, creado_por) values (e_rec.id, 'Vencido', 'badge-red', u_id) on conflict do nothing;
            insert into estados_servicios_proveedores (empresa_id, nombre, clase_badge, creado_por) values (e_rec.id, 'Inactivo', 'badge-slate', u_id) on conflict do nothing;
            insert into estados_servicios_proveedores (empresa_id, nombre, clase_badge, creado_por) values (e_rec.id, 'Cancelado', 'badge-red', u_id) on conflict do nothing;
        end if;
    end loop;
end $$;

-- Backfill: vincular servicios_proveedores.estado_id segun el texto actual (comparacion sin distinguir mayusculas)
update servicios_proveedores sp
set estado_id = (
    select id from estados_servicios_proveedores e
    where e.empresa_id = sp.empresa_id
      and lower(e.nombre) = lower(sp.estado)
    limit 1
)
where sp.estado_id is null;

-- Si quedo alguno sin matchear (texto fuera de la lista conocida), usar el estado 'Activo' de su empresa
update servicios_proveedores sp
set estado_id = (
    select id from estados_servicios_proveedores e
    where e.empresa_id = sp.empresa_id and lower(e.nombre) = 'activo'
    limit 1
)
where sp.estado_id is null;

-- Sincronizar el texto denormalizado 'estado' con el nombre exacto del catalogo (mayusculas consistentes para los badges)
update servicios_proveedores sp
set estado = e.nombre
from estados_servicios_proveedores e
where sp.estado_id = e.id and sp.estado is distinct from e.nombre;
