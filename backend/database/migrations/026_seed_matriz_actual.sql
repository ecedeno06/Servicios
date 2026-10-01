-- Migracion 026: siembra la matriz rol x menu x permiso para que
-- reproduzca EXACTO el acceso de hoy (cruzando requireRol/bloquearCliente
-- del backend, los route guards de Angular y las condiciones @if del
-- sidebar -- la mas restrictiva de las tres gana, porque es la que el
-- usuario realmente experimenta hoy).
--
-- Nota: 'usuarios' y 'equipos_asignados' quedan admin-only, igual que
-- hoy exige el backend y el sidebar -- esto ademas cierra el hueco donde
-- el route guard de Angular solo bloqueaba al rol 'cliente' (ver plan).
with datos (rol_codigo, menu_codigo, permiso_codigo) as (
    values
    ('admin', 'dashboard', 'ver'),
    ('supervisor', 'dashboard', 'ver'),
    ('tecnico', 'dashboard', 'ver'),
    ('cliente', 'dashboard', 'ver'),

    ('admin', 'contratos', 'ver'), ('admin', 'contratos', 'crear'), ('admin', 'contratos', 'editar'), ('admin', 'contratos', 'eliminar'),
    ('supervisor', 'contratos', 'ver'), ('supervisor', 'contratos', 'crear'), ('supervisor', 'contratos', 'editar'),
    ('tecnico', 'contratos', 'ver'),

    ('admin', 'horas', 'ver'), ('admin', 'horas', 'crear'), ('admin', 'horas', 'editar'), ('admin', 'horas', 'eliminar'),
    ('supervisor', 'horas', 'ver'), ('supervisor', 'horas', 'crear'), ('supervisor', 'horas', 'editar'), ('supervisor', 'horas', 'eliminar'),
    ('tecnico', 'horas', 'ver'), ('tecnico', 'horas', 'crear'),
    ('cliente', 'horas', 'ver'),

    ('admin', 'reportes', 'ver'),
    ('supervisor', 'reportes', 'ver'),
    ('tecnico', 'reportes', 'ver'),

    ('admin', 'clientes', 'ver'), ('admin', 'clientes', 'crear'), ('admin', 'clientes', 'editar'), ('admin', 'clientes', 'eliminar'),
    ('supervisor', 'clientes', 'ver'), ('supervisor', 'clientes', 'crear'), ('supervisor', 'clientes', 'editar'),
    ('tecnico', 'clientes', 'ver'),

    ('admin', 'tipos_servicio', 'ver'), ('admin', 'tipos_servicio', 'crear'), ('admin', 'tipos_servicio', 'editar'), ('admin', 'tipos_servicio', 'eliminar'),
    ('supervisor', 'tipos_servicio', 'ver'), ('supervisor', 'tipos_servicio', 'crear'), ('supervisor', 'tipos_servicio', 'editar'),
    ('tecnico', 'tipos_servicio', 'ver'),

    ('admin', 'usuarios', 'ver'), ('admin', 'usuarios', 'crear'), ('admin', 'usuarios', 'editar'), ('admin', 'usuarios', 'eliminar'),

    ('admin', 'equipos_asignados', 'ver'), ('admin', 'equipos_asignados', 'crear'), ('admin', 'equipos_asignados', 'editar'), ('admin', 'equipos_asignados', 'eliminar'),

    ('admin', 'auditoria_sesiones', 'ver'), ('admin', 'auditoria_sesiones', 'editar')
)
insert into rol_menu_permisos (rol_id, menu_id, permiso_id)
select r.id, m.id, p.id
from datos d
join roles r on r.codigo = d.rol_codigo
join menus m on m.codigo = d.menu_codigo
join permisos p on p.codigo = d.permiso_codigo
on conflict (rol_id, menu_id, permiso_id) do nothing;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- truncate table rol_menu_permisos;
