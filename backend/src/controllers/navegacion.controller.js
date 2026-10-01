const { pool } = require('../config/db');
const { obtenerMenuParaRol, obtenerPermisosParaRol } = require('../utils/permisos');

// Los 3 items de configuracion cross-empresa (Empresas, Politica de
// password, Equipos catalogo) no viven en la tabla "menus" -- no son
// parte de la matriz por-rol, siguen gateados solo por es_super_admin,
// igual que hoy. Se agregan aca directo, solo para super-admin.
function itemsConfiguracion() {
  return {
    id: 'configuracion', codigo: 'configuracion', nombre: 'Configuracion', ruta: null, icono: 'configuracion',
    hijos: [
      { id: 'empresas', codigo: 'empresas', nombre: 'Empresas', ruta: '/empresas', icono: 'empresas', hijos: [] },
      { id: 'politica_password', codigo: 'politica_password', nombre: 'Politica de password', ruta: '/politica-password', icono: 'politica_password', hijos: [] },
      { id: 'equipos', codigo: 'equipos', nombre: 'Equipos', ruta: '/equipos', icono: 'equipos', hijos: [] },
      { id: 'roles_permisos', codigo: 'roles_permisos', nombre: 'Roles y permisos', ruta: '/roles-permisos', icono: 'roles_permisos', hijos: [] },
    ],
  };
}

// GET /api/menu -> arbol del sidebar para el usuario actual
async function obtenerMenu(req, res, next) {
  try {
    let arbol;
    if (req.usuario.es_super_admin) {
      // Super-admin ve todos los menus activos sin pasar por la matriz.
      const { rows } = await pool.query(
        'select id, codigo, nombre, ruta, icono, padre_id, orden from menus where activo = true order by orden'
      );
      const porId = new Map(rows.map((m) => [m.id, { ...m, hijos: [] }]));
      arbol = [];
      for (const m of porId.values()) {
        if (m.padre_id && porId.has(m.padre_id)) porId.get(m.padre_id).hijos.push(m);
        else arbol.push(m);
      }
      arbol.push(itemsConfiguracion());
    } else {
      arbol = await obtenerMenuParaRol(req.usuario.rol);
    }
    res.json(arbol);
  } catch (err) { next(err); }
}

// GET /api/mis-permisos -> { [menuCodigo]: ['ver','crear',...] }
async function obtenerMisPermisos(req, res, next) {
  try {
    if (req.usuario.es_super_admin) {
      const [{ rows: menus }, { rows: permisos }] = await Promise.all([
        pool.query('select codigo from menus where activo = true'),
        pool.query('select codigo from permisos'),
      ]);
      const codigosPermisos = permisos.map((p) => p.codigo);
      const mapa = {};
      for (const m of menus) mapa[m.codigo] = codigosPermisos;
      return res.json(mapa);
    }
    const mapa = await obtenerPermisosParaRol(req.usuario.rol);
    res.json(mapa);
  } catch (err) { next(err); }
}

module.exports = { obtenerMenu, obtenerMisPermisos };
