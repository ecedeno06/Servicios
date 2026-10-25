-- Precio de referencia (catalogo) para el producto -- informativo, distinto
-- del costo_estimado que se carga por linea dentro de cada Carrito de
-- Compras (ese puede variar por cotizacion/proveedor).
alter table productos add column if not exists precio_referencia numeric(12,2);
