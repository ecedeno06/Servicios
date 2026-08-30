const router = require('express').Router();
const { login, seleccionarEmpresa, misEmpresas, me, actualizarPerfil, cambiarPassword } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

router.post('/login', login);
// Completa el login cuando el usuario tiene mas de una empresa, o cambia
// la empresa activa de una sesion ya iniciada.
router.post('/seleccionar-empresa', requireAuth, seleccionarEmpresa);
router.get('/mis-empresas', requireAuth, misEmpresas);
router.get('/me', requireAuth, me);
router.put('/me', requireAuth, actualizarPerfil);
router.put('/password', requireAuth, cambiarPassword);

module.exports = router;
