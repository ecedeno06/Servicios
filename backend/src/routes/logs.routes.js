const router = require('express').Router();
const { listar, eliminar, registrarMensaje } = require('../controllers/logs.controller');
const { requireAuth, requireSuperAdmin, requirePassword } = require('../middleware/auth');

router.use(requireAuth);
// Cualquier usuario autenticado puede registrar un mensaje de exito que le
// mostro el frontend -- la consulta/borrado del historico (abajo) sigue
// siendo solo para super-admin.
router.post('/registrar', registrarMensaje);
router.get('/', requireSuperAdmin, listar);
router.post('/eliminar', requireSuperAdmin, requirePassword, eliminar);

module.exports = router;
