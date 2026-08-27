const router = require('express').Router();
const ctrl = require('../controllers/registroHoras.controller');
const { requireAuth, requireRol } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.listar);
router.get('/consumo', ctrl.consumoGeneral);
router.get('/consumo/:contratoId', ctrl.consumoPorContrato);
router.get('/:id', ctrl.obtener);
router.post('/', ctrl.crear); // cualquier usuario autenticado registra sus horas ejecutadas
router.put('/:id', requireRol('admin', 'supervisor'), ctrl.actualizar);
router.delete('/:id', requireRol('admin', 'supervisor'), ctrl.eliminar);

module.exports = router;
