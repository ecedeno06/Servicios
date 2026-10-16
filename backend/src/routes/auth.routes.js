const router = require('express').Router();
const {
  login, verificar2FA, setup2FA, enable2FA, disable2FA,
  solicitarRecuperacion2FA, confirmarRecuperacion2FA, notificarIntentoFallido2FA,
  seleccionarEmpresa, misEmpresas, me, actualizarPerfil, cambiarPassword,
  obtenerPista, olvidoPassword, restablecerPassword, logout, sessionConfig, refreshSession,
} = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const rateLimitPista = require('../middleware/rateLimitPista');
const rateLimitOlvidoPassword = require('../middleware/rateLimitOlvidoPassword');
const rateLimitRecuperacion2FA = require('../middleware/rateLimitRecuperacion2FA');
const rateLimitNotificarAdmin2FA = require('../middleware/rateLimitNotificarAdmin2FA');

router.post('/login', login);
router.post('/2fa/verify-login', verificar2FA);
router.post('/2fa/recovery', rateLimitRecuperacion2FA, solicitarRecuperacion2FA);
router.post('/2fa/recovery/confirm', confirmarRecuperacion2FA);
router.post('/2fa/recovery/notificar-admin', rateLimitNotificarAdmin2FA, notificarIntentoFallido2FA);
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
router.post('/2fa/setup', requireAuth, setup2FA);
router.post('/2fa/enable', requireAuth, enable2FA);
router.post('/2fa/disable', requireAuth, disable2FA);
router.post('/logout', requireAuth, logout);
router.get('/session-config', sessionConfig);
router.post('/refresh-session', requireAuth, refreshSession);

module.exports = router;
