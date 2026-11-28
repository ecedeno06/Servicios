-- Migracion 083: catalogo de "Asignado a" (personas/areas/ubicaciones a las
-- que se les ha asignado un equipo), por empresa. No es una tabla de
-- usuarios del sistema (asignada_a en equipos_asignados sigue siendo texto
-- libre, ver migracion 016) -- solo guarda los nombres ya usados para
-- ofrecerlos como sugerencias en el selector del frontend y evitar que el
-- mismo destinatario quede escrito de formas distintas.
create table if not exists personas_asignadas (
    id          uuid primary key default gen_random_uuid(),
    empresa_id  uuid not null references empresas(id) on delete cascade,
    nombre      text not null,
    creado_por  uuid not null references usuarios(id),
    created_at  timestamptz not null default now()
);

create unique index if not exists uq_personas_asignadas_empresa_nombre
    on personas_asignadas (empresa_id, lower(nombre));

-- Siembra con los nombres ya usados hoy en equipos_asignados.asignada_a y en
-- equipo_checklist_ejecuciones.asignado_a, para que el selector arranque con
-- las sugerencias reales de cada empresa en vez de vacio.
insert into personas_asignadas (empresa_id, nombre, creado_por)
select distinct on (ea.empresa_id, lower(ea.asignada_a))
    ea.empresa_id, trim(ea.asignada_a), ea.creado_por
from equipos_asignados ea
where ea.asignada_a is not null and trim(ea.asignada_a) <> ''
on conflict do nothing;

insert into personas_asignadas (empresa_id, nombre, creado_por)
select distinct on (ea.empresa_id, lower(ej.asignado_a))
    ea.empresa_id, trim(ej.asignado_a), ea.creado_por
from equipo_checklist_ejecuciones ej
join equipos_asignados ea on ea.id = ej.equipo_asignado_id
where ej.asignado_a is not null and trim(ej.asignado_a) <> ''
on conflict do nothing;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists personas_asignadas;
