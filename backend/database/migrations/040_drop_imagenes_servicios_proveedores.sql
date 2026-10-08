-- Migracion 040: elimina la columna jsonb "imagenes" de servicios_proveedores
-- -- sus datos ya se migraron a la tabla servicio_adjuntos en la 039,
-- verificado antes de aplicar esta.

alter table servicios_proveedores drop column if exists imagenes;
