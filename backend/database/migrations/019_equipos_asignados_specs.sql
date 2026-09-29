-- Migracion 019: especificaciones tecnicas del equipo asignado (CPU,
-- memoria, disco, numero de serie y puertos). Todas nullable: son datos
-- adicionales, no requeridos para dar de alta un equipo.
alter table equipos_asignados
    add column if not exists procesador_id        integer references procesadores(id) on delete set null,
    add column if not exists memoria_ram           text,
    add column if not exists disco_duro            text,
    add column if not exists numero_serie          text,
    add column if not exists numero_puertos        integer check (numero_puertos is null or numero_puertos >= 0),
    add column if not exists numero_puertos_hdmi   integer check (numero_puertos_hdmi is null or numero_puertos_hdmi >= 0);

create index if not exists idx_equipos_asignados_procesador on equipos_asignados(procesador_id);

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table equipos_asignados
--     drop column if exists procesador_id,
--     drop column if exists memoria_ram,
--     drop column if exists disco_duro,
--     drop column if exists numero_serie,
--     drop column if exists numero_puertos,
--     drop column if exists numero_puertos_hdmi;
