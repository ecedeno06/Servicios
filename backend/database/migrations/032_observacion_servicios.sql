-- Migracion 032: campo de observacion libre para servicios_proveedores

alter table servicios_proveedores add column if not exists observacion text;
