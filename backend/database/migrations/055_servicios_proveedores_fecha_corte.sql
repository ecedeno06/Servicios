-- Migracion 055: agrega fecha_corte (fecha de corte de facturacion) a
-- servicios_proveedores.

alter table servicios_proveedores add column if not exists fecha_corte date;
