const router = require('express').Router();
const ctrl = require('../controllers/checklists.controller');
const { requireAuth, requireEmpresa, requireSuperAdmin } = require('../middleware/auth');

// Catalogo expuesto solo en Configuracion -- igual que Estados de
// Servicio, solo super-admin puede ver/editar.
router.use(requireAuth, requireEmpresa, requireSuperAdmin);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
