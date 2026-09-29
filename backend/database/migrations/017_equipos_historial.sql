-- Migracion 017: historico de movimientos de un equipo asignado (cambios
-- de estado). Se llena desde el backend (no con un trigger): al crear un
-- equipo se registra su primer movimiento, y al editarlo se agrega uno
-- nuevo solo si el estado realmente cambio.
create table if not exists equipos_historial (
    id                  uuid primary key default gen_random_uuid(),
    equipo_asignado_id  uuid not null references equipos_asignados(id) on delete cascade,
    estado_anterior     text,
    estado_nuevo        text not null,
    asignada_a          text,
    observacion         text,
    registrado_por      uuid not null references usuarios(id),
    fecha_cambio        timestamptz not null default now()
);

create index if not exists idx_equipos_historial_equipo on equipos_historial(equipo_asignado_id);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists equipos_historial;
