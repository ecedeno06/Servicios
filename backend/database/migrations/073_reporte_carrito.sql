-- Migracion 073: agrega "Reporte de carrito de compras" como tercera
-- opcion del submenu "Reportes" (ver migracion 036: Reporte de horas /
-- Reporte de servicios).
insert into menus (codigo, nombre, ruta, icono, padre_id, orden)
select 'reporte_carrito', 'Reporte de carrito de compras', '/reportes/carrito-compras', 'reportes', m.id, 30
from menus m where m.codigo = 'reportes'
on conflict (codigo) do nothing;

-- Mismos roles que ya ven "Reportes" hoy (igual patron de copia que la 036).
insert into rol_menu_permisos (rol_id, menu_id, permiso_id)
select rmp.rol_id, hijo.id, rmp.permiso_id
from rol_menu_permisos rmp
join menus padre on padre.id = rmp.menu_id and padre.codigo = 'reportes'
join menus hijo on hijo.codigo = 'reporte_carrito'
on conflict (rol_id, menu_id, permiso_id) do nothing;
