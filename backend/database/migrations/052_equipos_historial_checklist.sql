-- Migracion 052: guarda que items del catalogo Checklist se marcaron en
-- cada movimiento del equipo (snapshot id+descripcion, legible aunque el
-- catalogo cambie despues).

alter table equipos_historial add column if not exists checklist jsonb;
