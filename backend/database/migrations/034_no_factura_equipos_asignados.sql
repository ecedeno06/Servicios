-- Migracion 034: numero de factura del equipo asignado (compra/renta al proveedor)

alter table equipos_asignados add column if not exists no_factura text;
