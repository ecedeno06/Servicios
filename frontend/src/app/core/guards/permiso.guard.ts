import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MenuService } from '../services/menu.service';

// Reemplaza a adminGuard/noClienteGuard: en vez de comparar el codigo de
// rol contra una lista fija por ruta, consulta el mismo mapa de permisos
// que ya decide que ve el sidebar (ver MenuService) -- declarativo via
// route data: { menu: 'contratos', permiso: 'editar' } (permiso por
// defecto 'ver'). superAdminGuard sigue aparte, solo para las 3 rutas de
// configuracion cross-empresa que no entran a esta matriz.
export const permisoGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const menu = inject(MenuService);
  const router = inject(Router);

  const menuCodigo = route.data['menu'] as string;
  const permisoCodigo = (route.data['permiso'] as string) || 'ver';

  if (auth.estaAutenticado() && (auth.esSuperAdmin() || menu.tienePermiso(menuCodigo, permisoCodigo))) return true;
  router.navigate(['/dashboard']);
  return false;
};
