-- Migracion 078: permite que un adjunto de incidente (incidente_adjuntos)
-- sea tambien un enlace (url), ademas de o en vez de un documento
-- (imagen_base64) -- mismo criterio que carrito_adjuntos (migracion 076).

alter table incidente_adjuntos add column if not exists url text;
alter table incidente_adjuntos alter column imagen_base64 drop not null;

alter table incidente_adjuntos drop constraint if exists incidente_adjuntos_contenido_check;
alter table incidente_adjuntos add constraint incidente_adjuntos_contenido_check
  check (url is not null or imagen_base64 is not null);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table incidente_adjuntos drop constraint if exists incidente_adjuntos_contenido_check;
-- alter table incidente_adjuntos alter column imagen_base64 set not null;
-- alter table incidente_adjuntos drop column if exists url;
