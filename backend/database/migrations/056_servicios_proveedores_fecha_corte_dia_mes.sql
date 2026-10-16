-- Reemplaza fecha_corte (date) por dos campos separados: dia y mes.
-- Dia siempre aplica; mes solo aplica cuando el gasto es anual
-- (costo_mensual = 0 y costo_anual > 0) -- si es mensual, el mes
-- queda en null porque el cobro se repite cada mes.
-- No hay datos existentes en fecha_corte (verificado), por lo que no
-- se necesita backfill.
alter table servicios_proveedores add column if not exists fecha_corte_dia smallint;
alter table servicios_proveedores add column if not exists fecha_corte_mes smallint;

alter table servicios_proveedores drop column if exists fecha_corte;
