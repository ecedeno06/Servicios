const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/empresas', require('./empresas.routes'));
router.use('/usuarios', require('./usuarios.routes'));
router.use('/clientes', require('./clientes.routes'));
router.use('/tipos-servicio', require('./tiposServicio.routes'));
router.use('/contratos', require('./contratos.routes'));
router.use('/horas', require('./registroHoras.routes'));

module.exports = router;
