const router = require('express').Router();
const { listarSesiones, cerrarSesiones, bloquearUsuario } = require('../controllers/auditoria.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/sesiones', listarSesiones);
router.post('/sesiones/cerrar', cerrarSesiones);
router.post('/usuarios/:id/bloquear', bloquearUsuario);

module.exports = router;
