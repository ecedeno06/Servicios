-- Migracion 042: incidentes reportados sobre un servicio contratado,
-- tabla propia con su propio ciclo de vida (igual molde que
-- facturas_servicios_proveedores en 027_servicios_proveedores.sql).

create table if not exists servicio_incidentes (
    id                      uuid primary key default gen_random_uuid(),
    servicio_proveedor_id   uuid not null references servicios_proveedores(id) on delete cascade,
    fecha_incidente         date not null default current_date,
    reportado_por           text not null,
    descripcion             text not null,
    no_ticket_fabricante    text,
    estado                  text not null default 'abierto',
    creado_por              uuid not null references usuarios(id),
    modificado_por          uuid references usuarios(id),
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index if not exists idx_servicio_incidentes_servicio on servicio_incidentes(servicio_proveedor_id);

drop trigger if exists trg_set_updated_at on servicio_incidentes;
create trigger trg_set_updated_at before update on servicio_incidentes for each row execute function set_updated_at();
