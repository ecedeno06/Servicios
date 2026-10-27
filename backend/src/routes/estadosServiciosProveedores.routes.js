const router = require('express').Router();
const ctrl = require('../controllers/estadosServiciosProveedores.controller');
const { requireAuth, requireEmpresa, requireSuperAdmin, requirePassword } = require('../middleware/auth');

// Catalogo expuesto solo en Configuracion -- igual que el resto de ese
// grupo (Empresas, Politica de password, Equipos, Roles y permisos), solo
// super-admin puede ver/editar.
router.use(requireAuth, requireEmpresa, requireSuperAdmin);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', requirePassword, ctrl.eliminar);

module.exports = router;
