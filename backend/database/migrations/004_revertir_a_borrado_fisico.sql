-- =========================================================
-- Migracion 004: revertir a borrado fisico
--
-- Se decidio volver a "delete" fisico en vez de baja logica
-- (activo=false) para contratos, registro_horas, contrato_servicios
-- y la relacion usuarios_empresas_rol. Motivo: la baja logica
-- complicaba la UI (bolsas "quitadas" seguian reapareciendo en
-- listados, "Quitar" no se sentia como que quitaba nada) y anadia
-- una capa de indireccion (filtros activo=true por todos lados)
-- que no compensaba el beneficio de conservar el historial.
--
-- clientes.activo, tipos_servicio.activo y usuarios.activo NO se
-- tocan: son el toggle original de la app (anterior a multicompania),
-- independiente de si la fila se borra o no.
-- =========================================================

-- 1. Quitar los filtros "where activo" de listar/obtener (ver 4 mas abajo,
--    solo aplica al codigo del backend, no a la BD).

-- 2. Restricciones unicas: volver a unique simple por empresa (sin
--    condicion "where activo", ya no aplica sin baja logica).
drop index if exists uq_clientes_empresa_identificacion;
drop index if exists uq_tipos_servicio_empresa_nombre;
drop index if exists uq_contratos_empresa_numero;

alter table clientes       add constraint uq_clientes_empresa_identificacion unique (empresa_id, identificacion);
alter table tipos_servicio add constraint uq_tipos_servicio_empresa_nombre unique (empresa_id, nombre);
alter table contratos      add constraint uq_contratos_empresa_numero unique (empresa_id, numero_contrato);

-- 3. La vista depende de columnas "activo" que se van a borrar: hay que
--    dropearla antes de poder quitar esas columnas.
drop view if exists vista_consumo_horas;

-- 4. Quitar la columna activo de las tablas donde se agrego solo para
--    soportar baja logica.
alter table contratos          drop column if exists activo;
alter table registro_horas     drop column if exists activo;
alter table contrato_servicios drop column if exists activo;
alter table usuarios_empresas_rol drop column if exists activo;

-- 5. Recrear vista_consumo_horas sin filtros de activo ni la columna
--    contrato_servicio_activo.
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
    coalesce(sum(rh.horas), 0)                              as horas_ejecutadas,
    cs.horas_contratadas - coalesce(sum(rh.horas), 0)       as horas_disponibles
from contrato_servicios cs
join contratos c        on c.id = cs.contrato_id
join clientes cl         on cl.id = c.cliente_id
join tipos_servicio ts   on ts.id = cs.tipo_servicio_id
left join registro_horas rh
       on rh.contrato_id = cs.contrato_id
      and rh.tipo_servicio_id = cs.tipo_servicio_id
group by cs.id, c.id, c.empresa_id, c.numero_contrato, c.estado, cl.id, cl.nombre, ts.id, ts.nombre, cs.horas_contratadas;
