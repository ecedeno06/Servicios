const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/empresas', require('./empresas.routes'));
router.use('/usuarios', require('./usuarios.routes'));
router.use('/clientes', require('./clientes.routes'));
router.use('/tipos-servicio', require('./tiposServicio.routes'));
router.use('/contratos', require('./contratos.routes'));
router.use('/horas', require('./registroHoras.routes'));
router.use('/politica-password', require('./politicaPassword.routes'));
router.use('/auditoria', require('./auditoria.routes'));
router.use('/categorias', require('./categorias.routes'));
router.use('/productos', require('./productos.routes'));
router.use('/procesadores', require('./procesadores.routes'));
router.use('/equipos-asignados', require('./equiposAsignados.routes'));

module.exports = router;
