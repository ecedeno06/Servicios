const router = require('express').Router();
const ctrl = require('../controllers/carritos.controller');
const { requireAuth, requireEmpresa, requirePermiso, requirePassword } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireEmpresa);

// Carritos
router.get('/', requirePermiso('carrito_compras', 'ver'), ctrl.listar);
// Antes de "/:id" -- si no, Express interpreta "destinatarios"/"reporte" como el :id.
router.get('/destinatarios', requirePermiso('carrito_compras', 'ver'), ctrl.listarDestinatarios);
router.get('/reporte', requirePermiso('carrito_compras', 'ver'), ctrl.reporte);
router.get('/:id', requirePermiso('carrito_compras', 'ver'), ctrl.obtenerPorId);
router.post('/', requirePermiso('carrito_compras', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('carrito_compras', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('carrito_compras', 'eliminar'), requirePassword, ctrl.eliminar);
router.post('/:id/avanzar', requirePermiso('carrito_compras', 'editar'), ctrl.avanzarEstado);
router.post('/:id/retroceder', requirePermiso('carrito_compras', 'editar'), ctrl.retrocederEstado);
router.get('/:id/historico', requirePermiso('carrito_compras', 'ver'), ctrl.listarHistorico);
router.post('/:id/enviar-correo', requirePermiso('carrito_compras', 'ver'), ctrl.enviarPorCorreoHtml);

// Lineas de detalle (equipos a comprar)
router.get('/:id/detalles', requirePermiso('carrito_compras', 'ver'), ctrl.listarDetalles);
router.post('/:id/detalles', requirePermiso('carrito_compras', 'crear'), ctrl.crearDetalle);
router.put('/:id/detalles/:detalleId', requirePermiso('carrito_compras', 'editar'), ctrl.actualizarDetalle);
router.delete('/:id/detalles/:detalleId', requirePermiso('carrito_compras', 'eliminar'), requirePassword, ctrl.eliminarDetalle);

// Cotizaciones (propuestas de precio por linea, una o mas, cada una de un proveedor)
router.get('/:id/detalles/:detalleId/cotizaciones', requirePermiso('carrito_compras', 'ver'), ctrl.listarCotizaciones);
router.post('/:id/detalles/:detalleId/cotizaciones', requirePermiso('carrito_compras', 'crear'), ctrl.crearCotizacion);
router.put('/:id/detalles/:detalleId/cotizaciones/:cotizacionId', requirePermiso('carrito_compras', 'editar'), ctrl.actualizarCotizacion);
router.delete('/:id/detalles/:detalleId/cotizaciones/:cotizacionId', requirePermiso('carrito_compras', 'eliminar'), requirePassword, ctrl.eliminarCotizacion);

module.exports = router;
