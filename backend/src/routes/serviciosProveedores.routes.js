const router = require('express').Router();
const ctrl = require('../controllers/serviciosProveedores.controller');
const { requireAuth, requireEmpresa, requirePermiso } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireEmpresa);

// Servicios
router.get('/', requirePermiso('servicios_proveedores', 'ver'), ctrl.listar);
// Antes de "/:id" -- si no, Express interpreta "reporte" como el :id.
router.get('/reporte/pagos', requirePermiso('servicios_proveedores', 'ver'), ctrl.reportePagos);
router.get('/:id', requirePermiso('servicios_proveedores', 'ver'), ctrl.obtenerPorId);
router.post('/', requirePermiso('servicios_proveedores', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('servicios_proveedores', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('servicios_proveedores', 'eliminar'), ctrl.eliminar);

// Facturas / Transacciones
router.get('/:id/facturas', requirePermiso('servicios_proveedores', 'ver'), ctrl.listarFacturas);
router.post('/:id/facturas', requirePermiso('servicios_proveedores', 'crear'), ctrl.crearFactura);
router.put('/:id/facturas/:facturaId', requirePermiso('servicios_proveedores', 'editar'), ctrl.actualizarFactura);
router.delete('/:id/facturas/:facturaId', requirePermiso('servicios_proveedores', 'eliminar'), ctrl.eliminarFactura);

// Adjuntos (imagenes/documentos)
router.get('/:id/adjuntos', requirePermiso('servicios_proveedores', 'ver'), ctrl.listarAdjuntos);
router.post('/:id/adjuntos', requirePermiso('servicios_proveedores', 'crear'), ctrl.crearAdjunto);
router.put('/:id/adjuntos/:adjuntoId', requirePermiso('servicios_proveedores', 'editar'), ctrl.actualizarAdjunto);
router.delete('/:id/adjuntos/:adjuntoId', requirePermiso('servicios_proveedores', 'eliminar'), ctrl.eliminarAdjunto);

// Adjuntos de una factura (imagenes/documentos)
router.get('/:id/facturas/:facturaId/adjuntos', requirePermiso('servicios_proveedores', 'ver'), ctrl.listarAdjuntosFactura);
router.post('/:id/facturas/:facturaId/adjuntos', requirePermiso('servicios_proveedores', 'crear'), ctrl.crearAdjuntoFactura);
router.put('/:id/facturas/:facturaId/adjuntos/:adjuntoId', requirePermiso('servicios_proveedores', 'editar'), ctrl.actualizarAdjuntoFactura);
router.delete('/:id/facturas/:facturaId/adjuntos/:adjuntoId', requirePermiso('servicios_proveedores', 'eliminar'), ctrl.eliminarAdjuntoFactura);

// Incidentes
router.get('/:id/incidentes', requirePermiso('servicios_proveedores', 'ver'), ctrl.listarIncidentes);
router.post('/:id/incidentes', requirePermiso('servicios_proveedores', 'crear'), ctrl.crearIncidente);
router.put('/:id/incidentes/:incidenteId', requirePermiso('servicios_proveedores', 'editar'), ctrl.actualizarIncidente);
router.delete('/:id/incidentes/:incidenteId', requirePermiso('servicios_proveedores', 'eliminar'), ctrl.eliminarIncidente);

// Adjuntos de un incidente (imagenes/documentos)
router.get('/:id/incidentes/:incidenteId/adjuntos', requirePermiso('servicios_proveedores', 'ver'), ctrl.listarAdjuntosIncidente);
router.post('/:id/incidentes/:incidenteId/adjuntos', requirePermiso('servicios_proveedores', 'crear'), ctrl.crearAdjuntoIncidente);
router.put('/:id/incidentes/:incidenteId/adjuntos/:adjuntoId', requirePermiso('servicios_proveedores', 'editar'), ctrl.actualizarAdjuntoIncidente);
router.delete('/:id/incidentes/:incidenteId/adjuntos/:adjuntoId', requirePermiso('servicios_proveedores', 'eliminar'), ctrl.eliminarAdjuntoIncidente);

module.exports = router;
