-- Migracion 041: adjuntos (PDF/PNG/JPG en base64) por factura individual,
-- mismo molde que servicio_adjuntos (039_servicio_adjuntos.sql) pero
-- colgando de una factura en vez del servicio completo.

create table if not exists factura_adjuntos (
    id          uuid primary key default gen_random_uuid(),
    factura_id  uuid not null references facturas_servicios_proveedores(id) on delete cascade,
    fecha       timestamptz not null default now(),
    descripcion text,
    imagen_base64 text not null,
    creado_por  uuid not null references usuarios(id),
    created_at  timestamptz not null default now()
);

create index if not exists idx_factura_adjuntos_factura on factura_adjuntos(factura_id);
