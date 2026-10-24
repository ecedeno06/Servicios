-- Migracion 068: historico de movimientos de un Carrito de Compras
-- (cambios de estado). Mismo patron que equipos_historial (migracion
-- 017): se llena desde el backend en cada punto donde el estado cambia
-- (crear, avanzar, retroceder), nunca con un trigger.
create table if not exists historico_movimiento_carrito (
    id              uuid primary key default gen_random_uuid(),
    carrito_id      uuid not null references carritos(id) on delete cascade,
    estado_anterior text,
    estado_nuevo    text not null,
    observacion     text,
    registrado_por  uuid not null references usuarios(id),
    fecha_cambio    timestamptz not null default now()
);

create index if not exists idx_historico_movimiento_carrito_carrito on historico_movimiento_carrito(carrito_id);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists historico_movimiento_carrito;
