const router = require('express').Router();
const ctrl = require('../controllers/permisos.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

router.get('/', requireAuth, requireSuperAdmin, ctrl.listar);

module.exports = router;
