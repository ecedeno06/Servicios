const router = require('express').Router();
const ctrl = require('../controllers/rolMenuPermisos.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

router.use(requireAuth, requireSuperAdmin);

router.get('/:rolId', ctrl.obtenerDeRol);
router.post('/', ctrl.guardarDeRol);

module.exports = router;
