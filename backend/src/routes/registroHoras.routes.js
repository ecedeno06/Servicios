const router = require('express').Router();
const ctrl = require('../controllers/registroHoras.controller');
const { requireAuth, requireEmpresa, requireRol, bloquearCliente } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

router.get('/', ctrl.listar);
router.get('/consumo', ctrl.consumoGeneral);
router.get('/consumo/:contratoId', ctrl.consumoPorContrato);
router.get('/:id', ctrl.obtener);
router.post('/', bloquearCliente, ctrl.crear); // un cliente no ejecuta trabajo, no registra horas
router.put('/:id', requireRol('admin', 'supervisor'), ctrl.actualizar);
router.delete('/:id', requireRol('admin', 'supervisor'), ctrl.eliminar);
router.post('/:id/comentarios', ctrl.agregarComentario); // cualquier rol autenticado puede comentar

module.exports = router;
