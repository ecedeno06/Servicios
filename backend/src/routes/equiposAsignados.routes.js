const router = require('express').Router();
const ctrl = require('../controllers/equiposAsignados.controller');
const { requireAuth, requireEmpresa, requirePermiso } = require('../middleware/auth');

router.use(requireAuth, requireEmpresa);

router.get('/', requirePermiso('equipos_asignados', 'ver'), ctrl.listar);
router.post('/', requirePermiso('equipos_asignados', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('equipos_asignados', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('equipos_asignados', 'eliminar'), ctrl.eliminar);
router.get('/:id/historial', requirePermiso('equipos_asignados', 'ver'), ctrl.historial);
router.post('/:id/movimiento', requirePermiso('equipos_asignados', 'editar'), ctrl.cambiarEstado);

router.get('/:id/adjuntos', requirePermiso('equipos_asignados', 'ver'), ctrl.listarAdjuntos);
router.post('/:id/adjuntos', requirePermiso('equipos_asignados', 'crear'), ctrl.crearAdjunto);
router.put('/:id/adjuntos/:adjuntoId', requirePermiso('equipos_asignados', 'editar'), ctrl.actualizarAdjunto);
router.delete('/:id/adjuntos/:adjuntoId', requirePermiso('equipos_asignados', 'eliminar'), ctrl.eliminarAdjunto);

router.get('/:id/checklist', requirePermiso('equipos_asignados', 'ver'), ctrl.listarChecklistEjecuciones);
router.post('/:id/checklist', requirePermiso('equipos_asignados', 'editar'), ctrl.crearChecklistEjecucion);
router.get('/:id/checklist/:ejecucionId', requirePermiso('equipos_asignados', 'ver'), ctrl.obtenerChecklistEjecucion);
router.put('/:id/checklist/:ejecucionId', requirePermiso('equipos_asignados', 'editar'), ctrl.actualizarChecklistEjecucion);
router.delete('/:id/checklist/:ejecucionId', requirePermiso('equipos_asignados', 'eliminar'), ctrl.eliminarChecklistEjecucion);
router.put('/:id/checklist/:ejecucionId/items/:checklistId', requirePermiso('equipos_asignados', 'editar'), ctrl.actualizarChecklistEjecucionItem);
router.post('/:id/checklist/:ejecucionId/enviar-pdf', requirePermiso('equipos_asignados', 'ver'), ctrl.enviarChecklistPdfPorCorreo);

module.exports = router;
