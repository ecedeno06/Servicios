-- Migracion 027: tablas para Proveedores, Servicios de Proveedores y Facturas/Transacciones
-- Incluye la configuracion en el catalogo de menus y permisos por rol.

create table if not exists proveedores (
    id              uuid primary key default gen_random_uuid(),
    empresa_id      uuid not null references empresas(id) on delete cascade,
    nombre          text not null,
    descripcion     text,
    contacto        text,
    correo          text,
    telefono        text,
    acepta_whatsapp boolean not null default false,
    sector          text not null default 'comunicaciones',
    creado_por      uuid not null references usuarios(id),
    modificado_por  uuid references usuarios(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_proveedores_empresa on proveedores(empresa_id);

create table if not exists servicios_proveedores (
    id              uuid primary key default gen_random_uuid(),
    empresa_id      uuid not null references empresas(id) on delete cascade,
    proveedor_id    uuid not null references proveedores(id) on delete restrict,
    servicio        text not null,
    costo_mensual   numeric(12, 2) not null default 0.00,
    costo_anual     numeric(12, 2) not null default 0.00,
    fecha_inicio    date not null default current_date,
    no_contrato     text,
    contactos       jsonb not null default '[]'::jsonb,
    estado          text not null default 'activo',
    creado_por      uuid not null references usuarios(id),
    modificado_por  uuid references usuarios(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_servicios_proveedores_empresa on servicios_proveedores(empresa_id);
create index if not exists idx_servicios_proveedores_proveedor on servicios_proveedores(proveedor_id);

create table if not exists facturas_servicios_proveedores (
    id                      uuid primary key default gen_random_uuid(),
    servicio_proveedor_id   uuid not null references servicios_proveedores(id) on delete cascade,
    fecha_factura           date not null default current_date,
    monto_factura           numeric(12, 2) not null default 0.00,
    estado                  text not null default 'pendiente',
    forma_pago              text not null default 'transferencia',
    observaciones           text,
    creado_por              uuid not null references usuarios(id),
    modificado_por          uuid references usuarios(id),
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index if not exists idx_facturas_servicios_proveedor on facturas_servicios_proveedores(servicio_proveedor_id);

-- Triggers para set_updated_at
drop trigger if exists trg_set_updated_at on proveedores;
create trigger trg_set_updated_at before update on proveedores for each row execute function set_updated_at();

drop trigger if exists trg_set_updated_at on servicios_proveedores;
create trigger trg_set_updated_at before update on servicios_proveedores for each row execute function set_updated_at();

drop trigger if exists trg_set_updated_at on facturas_servicios_proveedores;
create trigger trg_set_updated_at before update on facturas_servicios_proveedores for each row execute function set_updated_at();

-- Registrar menu 'servicios_proveedores'
insert into menus (codigo, nombre, ruta, icono, orden) values
    ('servicios_proveedores', 'Servicios y Proveedores', '/servicios-proveedores', 'servicios_proveedores', 85)
on conflict (codigo) do nothing;

-- Asignar permisos iniciales a los roles
with datos (rol_codigo, menu_codigo, permiso_codigo) as (
    values
    ('admin', 'servicios_proveedores', 'ver'),
    ('admin', 'servicios_proveedores', 'crear'),
    ('admin', 'servicios_proveedores', 'editar'),
    ('admin', 'servicios_proveedores', 'eliminar'),
    ('supervisor', 'servicios_proveedores', 'ver'),
    ('supervisor', 'servicios_proveedores', 'crear'),
    ('supervisor', 'servicios_proveedores', 'editar'),
    ('tecnico', 'servicios_proveedores', 'ver')
)
insert into rol_menu_permisos (rol_id, menu_id, permiso_id)
select r.id, m.id, p.id
from datos d
join roles r on r.codigo = d.rol_codigo
join menus m on m.codigo = d.menu_codigo
join permisos p on p.codigo = d.permiso_codigo
on conflict (rol_id, menu_id, permiso_id) do nothing;
