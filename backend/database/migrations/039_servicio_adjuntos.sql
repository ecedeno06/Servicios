-- Migracion 039: tabla propia para los adjuntos de un servicio (antes
-- vivian en servicios_proveedores.imagenes como jsonb). Mismo molde que
-- facturas_servicios_proveedores (027_servicios_proveedores.sql).

create table if not exists servicio_adjuntos (
    id                      uuid primary key default gen_random_uuid(),
    servicio_proveedor_id   uuid not null references servicios_proveedores(id) on delete cascade,
    fecha                   timestamptz not null default now(),
    descripcion             text,
    imagen_base64           text not null,
    creado_por              uuid not null references usuarios(id),
    created_at              timestamptz not null default now()
);

create index if not exists idx_servicio_adjuntos_servicio on servicio_adjuntos(servicio_proveedor_id);

-- Backfill de lo que ya estaba guardado en el jsonb. "creado_por" ahi era
-- el NOMBRE del usuario (no un id) -- se intenta resolver contra
-- usuarios.nombre, y si no matchea (cuenta renombrada/borrada) cae al
-- creado_por del servicio como fallback, nunca null.
insert into servicio_adjuntos (servicio_proveedor_id, fecha, descripcion, imagen_base64, creado_por)
select
  sp.id,
  coalesce((img->>'fecha')::timestamptz, sp.created_at),
  nullif(img->>'descripcion', ''),
  img->>'imagen_base64',
  coalesce((select u.id from usuarios u where u.nombre = img->>'creado_por' limit 1), sp.creado_por)
from servicios_proveedores sp,
     jsonb_array_elements(sp.imagenes) as img;
