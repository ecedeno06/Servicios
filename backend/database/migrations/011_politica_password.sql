-- Migracion 011: politica de password configurable + cambio de password
-- obligatorio, portado del proyecto "clinica" (mismo diseño).
--
-- - politica_password: tabla singleton (una sola fila, id=1), sembrada con
--   los valores que reproducen el comportamiento ACTUAL exacto (minimo 6,
--   sin requisitos de caracteres, pista minima 4, similitud maxima 70) para
--   que aplicar esta migracion no cambie nada hasta que un super-admin la
--   endurezca desde la pantalla nueva.
-- - usuarios.debe_cambiar_password: se activa cuando un admin crea un
--   usuario o le resetea la contrasena (la conoce, es temporal); se limpia
--   sola cuando el propio usuario cambia su contrasena via /auth/password.
-- - usuarios.pista: pista de contrasena opcional (solo se guarda; la
--   pantalla de login/recuperacion que la muestra no forma parte de este
--   cambio).

create table if not exists politica_password (
    id                                smallint primary key default 1 check (id = 1),
    longitud_minima                   integer not null default 6 check (longitud_minima >= 1),
    requiere_mayuscula                boolean not null default false,
    requiere_minuscula                boolean not null default false,
    requiere_numero                   boolean not null default false,
    requiere_caracter_especial        boolean not null default false,
    pista_longitud_minima             integer not null default 4 check (pista_longitud_minima >= 1),
    pista_similitud_maxima_porcentaje integer not null default 70 check (pista_similitud_maxima_porcentaje between 0 and 100),
    updated_at                        timestamptz not null default now()
);

insert into politica_password (id) values (1) on conflict (id) do nothing;

alter table usuarios add column if not exists debe_cambiar_password boolean not null default false;
alter table usuarios add column if not exists pista text;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table usuarios drop column if exists pista;
-- alter table usuarios drop column if exists debe_cambiar_password;
-- drop table if exists politica_password;
