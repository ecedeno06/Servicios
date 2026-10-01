const router = require('express').Router();
const ctrl = require('../controllers/contratos.controller');
const { requireAuth, requireEmpresa, requirePermiso } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

// Contratos no es visible para el rol cliente (ver PORTAL-CLIENTE.md) --
// a 'cliente' no se le siembra permiso 'ver' aqui.
router.get('/', requirePermiso('contratos', 'ver'), ctrl.listar);
router.get('/:id', requirePermiso('contratos', 'ver'), ctrl.obtener);
router.post('/', requirePermiso('contratos', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('contratos', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('contratos', 'eliminar'), ctrl.eliminar);

router.post('/:id/servicios', requirePermiso('contratos', 'crear'), ctrl.agregarServicio);
router.put('/:id/servicios/:contratoServicioId', requirePermiso('contratos', 'editar'), ctrl.actualizarServicio);
router.delete('/:id/servicios/:contratoServicioId', requirePermiso('contratos', 'eliminar'), ctrl.eliminarServicio);

module.exports = router;
