const router = require('express').Router();
const ctrl = require('../controllers/contratos.controller');
const { requireAuth, requireEmpresa, requireRol } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', requireRol('admin', 'supervisor'), ctrl.crear);
router.put('/:id', requireRol('admin', 'supervisor'), ctrl.actualizar);
router.delete('/:id', requireRol('admin'), ctrl.eliminar);

router.post('/:id/servicios', requireRol('admin', 'supervisor'), ctrl.agregarServicio);
router.put('/:id/servicios/:contratoServicioId', requireRol('admin', 'supervisor'), ctrl.actualizarServicio);
router.delete('/:id/servicios/:contratoServicioId', requireRol('admin'), ctrl.eliminarServicio);

module.exports = router;
