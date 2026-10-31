-- Migracion 080: agrega "Reporte de equipos asignados" como cuarta opcion
-- del submenu "Reportes" (ver migracion 036: Reporte de horas / Reporte de
-- servicios, y 073: Reporte de carrito de compras).
insert into menus (codigo, nombre, ruta, icono, padre_id, orden)
select 'reporte_equipos_asignados', 'Reporte de equipos asignados', '/reportes/equipos-asignados', 'reportes', m.id, 40
from menus m where m.codigo = 'reportes'
on conflict (codigo) do nothing;

-- Mismos roles que ya ven "Reportes" hoy (igual patron de copia que la 036/073).
insert into rol_menu_permisos (rol_id, menu_id, permiso_id)
select rmp.rol_id, hijo.id, rmp.permiso_id
from rol_menu_permisos rmp
join menus padre on padre.id = rmp.menu_id and padre.codigo = 'reportes'
join menus hijo on hijo.codigo = 'reporte_equipos_asignados'
on conflict (rol_id, menu_id, permiso_id) do nothing;

-- Rollback:
-- delete from rol_menu_permisos where menu_id = (select id from menus where codigo = 'reporte_equipos_asignados');
-- delete from menus where codigo = 'reporte_equipos_asignados';
