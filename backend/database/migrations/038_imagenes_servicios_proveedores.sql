-- Migracion 038: imagenes/documentos (PDF, PNG, JPG en base64) del servicio contratado

alter table servicios_proveedores add column if not exists imagenes jsonb not null default '[]'::jsonb;
