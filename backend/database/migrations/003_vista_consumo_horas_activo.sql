-- =========================================================
-- Migracion 003: expone contrato_servicio_activo en vista_consumo_horas
--
-- La migracion 002 dejo de filtrar "where cs.activo" para no perder el
-- historial de horas ejecutadas contra una bolsa ya dada de baja. Pero
-- sin ese filtro, el frontend no tenia forma de distinguir una bolsa
-- vigente de una quitada -- "Quitar" no hacia desaparecer la fila de la
-- lista de "Horas establecidas" del contrato. Se agrega la columna
-- cs.activo (como contrato_servicio_activo) para que el frontend pueda
-- ocultar las bolsas quitadas de esa lista, sin perder sus horas
-- ejecutadas en los totales agregados (dashboard).
-- =========================================================

create or replace view vista_consumo_horas as
select
    cs.id                   as contrato_servicio_id,
    c.id                    as contrato_id,
    c.empresa_id,
    c.numero_contrato,
    c.estado                as estado_contrato,
    cl.id                   as cliente_id,
    cl.nombre               as cliente_nombre,
    ts.id                   as tipo_servicio_id,
    ts.nombre               as tipo_servicio_nombre,
    cs.horas_contratadas,
    coalesce(sum(rh.horas) filter (where rh.activo), 0)                            as horas_ejecutadas,
    cs.horas_contratadas - coalesce(sum(rh.horas) filter (where rh.activo), 0)     as horas_disponibles,
    cs.activo               as contrato_servicio_activo
from contrato_servicios cs
join contratos c        on c.id = cs.contrato_id
join clientes cl         on cl.id = c.cliente_id
join tipos_servicio ts   on ts.id = cs.tipo_servicio_id
left join registro_horas rh
       on rh.contrato_id = cs.contrato_id
      and rh.tipo_servicio_id = cs.tipo_servicio_id
group by cs.id, c.id, c.empresa_id, c.numero_contrato, c.estado, cl.id, cl.nombre, ts.id, ts.nombre, cs.horas_contratadas;
