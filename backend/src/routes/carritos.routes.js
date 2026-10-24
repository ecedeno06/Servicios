const router = require('express').Router();
const ctrl = require('../controllers/carritos.controller');
const { requireAuth, requireEmpresa, requirePermiso } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireEmpresa);

// Carritos
router.get('/', requirePermiso('carrito_compras', 'ver'), ctrl.listar);
router.get('/:id', requirePermiso('carrito_compras', 'ver'), ctrl.obtenerPorId);
router.post('/', requirePermiso('carrito_compras', 'crear'), ctrl.crear);
router.put('/:id', requirePermiso('carrito_compras', 'editar'), ctrl.actualizar);
router.delete('/:id', requirePermiso('carrito_compras', 'eliminar'), ctrl.eliminar);
router.post('/:id/avanzar', requirePermiso('carrito_compras', 'editar'), ctrl.avanzarEstado);
router.post('/:id/retroceder', requirePermiso('carrito_compras', 'editar'), ctrl.retrocederEstado);

// Lineas de detalle (equipos a comprar)
router.get('/:id/detalles', requirePermiso('carrito_compras', 'ver'), ctrl.listarDetalles);
router.post('/:id/detalles', requirePermiso('carrito_compras', 'crear'), ctrl.crearDetalle);
router.put('/:id/detalles/:detalleId', requirePermiso('carrito_compras', 'editar'), ctrl.actualizarDetalle);
router.delete('/:id/detalles/:detalleId', requirePermiso('carrito_compras', 'eliminar'), ctrl.eliminarDetalle);

module.exports = router;
