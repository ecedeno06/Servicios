-- Migracion 029: fecha_fin y es_indefinido para servicios_proveedores

alter table servicios_proveedores add column if not exists fecha_fin date;
alter table servicios_proveedores add column if not exists es_indefinido boolean not null default true;
