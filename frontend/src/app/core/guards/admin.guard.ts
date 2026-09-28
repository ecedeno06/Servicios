import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Admin de una empresa o super-admin (ej. Auditoria de sesiones) -- mas
// amplio que superAdminGuard, mas estricto que noClienteGuard.
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.estaAutenticado() && (auth.esSuperAdmin() || auth.usuario()?.rol === 'admin')) return true;
  router.navigate(['/dashboard']);
  return false;
};
