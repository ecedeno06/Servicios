const router = require('express').Router();
const ctrl = require('../controllers/procesadores.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// Lectura: cualquier usuario autenticado (un admin de empresa necesita
// verlos para completar las especificaciones de un equipo asignado).
// Escritura: solo super-admin (catalogo global compartido por todas las
// empresas).
router.get('/', requireAuth, ctrl.listar);
router.post('/', requireAuth, requireSuperAdmin, ctrl.crear);
router.put('/:id', requireAuth, requireSuperAdmin, ctrl.actualizar);
router.delete('/:id', requireAuth, requireSuperAdmin, ctrl.eliminar);

module.exports = router;
