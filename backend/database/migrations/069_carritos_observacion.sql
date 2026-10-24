-- Migracion 069: observacion a nivel de encabezado del Carrito de Compras
-- (texto libre, distinta de la observacion por linea en carrito_detalles)
-- -- pedido explicito del usuario.
alter table carritos add column if not exists observacion text;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table carritos drop column if exists observacion;
