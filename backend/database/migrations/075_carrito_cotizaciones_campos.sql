-- Migracion 075: campos adicionales en las cotizaciones del Carrito de
-- Compras -- fecha de la cotizacion, numero/id de cotizacion del
-- proveedor (distinto al id interno de la fila) y datos de contacto
-- (nombre, correo, telefono) de quien la emitio. "costo" se renombra a
-- "costo_unitario" para que quede explicito que es por unidad (mismo
-- criterio que carrito_detalles.costo_estimado, ver migracion 067).

alter table carrito_cotizaciones rename column costo to costo_unitario;

alter table carrito_cotizaciones add column if not exists fecha date not null default current_date;
alter table carrito_cotizaciones add column if not exists numero_cotizacion text;
alter table carrito_cotizaciones add column if not exists contacto_nombre text;
alter table carrito_cotizaciones add column if not exists contacto_correo text;
alter table carrito_cotizaciones add column if not exists contacto_telefono text;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table carrito_cotizaciones drop column if exists fecha;
-- alter table carrito_cotizaciones drop column if exists numero_cotizacion;
-- alter table carrito_cotizaciones drop column if exists contacto_nombre;
-- alter table carrito_cotizaciones drop column if exists contacto_correo;
-- alter table carrito_cotizaciones drop column if exists contacto_telefono;
-- alter table carrito_cotizaciones rename column costo_unitario to costo;
