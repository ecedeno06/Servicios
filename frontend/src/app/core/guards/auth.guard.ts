import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MenuService } from '../services/menu.service';

// Ademas de exigir sesion activa, se asegura de que el menu/mapa de
// permisos ya este cargado antes de dejar pasar a cualquier ruta hija: si
// no se esperara aqui, el permisoGuard del hijo evaluaria justo despues
// del login con el mapa todavia vacio (menu.cargar() antes se disparaba
// recien en LayoutComponent.ngOnInit, que corre DESPUES de que el guard
// del hijo ya resolvio) y, para cualquier usuario que no fuera
// super-admin, denegaria y redirigiria de vuelta a si mismo en un bucle
// infinito que cuelga el navegador.
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const menu = inject(MenuService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }
  if (menu.estaCargado()) return true;

  return menu.cargar().pipe(
    map(() => true),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};
