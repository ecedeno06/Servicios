const router = require('express').Router();
const ctrl = require('../controllers/empresas.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// Gestion de empresas: solo super-admin (no un admin de una empresa puntual)
router.use(requireAuth, requireSuperAdmin);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
