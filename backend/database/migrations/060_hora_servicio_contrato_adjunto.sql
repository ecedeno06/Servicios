-- Migracion 060: adjuntos (base64, png/jpg/pdf, max 2MB) asociados a un
-- comentario de un registro de horas -- mismo molde que servicio_adjuntos/
-- equipo_adjuntos. Reemplaza la seccion "Documentos" (enlaces a OneDrive)
-- que vivia en registro_horas.documentos, ahora movida al comentario.

create table if not exists hora_servicio_contrato_adjunto (
    id              uuid primary key default gen_random_uuid(),
    comentario_id   uuid not null references comentarios(id) on delete cascade,
    fecha           timestamptz not null default now(),
    descripcion     text,
    imagen_base64   text not null,
    creado_por      uuid not null references usuarios(id),
    created_at      timestamptz not null default now()
);

create index if not exists idx_hora_servicio_contrato_adjunto_comentario on hora_servicio_contrato_adjunto(comentario_id);
