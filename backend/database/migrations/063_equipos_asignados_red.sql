-- Migracion 063: datos de red del equipo (MAC address, IP fija) -- ambas
-- opcionales, junto al resto de especificaciones tecnicas.

alter table equipos_asignados add column if not exists mac_address text;
alter table equipos_asignados add column if not exists ip_fija text;
