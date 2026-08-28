-- =========================================================
-- Migracion 002: corrige vista_consumo_horas
--
-- La migracion 001 filtraba "where cs.activo" en la vista, lo que
-- excluia del todo a las bolsas de horas (contrato_servicios) dadas
-- de baja logicamente -- incluyendo las horas ya ejecutadas contra
-- ellas antes de la baja. Eso contradice el proposito del borrado
-- logico (preservar el historial): dar de baja una bolsa no debe
-- borrar del reporte las horas que ya se habian registrado contra
-- ella. El filtro "cs.activo" se quita; solo se sigue impidiendo
-- CREAR nuevas horas contra una bolsa dada de baja (eso ya se valida
-- en registroHoras.controller.js, no en esta vista).
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
    cs.horas_contratadas - coalesce(sum(rh.horas) filter (where rh.activo), 0)     as horas_disponibles
from contrato_servicios cs
join contratos c        on c.id = cs.contrato_id
join clientes cl         on cl.id = c.cliente_id
join tipos_servicio ts   on ts.id = cs.tipo_servicio_id
left join registro_horas rh
       on rh.contrato_id = cs.contrato_id
      and rh.tipo_servicio_id = cs.tipo_servicio_id
group by cs.id, c.id, c.empresa_id, c.numero_contrato, c.estado, cl.id, cl.nombre, ts.id, ts.nombre, cs.horas_contratadas;
