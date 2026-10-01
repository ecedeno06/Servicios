const router = require('express').Router();
const ctrl = require('../controllers/usuarios.controller');
const { requireAuth, requireEmpresa, requirePermiso } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

router.get('/', requirePermiso('usuarios', 'ver'), ctrl.listar);
router.get('/buscar', requirePermiso('usuarios', 'ver'), ctrl.buscarPorEmail);
router.get('/:id', requirePermiso('usuarios', 'ver'), ctrl.obtener);
router.post('/', requirePermiso('usuarios', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('usuarios', 'editar'), ctrl.actualizar);
router.post('/:id/resetear-password', requirePermiso('usuarios', 'editar'), ctrl.resetearPassword);
router.delete('/:id', requirePermiso('usuarios', 'eliminar'), ctrl.eliminar);

module.exports = router;
