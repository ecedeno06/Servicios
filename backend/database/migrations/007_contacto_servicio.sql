-- Migracion 007: contacto (nombre, correo, telefono) por servicio contratado
-- Cada fila de contrato_servicios (un tipo de servicio dentro de un contrato)
-- puede llevar un contacto puntual (ej. la persona del cliente responsable
-- de coordinar ese servicio).

alter table contrato_servicios add column if not exists contacto jsonb;

-- La vista se recrea (drop + create) porque se inserta la columna en medio
-- del select, no al final -- "create or replace view" no permite reordenar
-- ni insertar columnas en medio, solo agregarlas al final.
drop view if exists vista_consumo_horas;

create view vista_consumo_horas as
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
    cs.contacto,
    coalesce(sum(rh.horas), 0)                              as horas_ejecutadas,
    cs.horas_contratadas - coalesce(sum(rh.horas), 0)       as horas_disponibles
from contrato_servicios cs
join contratos c        on c.id = cs.contrato_id
join clientes cl         on cl.id = c.cliente_id
join tipos_servicio ts   on ts.id = cs.tipo_servicio_id
left join registro_horas rh
       on rh.contrato_id = cs.contrato_id
      and rh.tipo_servicio_id = cs.tipo_servicio_id
group by cs.id, c.id, c.empresa_id, c.numero_contrato, c.estado, cl.id, cl.nombre, ts.id, ts.nombre, cs.horas_contratadas, cs.contacto;
