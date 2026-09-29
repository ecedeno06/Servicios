-- Migracion 016: equipos asignados a una empresa (tabla intermedia entre
-- el catalogo global de productos y empresas). Registra cada unidad
-- fisica de equipo que una empresa tiene, con su estado y a quien esta
-- asignada.
create table if not exists equipos_asignados (
    id                uuid primary key default gen_random_uuid(),
    empresa_id        uuid not null references empresas(id) on delete cascade,
    -- Referencia al catalogo global (ver migracion 015). on delete restrict:
    -- no se puede borrar un producto del catalogo si hay equipos asignados
    -- usandolo.
    producto_id       integer not null references productos(id) on delete restrict,
    -- marca/modelo se auto-completan en el frontend a partir del producto
    -- elegido, pero quedan como columnas propias (editables) para que un
    -- cambio o borrado futuro del producto en el catalogo no le borre el
    -- historial a este registro.
    marca             text not null,
    modelo            text not null,
    fecha_entrada     date not null default current_date,
    vida_util_meses   integer check (vida_util_meses is null or vida_util_meses > 0),
    estado            text not null default 'stock' check (estado in ('en_uso', 'stock', 'reparacion', 'descarte', 'vendida')),
    -- Texto libre (no un usuario del sistema): a quien tiene el equipo
    -- cuando estado = 'en_uso' (nombre de persona, area, ubicacion, etc.).
    asignada_a        text,
    observacion       text,
    creado_por        uuid not null references usuarios(id),
    modificado_por    uuid references usuarios(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_equipos_asignados_empresa on equipos_asignados(empresa_id);
create index if not exists idx_equipos_asignados_producto on equipos_asignados(producto_id);

-- Reusa el trigger generico ya definido en schema.sql (migracion 001).
drop trigger if exists trg_set_updated_at on equipos_asignados;
create trigger trg_set_updated_at before update on equipos_asignados for each row execute function set_updated_at();

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists equipos_asignados;
