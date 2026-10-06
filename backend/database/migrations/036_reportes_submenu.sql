-- Migracion 036: convierte "Reportes" en un submenu con dos opciones --
-- Reporte de horas (ya existia, se reubica como hijo) y Reporte de
-- servicios (nuevo).

-- El padre deja de ser navegable (ruta null) -- mismo patron que el
-- item hardcodeado "Configuracion" en navegacion.controller.js.
update menus set ruta = null where codigo = 'reportes';

insert into menus (codigo, nombre, ruta, icono, padre_id, orden)
select 'reporte_horas', 'Reporte de horas', '/reportes', 'reportes', m.id, 10
from menus m where m.codigo = 'reportes'
on conflict (codigo) do nothing;

insert into menus (codigo, nombre, ruta, icono, padre_id, orden)
select 'reporte_servicios', 'Reporte de servicios', '/reportes/servicios', 'reportes', m.id, 20
from menus m where m.codigo = 'reportes'
on conflict (codigo) do nothing;

-- Copia los permisos que ya tenia el padre "reportes" (admin, tecnico: ver)
-- hacia los dos hijos nuevos, para que quien ya veia el reporte de horas
-- siga viendolo, y vea tambien el nuevo reporte de servicios.
insert into rol_menu_permisos (rol_id, menu_id, permiso_id)
select rmp.rol_id, hijo.id, rmp.permiso_id
from rol_menu_permisos rmp
join menus padre on padre.id = rmp.menu_id and padre.codigo = 'reportes'
join menus hijo on hijo.codigo = 'reporte_horas'
on conflict (rol_id, menu_id, permiso_id) do nothing;

insert into rol_menu_permisos (rol_id, menu_id, permiso_id)
select rmp.rol_id, hijo.id, rmp.permiso_id
from rol_menu_permisos rmp
join menus padre on padre.id = rmp.menu_id and padre.codigo = 'reportes'
join menus hijo on hijo.codigo = 'reporte_servicios'
on conflict (rol_id, menu_id, permiso_id) do nothing;
