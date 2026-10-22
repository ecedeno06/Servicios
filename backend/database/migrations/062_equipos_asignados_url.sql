-- Migracion 062: URL opcional por equipo asignado (ej. enlace a la factura,
-- orden de compra o ficha del equipo) -- distinta de productos.url, que es
-- la URL generica del producto en el catalogo global.

alter table equipos_asignados add column if not exists url text;
