-- Migracion 074: Cotizaciones del Carrito de Compras -- mas de una
-- propuesta de precio (cada una de un proveedor distinto) por cada linea
-- de equipo, para poder comparar antes de aprobar. Hija de
-- carrito_detalles (no del carrito completo): la comparacion es por
-- equipo, no por solicitud.

-- Sin empresa_id propia -- igual que carrito_detalles, la seguridad
-- multi-tenant depende de verificar primero que carrito_detalle_id
-- pertenece a un carrito de req.empresaId.
create table if not exists carrito_cotizaciones (
    id                  uuid primary key default gen_random_uuid(),
    carrito_detalle_id  uuid not null references carrito_detalles(id) on delete cascade,
    proveedor_id        uuid not null references proveedores(id) on delete restrict,
    costo               numeric(12, 2) not null check (costo >= 0),
    observacion         text,
    url                 text,
    creado_por          uuid not null references usuarios(id),
    modificado_por      uuid references usuarios(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists idx_carrito_cotizaciones_detalle on carrito_cotizaciones(carrito_detalle_id);
create index if not exists idx_carrito_cotizaciones_proveedor on carrito_cotizaciones(proveedor_id);

drop trigger if exists trg_set_updated_at on carrito_cotizaciones;
create trigger trg_set_updated_at before update on carrito_cotizaciones for each row execute function set_updated_at();

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists carrito_cotizaciones;
