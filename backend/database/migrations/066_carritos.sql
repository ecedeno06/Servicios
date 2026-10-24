-- Migracion 066: Carrito de Compras (solicitudes de compra de equipos).
-- Encabezado "carritos" (una solicitud) + detalle "carrito_detalles" (las
-- lineas de equipos a comprar), con estado secuencial fijo:
-- en_construccion -> en_revision -> aprobada -> cerrada (ver
-- POST /:id/avanzar en el controller -- nunca se salta ni se retrocede).

create table if not exists carritos (
    id                  uuid primary key default gen_random_uuid(),
    empresa_id          uuid not null references empresas(id) on delete cascade,
    titulo              text not null,
    fecha_solicitud     date not null default current_date,
    -- Se estampa UNA sola vez, server-side, al pasar a 'aprobada' (ver
    -- avanzarEstado en el controller) -- nunca llega en el body de un
    -- update general.
    fecha_aprobacion    date,
    estado              text not null default 'en_construccion'
                          check (estado in ('en_construccion', 'en_revision', 'aprobada', 'cerrada')),
    creado_por          uuid not null references usuarios(id),
    modificado_por      uuid references usuarios(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists idx_carritos_empresa on carritos(empresa_id);

-- Sin empresa_id propia -- igual que facturas_servicios_proveedores, la
-- seguridad multi-tenant depende de verificar siempre primero que el
-- carrito_id padre pertenece a req.empresaId.
create table if not exists carrito_detalles (
    id                  uuid primary key default gen_random_uuid(),
    carrito_id          uuid not null references carritos(id) on delete cascade,
    producto_id         integer not null references productos(id) on delete restrict,
    marca               text not null,
    modelo              text not null,
    url                 text,
    proveedor_id        uuid references proveedores(id) on delete set null,
    cantidad_propuesta  integer not null check (cantidad_propuesta > 0),
    cantidad_aprobada   integer check (cantidad_aprobada is null or cantidad_aprobada >= 0),
    observacion         text,
    creado_por          uuid not null references usuarios(id),
    modificado_por      uuid references usuarios(id),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists idx_carrito_detalles_carrito on carrito_detalles(carrito_id);
create index if not exists idx_carrito_detalles_producto on carrito_detalles(producto_id);

drop trigger if exists trg_set_updated_at on carritos;
create trigger trg_set_updated_at before update on carritos for each row execute function set_updated_at();

drop trigger if exists trg_set_updated_at on carrito_detalles;
create trigger trg_set_updated_at before update on carrito_detalles for each row execute function set_updated_at();

-- Registrar menu 'carrito_compras'. A proposito NO se asignan permisos por
-- rol aqui (a diferencia de otras migraciones de menus nuevos) -- queda a
-- criterio del super-admin, que ya puede usar el modulo de inmediato
-- porque requirePermiso lo deja pasar siempre (es_super_admin). La
-- asignacion por rol (admin, supervisor, tecnico, etc.) se hace despues
-- desde la pantalla de Roles y Permisos.
insert into menus (codigo, nombre, ruta, icono, orden) values
    ('carrito_compras', 'Carrito de Compras', '/carrito-compras', 'carrito_compras', 95)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- delete from menus where codigo = 'carrito_compras';
-- drop table if exists carrito_detalles;
-- drop table if exists carritos;
