-- Migracion 035: url / sitio web para proveedores y para servicios contratados

alter table proveedores add column if not exists url text;
alter table servicios_proveedores add column if not exists url text;
