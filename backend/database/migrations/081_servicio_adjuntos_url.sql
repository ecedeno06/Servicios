-- Migracion 081: permite que un adjunto de un servicio (servicio_adjuntos,
-- la seccion "Imagenes y Documentos" del propio servicio contratado) sea
-- tambien un enlace (url), ademas de o en vez de un documento
-- (imagen_base64) -- mismo criterio que incidente_adjuntos (migracion 078)
-- y carrito_adjuntos (migracion 076).

alter table servicio_adjuntos add column if not exists url text;
alter table servicio_adjuntos alter column imagen_base64 drop not null;

alter table servicio_adjuntos drop constraint if exists servicio_adjuntos_contenido_check;
alter table servicio_adjuntos add constraint servicio_adjuntos_contenido_check
  check (url is not null or imagen_base64 is not null);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table servicio_adjuntos drop constraint if exists servicio_adjuntos_contenido_check;
-- alter table servicio_adjuntos alter column imagen_base64 set not null;
-- alter table servicio_adjuntos drop column if exists url;
