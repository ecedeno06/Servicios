const router = require('express').Router();
const ctrl = require('../controllers/roles.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// Administrar roles (crear/editar/borrar) es exclusivo de super-admin --
// a diferencia de agro, donde estos endpoints solo pedian estar logueado.
// Listar es de solo lectura (codigo/nombre/activo, nada sensible) y lo
// necesita cualquier pantalla que asigne un rol a un usuario -- Usuarios
// puede abrirla un admin normal (via requirePermiso), no solo super-admin.
router.get('/', requireAuth, ctrl.listar);
router.post('/', requireAuth, requireSuperAdmin, ctrl.crear);
router.put('/:id', requireAuth, requireSuperAdmin, ctrl.actualizar);
router.delete('/:id', requireAuth, requireSuperAdmin, ctrl.eliminar);

module.exports = router;
