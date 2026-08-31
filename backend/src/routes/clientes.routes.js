const router = require('express').Router();
const ctrl = require('../controllers/clientes.controller');
const { requireAuth, requireEmpresa, requireRol, bloquearCliente } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

// El catalogo de clientes no es visible para el rol cliente (ver PORTAL-CLIENTE.md).
router.get('/', bloquearCliente, ctrl.listar);
router.get('/:id', bloquearCliente, ctrl.obtener);
router.post('/', requireRol('admin', 'supervisor'), ctrl.crear);
router.put('/:id', requireRol('admin', 'supervisor'), ctrl.actualizar);
router.delete('/:id', requireRol('admin'), ctrl.eliminar);

module.exports = router;
