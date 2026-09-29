const router = require('express').Router();
const ctrl = require('../controllers/productos.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// Catalogo global compartido por todas las empresas: solo super-admin.
router.use(requireAuth, requireSuperAdmin);

router.get('/', ctrl.listar);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
