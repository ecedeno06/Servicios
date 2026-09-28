const router = require('express').Router();
const { login, seleccionarEmpresa, misEmpresas, me, actualizarPerfil, cambiarPassword, obtenerPista, olvidoPassword, restablecerPassword, logout, sessionConfig, refreshSession } = require('../controllers/auth.controller');
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
router.post('/logout', requireAuth, logout);
router.get('/session-config', sessionConfig);
router.post('/refresh-session', requireAuth, refreshSession);

module.exports = router;
