-- Migracion 049: adjuntos (PDF/PNG/JPG en base64) por equipo asignado,
-- mismo molde que servicio_adjuntos/incidente_adjuntos.

create table if not exists equipo_adjuntos (
    id                      uuid primary key default gen_random_uuid(),
    equipo_asignado_id     uuid not null references equipos_asignados(id) on delete cascade,
    fecha                   timestamptz not null default now(),
    descripcion             text,
    imagen_base64           text not null,
    creado_por              uuid not null references usuarios(id),
    created_at              timestamptz not null default now()
);

create index if not exists idx_equipo_adjuntos_equipo on equipo_adjuntos(equipo_asignado_id);
