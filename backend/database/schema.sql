-- =========================================================
-- Esquema de base de datos - Gestion de Horas de Servicio
-- Motor: PostgreSQL (Supabase)
-- =========================================================

create extension if not exists "pgcrypto"; -- para gen_random_uuid()

-- ---------------------------------------------------------
-- Tabla: usuarios (usuarios del sistema: admin, supervisores, tecnicos)
-- ---------------------------------------------------------
create table if not exists usuarios (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    email           text not null unique,
    password_hash   text not null,
    rol             text not null check (rol in ('admin', 'supervisor', 'tecnico')) default 'tecnico',
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: clientes
-- ---------------------------------------------------------
create table if not exists clientes (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    identificacion  text unique,          -- RUC / NIT / Cedula juridica
    email           text,
    telefono        text,
    direccion       text,
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: tipos_servicio (catalogo de servicios que se prestan)
-- ---------------------------------------------------------
create table if not exists tipos_servicio (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null unique,
    descripcion     text,
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: contratos (contrato firmado por un cliente)
-- ---------------------------------------------------------
create table if not exists contratos (
    id                  uuid primary key default gen_random_uuid(),
    cliente_id          uuid not null references clientes(id) on delete restrict,
    numero_contrato     text not null unique,
    fecha_inicio        date not null,
    fecha_fin           date,
    estado              text not null check (estado in ('activo','vencido','cancelado','finalizado')) default 'activo',
    observaciones       text,
    -- Documentos asociados (OneDrive u otro origen): [{ "nombre": "...", "url": "..." }, ...]
    documentos          jsonb not null default '[]'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint chk_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

-- ---------------------------------------------------------
-- Tabla: contrato_servicios (horas establecidas por tipo de
-- servicio dentro de cada contrato -> "bolsas de horas")
-- ---------------------------------------------------------
create table if not exists contrato_servicios (
    id                  uuid primary key default gen_random_uuid(),
    contrato_id         uuid not null references contratos(id) on delete cascade,
    tipo_servicio_id    uuid not null references tipos_servicio(id) on delete restrict,
    horas_contratadas   numeric(10,2) not null check (horas_contratadas >= 0),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (contrato_id, tipo_servicio_id)
);

-- ---------------------------------------------------------
-- Tabla: registro_horas (horas realmente ejecutadas contra
-- el contrato / tipo de servicio, por un usuario/tecnico)
-- ---------------------------------------------------------
create table if not exists registro_horas (
    id                  uuid primary key default gen_random_uuid(),
    contrato_id         uuid not null references contratos(id) on delete cascade,
    tipo_servicio_id    uuid not null references tipos_servicio(id) on delete restrict,
    usuario_id          uuid not null references usuarios(id) on delete restrict,
    fecha               date not null default current_date,
    hora_inicio         time,
    hora_fin            time,
    horas               numeric(10,2) not null check (horas > 0),
    descripcion         text,
    -- Documentos asociados (OneDrive u otro origen): [{ "nombre": "...", "url": "..." }, ...]
    documentos          jsonb not null default '[]'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Indices
-- ---------------------------------------------------------
create index if not exists idx_contratos_cliente on contratos(cliente_id);
create index if not exists idx_contrato_servicios_contrato on contrato_servicios(contrato_id);
create index if not exists idx_contrato_servicios_tipo on contrato_servicios(tipo_servicio_id);
create index if not exists idx_registro_horas_contrato on registro_horas(contrato_id);
create index if not exists idx_registro_horas_tipo on registro_horas(tipo_servicio_id);
create index if not exists idx_registro_horas_usuario on registro_horas(usuario_id);
create index if not exists idx_registro_horas_fecha on registro_horas(fecha);

-- ---------------------------------------------------------
-- Vista: consumo de horas por servicio contratado
-- (horas contratadas vs ejecutadas vs disponibles)
-- ---------------------------------------------------------
create or replace view vista_consumo_horas as
select
    cs.id                   as contrato_servicio_id,
    c.id                    as contrato_id,
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
group by cs.id, c.id, c.numero_contrato, c.estado, cl.id, cl.nombre, ts.id, ts.nombre, cs.horas_contratadas;

-- ---------------------------------------------------------
-- Trigger generico para actualizar updated_at
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$
declare
    t text;
begin
    foreach t in array array['usuarios','clientes','tipos_servicio','contratos','contrato_servicios','registro_horas']
    loop
        execute format('drop trigger if exists trg_set_updated_at on %I', t);
        execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
    end loop;
end $$;

-- ---------------------------------------------------------
-- Usuario administrador inicial (cambiar password despues del
-- primer login). Password de ejemplo: "Admin123!" ya hasheado
-- con bcrypt (10 rounds). Genera el tuyo con el endpoint
-- POST /api/auth/register o con el script backend/scripts/hash.js
-- ---------------------------------------------------------
-- insert into usuarios (nombre, email, password_hash, rol)
-- values ('Administrador', 'admin@empresa.com', '<hash_bcrypt_aqui>', 'admin');

-- ---------------------------------------------------------
-- Nota sobre RLS (Row Level Security):
-- Este proyecto usa un backend Node.js/Express que se conecta
-- con la cadena de conexion directa de Postgres (o el rol de
-- servicio de Supabase), por lo que RLS puede permanecer
-- deshabilitado ya que el control de acceso se hace en la API.
-- Si en el futuro el frontend habla directo con Supabase
-- (supabase-js) hay que habilitar RLS y crear policies por tabla.
-- ---------------------------------------------------------
