-- Migracion 037: responsable (persona a cargo) del servicio contratado

alter table servicios_proveedores add column if not exists responsable text;
