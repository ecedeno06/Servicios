-- Migracion 053: seguimiento persistente del catalogo Checklist por
-- equipo -- distinto del snapshot puntual que queda en
-- equipos_historial.checklist (migracion 052) al cambiar de estado. Esta
-- tabla permite ver pendientes/completados y asignar un responsable por
-- item, en cualquier momento (no solo al cambiar de estado).

create table if not exists equipo_checklist (
    id                  uuid primary key default gen_random_uuid(),
    equipo_asignado_id  uuid not null references equipos_asignados(id) on delete cascade,
    checklist_id        uuid not null references checklists(id) on delete cascade,
    asignado_a          text,
    completado          boolean not null default false,
    fecha_completado    timestamptz,
    creado_por          uuid not null references usuarios(id),
    modificado_por      uuid references usuarios(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (equipo_asignado_id, checklist_id)
);

create index if not exists idx_equipo_checklist_equipo on equipo_checklist(equipo_asignado_id);

drop trigger if exists trg_set_updated_at on equipo_checklist;
create trigger trg_set_updated_at before update on equipo_checklist for each row execute function set_updated_at();
