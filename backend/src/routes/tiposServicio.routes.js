const router = require('express').Router();
const ctrl = require('../controllers/tiposServicio.controller');
const { requireAuth, requireEmpresa, requireRol } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', requireRol('admin', 'supervisor'), ctrl.crear);
router.put('/:id', requireRol('admin', 'supervisor'), ctrl.actualizar);
router.delete('/:id', requireRol('admin'), ctrl.eliminar);

module.exports = router;
