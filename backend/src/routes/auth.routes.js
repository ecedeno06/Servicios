const router = require('express').Router();
const { login, seleccionarEmpresa, misEmpresas, me, actualizarPerfil, cambiarPassword, obtenerPista, olvidoPassword, restablecerPassword } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const rateLimitPista = require('../middleware/rateLimitPista');
const rateLimitOlvidoPassword = require('../middleware/rateLimitOlvidoPassword');

router.post('/login', login);
// Completa el login cuando el usuario tiene mas de una empresa, o cambia
// la empresa activa de una sesion ya iniciada.
router.post('/seleccionar-empresa', requireAuth, seleccionarEmpresa);
router.get('/mis-empresas', requireAuth, misEmpresas);
router.get('/pista', rateLimitPista, obtenerPista);
router.post('/forgot-password', rateLimitOlvidoPassword, olvidoPassword);
router.post('/reset-password', restablecerPassword);
router.get('/me', requireAuth, me);
router.put('/me', requireAuth, actualizarPerfil);
router.put('/password', requireAuth, cambiarPassword);

module.exports = router;
