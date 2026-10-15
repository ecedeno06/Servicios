-- Migracion 050: tabla de parametros "Checklists" -- catalogo generico
-- por empresa (descripcion + observacion), gestionable desde
-- Configuracion. Sin uso todavia en otra tabla (queda para uso futuro),
-- mismo patron que sectores_proveedores / estados_servicios_proveedores.

create table if not exists checklists (
    id              uuid primary key default gen_random_uuid(),
    empresa_id      uuid not null references empresas(id) on delete cascade,
    descripcion     text not null,
    observacion     text,
    activo          boolean not null default true,
    creado_por      uuid not null references usuarios(id),
    modificado_por  uuid references usuarios(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_checklists_empresa on checklists(empresa_id);

drop trigger if exists trg_set_updated_at on checklists;
create trigger trg_set_updated_at before update on checklists for each row execute function set_updated_at();
