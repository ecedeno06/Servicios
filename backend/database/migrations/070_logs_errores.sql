-- Tabla de logs de errores: captura cada excepcion que llega al
-- error-handler global (backend/src/middleware/errorHandler.js), para
-- poder auditarlas despues desde "Configuracion" (solo super-admin),
-- igual que Auditoria de Sesiones. No tiene updated_at -- un log es
-- un registro inmutable, nunca se edita, solo se inserta.
create table if not exists logs_errores (
    id              uuid primary key default gen_random_uuid(),
    nivel           text not null default 'error' check (nivel in ('error', 'advertencia')),
    mensaje         text not null,
    stack           text,
    codigo          text,
    metodo_http     text,
    ruta            text,
    status_http     integer,
    -- Nullable: muchos errores ocurren antes de resolver empresa/usuario
    -- (login fallido, token invalido antes del catch, etc.).
    empresa_id      uuid references empresas(id) on delete set null,
    usuario_id      uuid references usuarios(id) on delete set null,
    ip_address      text,
    body            jsonb,
    created_at      timestamptz not null default now()
);

create index if not exists idx_logs_errores_created_at on logs_errores(created_at desc);
create index if not exists idx_logs_errores_empresa on logs_errores(empresa_id);
create index if not exists idx_logs_errores_nivel on logs_errores(nivel);
