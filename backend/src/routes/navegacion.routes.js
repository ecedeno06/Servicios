const router = require('express').Router();
const ctrl = require('../controllers/navegacion.controller');
const { requireAuth, requireEmpresa } = require('../middleware/auth');

router.get('/menu', requireAuth, requireEmpresa, ctrl.obtenerMenu);
router.get('/mis-permisos', requireAuth, requireEmpresa, ctrl.obtenerMisPermisos);

module.exports = router;
