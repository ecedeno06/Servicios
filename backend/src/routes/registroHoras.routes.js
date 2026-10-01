const router = require('express').Router();
const ctrl = require('../controllers/registroHoras.controller');
const { requireAuth, requireEmpresa, requirePermiso } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

router.get('/', ctrl.listar);
router.get('/consumo', ctrl.consumoGeneral);
router.get('/consumo/:contratoId', ctrl.consumoPorContrato);
// Rutas fijas de notificaciones antes de '/:id' para que express no las
// confunda con un id de registro.
router.get('/notificaciones', ctrl.listarNotificaciones);
router.get('/notificaciones/no-leidos', ctrl.contarComentariosNoLeidos);
router.get('/:id', ctrl.obtener);
// un cliente no ejecuta trabajo, no registra horas -- a 'cliente' no se
// le siembra permiso 'crear' aqui.
router.post('/', requirePermiso('horas', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('horas', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('horas', 'eliminar'), ctrl.eliminar);
router.get('/:id/comentarios', ctrl.listarComentarios);
router.post('/:id/comentarios', ctrl.agregarComentario); // cualquier rol autenticado puede comentar
router.post('/:id/comentarios/marcar-visto', ctrl.marcarComentariosVistos);

module.exports = router;
