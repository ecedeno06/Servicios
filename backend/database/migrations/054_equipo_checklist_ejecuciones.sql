-- Migracion 054: reemplaza equipo_checklist (un solo estado en curso por
-- equipo, migracion 053) por un modelo de "ejecuciones" -- se puede
-- repetir el checklist mas de una vez por equipo, cada una con su propia
-- fecha y con el usuario al que se le asigno el equipo en ese momento
-- (pedido explicito: "el checklist esta asociado al usuario que se le
-- asigno el equipo + fecha de checklist").

create table if not exists equipo_checklist_ejecuciones (
    id                  uuid primary key default gen_random_uuid(),
    equipo_asignado_id  uuid not null references equipos_asignados(id) on delete cascade,
    asignado_a          text,
    fecha               timestamptz not null default now(),
    creado_por          uuid not null references usuarios(id),
    created_at          timestamptz not null default now()
);

create index if not exists idx_equipo_checklist_ejecuciones_equipo on equipo_checklist_ejecuciones(equipo_asignado_id);

create table if not exists equipo_checklist_items (
    id                  uuid primary key default gen_random_uuid(),
    ejecucion_id        uuid not null references equipo_checklist_ejecuciones(id) on delete cascade,
    checklist_id        uuid not null references checklists(id) on delete cascade,
    completado          boolean not null default false,
    fecha_completado    timestamptz,
    modificado_por      uuid references usuarios(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (ejecucion_id, checklist_id)
);

create index if not exists idx_equipo_checklist_items_ejecucion on equipo_checklist_items(ejecucion_id);

drop trigger if exists trg_set_updated_at on equipo_checklist_items;
create trigger trg_set_updated_at before update on equipo_checklist_items for each row execute function set_updated_at();

-- Migrar lo que ya existia en equipo_checklist (un unico estado en curso
-- por equipo) a una primera "ejecucion", usando el asignado_a ACTUAL del
-- equipo (el viejo modelo no lo guardaba por item) y la fecha mas
-- temprana entre sus items como fecha de esa ejecucion.
do $$
declare
    eq_id uuid;
    nueva_ejecucion_id uuid;
    primer_creado_por uuid;
    primera_fecha timestamptz;
    asignada_actual text;
begin
    for eq_id in select distinct equipo_asignado_id from equipo_checklist loop
        select min(created_at) into primera_fecha from equipo_checklist where equipo_asignado_id = eq_id;
        select creado_por into primer_creado_por from equipo_checklist where equipo_asignado_id = eq_id order by created_at limit 1;
        select asignada_a into asignada_actual from equipos_asignados where id = eq_id;

        insert into equipo_checklist_ejecuciones (equipo_asignado_id, asignado_a, fecha, creado_por, created_at)
        values (eq_id, asignada_actual, primera_fecha, primer_creado_por, primera_fecha)
        returning id into nueva_ejecucion_id;

        insert into equipo_checklist_items (ejecucion_id, checklist_id, completado, fecha_completado, modificado_por, created_at, updated_at)
        select nueva_ejecucion_id, checklist_id, completado, fecha_completado, modificado_por, created_at, updated_at
        from equipo_checklist
        where equipo_asignado_id = eq_id;
    end loop;
end $$;

drop table if exists equipo_checklist;
