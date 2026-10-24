-- Migracion 067: costo estimado (por unidad, USD) en cada linea del
-- Carrito de Compras -- dato de referencia para evaluar la solicitud
-- antes de aprobarla, no pedido originalmente pero agregado a pedido
-- explicito del usuario.
alter table carrito_detalles add column if not exists costo_estimado numeric(12, 2);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table carrito_detalles drop column if exists costo_estimado;
