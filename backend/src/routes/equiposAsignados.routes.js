const router = require('express').Router();
const ctrl = require('../controllers/equiposAsignados.controller');
const { requireAuth, requireEmpresa, requireRol } = require('../middleware/auth');

// Un super-admin que selecciono una empresa recibe rol 'admin' para esa
// empresa (ver seleccionarEmpresa), asi que requireRol('admin') ya cubre
// tanto al admin de la empresa como al super-admin.
router.use(requireAuth, requireEmpresa, requireRol('admin'));

router.get('/', ctrl.listar);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);
router.get('/:id/historial', ctrl.historial);

module.exports = router;
