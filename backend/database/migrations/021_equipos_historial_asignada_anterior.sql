-- Migracion 021: reasignar un equipo de una persona a otra sin cambiar su
-- estado (ej. sigue "en_uso" pero pasa de Pedro a Ana) no generaba ningun
-- registro en equipos_historial, porque solo se comparaba el estado. Para
-- poder mostrar "reasignado de X a Y" en el historico hace falta guardar
-- tambien el valor anterior de asignada_a en cada movimiento.
alter table equipos_historial
    add column if not exists asignada_a_anterior text;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table equipos_historial drop column if exists asignada_a_anterior;
