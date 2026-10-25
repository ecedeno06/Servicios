const router = require('express').Router();
const { listar, eliminar } = require('../controllers/logs.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

router.use(requireAuth, requireSuperAdmin);
router.get('/', listar);
router.post('/eliminar', eliminar);

module.exports = router;
