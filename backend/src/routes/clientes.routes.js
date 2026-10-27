const router = require('express').Router();
const ctrl = require('../controllers/clientes.controller');
const { requireAuth, requireEmpresa, requirePermiso, requirePassword } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

// El catalogo de clientes no es visible para el rol cliente (ver
// PORTAL-CLIENTE.md) -- a 'cliente' no se le siembra permiso 'ver' aqui.
router.get('/', requirePermiso('clientes', 'ver'), ctrl.listar);
router.get('/:id', requirePermiso('clientes', 'ver'), ctrl.obtener);
router.post('/', requirePermiso('clientes', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('clientes', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('clientes', 'eliminar'), requirePassword, ctrl.eliminar);

module.exports = router;
