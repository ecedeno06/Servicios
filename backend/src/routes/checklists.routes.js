const router = require('express').Router();
const ctrl = require('../controllers/checklists.controller');
const { requireAuth, requireEmpresa, requireSuperAdmin } = require('../middleware/auth');

// Lectura: cualquier usuario autenticado de la empresa (lo necesita, por
// ejemplo, el popup de cambio de estado en Equipos Asignados para marcar
// items del checklist). Escritura: solo super-admin, vive en Configuracion.
router.use(requireAuth, requireEmpresa);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.post('/', requireSuperAdmin, ctrl.crear);
router.put('/:id', requireSuperAdmin, ctrl.actualizar);
router.delete('/:id', requireSuperAdmin, ctrl.eliminar);

module.exports = router;
