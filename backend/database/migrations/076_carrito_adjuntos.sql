-- Migracion 076: Adjuntos del Carrito de Compras -- archivos (PDF/PNG/JPG
-- en base64, pegados con Ctrl+V o subidos) o enlaces (url), uno o mas por
-- cada linea de equipo. Hija de carrito_detalles -- mismo criterio que
-- carrito_cotizaciones: la comparacion/documentacion es por equipo, no por
-- solicitud completa.

-- Sin empresa_id propia -- igual que carrito_cotizaciones, la seguridad
-- multi-tenant depende de verificar primero que carrito_detalle_id
-- pertenece a un carrito de req.empresaId.
create table if not exists carrito_adjuntos (
    id                  uuid primary key default gen_random_uuid(),
    carrito_detalle_id  uuid not null references carrito_detalles(id) on delete cascade,
    fecha               timestamptz not null default now(),
    descripcion         text,
    url                 text,
    imagen_base64       text,
    creado_por          uuid not null references usuarios(id),
    created_at          timestamptz not null default now(),
    constraint carrito_adjuntos_contenido_check check (url is not null or imagen_base64 is not null)
);

create index if not exists idx_carrito_adjuntos_detalle on carrito_adjuntos(carrito_detalle_id);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists carrito_adjuntos;
