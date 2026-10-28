-- Migracion 077: permite que una entrada del historico de un incidente
-- (incidente_notas) tambien incluya un enlace (url), ademas de o en vez
-- de un documento adjunto (imagen_base64) -- mismo criterio que
-- carrito_adjuntos (migracion 076).

alter table incidente_notas add column if not exists url text;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table incidente_notas drop column if exists url;
