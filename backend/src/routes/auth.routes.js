const router = require('express').Router();
const { login, register, me } = require('../controllers/auth.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

router.post('/login', login);
// Registrar nuevos usuarios del sistema: solo un admin autenticado puede hacerlo
router.post('/register', requireAuth, requireRol('admin'), register);
router.get('/me', requireAuth, me);

module.exports = router;
