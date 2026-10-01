const router = require('express').Router();
const ctrl = require('../controllers/tiposServicio.controller');
const { requireAuth, requireEmpresa, requirePermiso } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

router.get('/', requirePermiso('tipos_servicio', 'ver'), ctrl.listar);
router.get('/:id', requirePermiso('tipos_servicio', 'ver'), ctrl.obtener);
router.post('/', requirePermiso('tipos_servicio', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('tipos_servicio', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('tipos_servicio', 'eliminar'), ctrl.eliminar);

module.exports = router;
