const { pool } = require('../config/db');

// Cache en memoria por rol_codigo -- la matriz cambia muy poco (solo
// cuando un super-admin la edita desde Configuracion), asi que no vale
// la pena consultarla en cada peticion. invalidarCache() se llama desde
// los controllers que escriben roles/menus/rol_menu_permisos.
let cachePermisos = new Map(); // rol_codigo -> { [menu_codigo]: Set(permiso_codigo) }
let cacheMenu = null; // arbol de menus completo (independiente del rol; se filtra en memoria)

function invalidarCache() {
  cachePermisos = new Map();
  cacheMenu = null;
}

async function cargarMenusActivos() {
  if (cacheMenu) return cacheMenu;
  const { rows } = await pool.query(
    'select id, codigo, nombre, ruta, icono, padre_id, orden from menus where activo = true order by orden'
  );
  cacheMenu = rows;
  return rows;
}

async function cargarPermisosDelRol(rolCodigo) {
  if (cachePermisos.has(rolCodigo)) return cachePermisos.get(rolCodigo);
  const { rows } = await pool.query(
    `select m.codigo as menu_codigo, p.codigo as permiso_codigo
     from rol_menu_permisos rmp
     join roles r on r.id = rmp.rol_id
     join menus m on m.id = rmp.menu_id and m.activo = true
     join permisos p on p.id = rmp.permiso_id
     where r.codigo = $1 and r.activo = true`,
    [rolCodigo]
  );
  const mapa = {};
  for (const row of rows) {
    if (!mapa[row.menu_codigo]) mapa[row.menu_codigo] = new Set();
    mapa[row.menu_codigo].add(row.permiso_codigo);
  }
  cachePermisos.set(rolCodigo, mapa);
  return mapa;
}

async function tienePermiso(rolCodigo, menuCodigo, permisoCodigo) {
  if (!rolCodigo || !menuCodigo || !permisoCodigo) return false;
  const mapa = await cargarPermisosDelRol(rolCodigo);
  return !!mapa[menuCodigo]?.has(permisoCodigo);
}

// { [menuCodigo]: ['ver','crear',...] } -- para que el frontend gatee
// botones sin tener que pedir permiso por permiso.
async function obtenerPermisosParaRol(rolCodigo) {
  const mapa = await cargarPermisosDelRol(rolCodigo);
  const resultado = {};
  for (const [menuCodigo, set] of Object.entries(mapa)) {
    resultado[menuCodigo] = Array.from(set);
  }
  return resultado;
}

// Arbol de menu (solo items con al menos un permiso concedido al rol).
async function obtenerMenuParaRol(rolCodigo) {
  const [menus, permisos] = await Promise.all([cargarMenusActivos(), cargarPermisosDelRol(rolCodigo)]);
  const concedidos = menus.filter((m) => permisos[m.codigo]?.size > 0);
  const porId = new Map(concedidos.map((m) => [m.id, { ...m, hijos: [] }]));
  const raiz = [];
  for (const m of porId.values()) {
    if (m.padre_id && porId.has(m.padre_id)) {
      porId.get(m.padre_id).hijos.push(m);
    } else {
      raiz.push(m);
    }
  }
  return raiz;
}

module.exports = { tienePermiso, obtenerPermisosParaRol, obtenerMenuParaRol, invalidarCache };
