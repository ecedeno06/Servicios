-- Migracion 061: observacion (texto libre) y url (ficha tecnica/manual u
-- otro enlace de referencia) en el catalogo de productos. Ambas opcionales.

alter table productos add column if not exists observacion text;
alter table productos add column if not exists url text;
