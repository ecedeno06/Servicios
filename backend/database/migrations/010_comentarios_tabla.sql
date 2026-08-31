-- Migracion 010: comentarios de registro_horas pasan de jsonb a tabla
-- propia, + tabla de "vistos" para notificaciones de no-leidos.
-- Ver NOTIFICACIONES-COMENTARIOS.md seccion 6 para el analisis completo.
-- No hay datos reales en registro_horas.comentarios al momento de esta
-- migracion (verificado), asi que no hace falta migrar filas.

create table if not exists comentarios (
    id                  uuid primary key default gen_random_uuid(),
    registro_horas_id   uuid not null references registro_horas(id) on delete cascade,
    usuario_id          uuid not null references usuarios(id) on delete restrict,
    nota                text not null,
    created_at          timestamptz not null default now()
);
create index if not exists idx_comentarios_registro on comentarios(registro_horas_id, created_at);

-- Por usuario y registro de horas: hasta que fecha ya vio los comentarios
-- (todo lo que tenga created_at <= visto_hasta cuenta como leido).
create table if not exists comentarios_vistos (
    usuario_id          uuid not null references usuarios(id) on delete cascade,
    registro_horas_id   uuid not null references registro_horas(id) on delete cascade,
    visto_hasta         timestamptz not null default now(),
    primary key (usuario_id, registro_horas_id)
);

-- Si en algun momento se agrego algun comentario real por pruebas,
-- migrarlo antes de tirar la columna (no deberia afectar nada hoy).
insert into comentarios (registro_horas_id, usuario_id, nota, created_at)
select rh.id, (elem->>'usuario_id')::uuid, elem->>'nota', (elem->>'fecha')::timestamptz
from registro_horas rh, jsonb_array_elements(rh.comentarios) elem
where jsonb_array_length(rh.comentarios) > 0;

alter table registro_horas drop column if exists comentarios;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table registro_horas add column comentarios jsonb not null default '[]'::jsonb;
-- update registro_horas rh set comentarios = (
--   select coalesce(jsonb_agg(jsonb_build_object(
--     'fecha', c.created_at, 'usuario_id', c.usuario_id,
--     'usuario_nombre', u.nombre, 'nota', c.nota
--   ) order by c.created_at), '[]'::jsonb)
--   from comentarios c join usuarios u on u.id = c.usuario_id
--   where c.registro_horas_id = rh.id
-- );
-- drop table if exists comentarios_vistos;
-- drop table if exists comentarios;
