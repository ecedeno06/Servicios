-- Migracion 022: precio de compra (USD) y locacion/pais del equipo.
-- Ambas opcionales, igual que el resto de especificaciones tecnicas.
alter table equipos_asignados
    add column if not exists precio_usd     numeric(12,2) check (precio_usd is null or precio_usd >= 0),
    add column if not exists locacion_pais  text;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table equipos_asignados drop column if exists precio_usd, drop column if exists locacion_pais;
