const router = require('express').Router();
const { login, register, me, actualizarPerfil, cambiarPassword } = require('../controllers/auth.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

router.post('/login', login);
// Registrar nuevos usuarios del sistema: solo un admin autenticado puede hacerlo
router.post('/register', requireAuth, requireRol('admin'), register);
router.get('/me', requireAuth, me);
router.put('/me', requireAuth, actualizarPerfil);
router.put('/password', requireAuth, cambiarPassword);

module.exports = router;
