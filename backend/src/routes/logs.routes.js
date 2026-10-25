const router = require('express').Router();
const { listar } = require('../controllers/logs.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

router.use(requireAuth, requireSuperAdmin);
router.get('/', listar);

module.exports = router;
