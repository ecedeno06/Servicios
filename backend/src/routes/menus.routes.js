const router = require('express').Router();
const ctrl = require('../controllers/menus.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

router.use(requireAuth, requireSuperAdmin);

router.get('/', ctrl.listar);
router.put('/:id', ctrl.actualizar);

module.exports = router;
