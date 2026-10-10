-- Migracion 043: adjuntos (PDF/PNG/JPG en base64) por incidente de
-- servicio, mismo molde que servicio_adjuntos/factura_adjuntos.

create table if not exists incidente_adjuntos (
    id              uuid primary key default gen_random_uuid(),
    incidente_id    uuid not null references servicio_incidentes(id) on delete cascade,
    fecha           timestamptz not null default now(),
    descripcion     text,
    imagen_base64   text not null,
    creado_por      uuid not null references usuarios(id),
    created_at      timestamptz not null default now()
);

create index if not exists idx_incidente_adjuntos_incidente on incidente_adjuntos(incidente_id);
