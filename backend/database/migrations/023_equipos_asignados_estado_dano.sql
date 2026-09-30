-- Migracion 023: agrega el estado 'dano' (equipo con un desperfecto
-- reportado, todavia sin decidir si va a reparacion o a descarte).
alter table equipos_asignados drop constraint if exists equipos_asignados_estado_check;
alter table equipos_asignados add constraint equipos_asignados_estado_check
    check (estado in ('en_uso', 'stock', 'reparacion', 'dano', 'descarte', 'vendida'));

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table equipos_asignados drop constraint if exists equipos_asignados_estado_check;
-- alter table equipos_asignados add constraint equipos_asignados_estado_check
--     check (estado in ('en_uso', 'stock', 'reparacion', 'descarte', 'vendida'));
