-- Migracion 044: historico de un incidente -- cada entrada puede traer
-- una nota libre, un cambio de estado, un documento adjunto, o
-- cualquier combinacion de los tres. A diferencia de incidente_adjuntos
-- (lista plana de archivos), esto es una bitacora cronologica.

create table if not exists incidente_notas (
    id                  uuid primary key default gen_random_uuid(),
    incidente_id        uuid not null references servicio_incidentes(id) on delete cascade,
    nota                text,
    estado_anterior     text,
    estado_nuevo        text,
    imagen_base64       text,
    descripcion_adjunto text,
    creado_por          uuid not null references usuarios(id),
    created_at          timestamptz not null default now()
);

create index if not exists idx_incidente_notas_incidente on incidente_notas(incidente_id);
