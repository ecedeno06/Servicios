import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Bloquea rutas que el rol cliente no debe poder ver (ej. Contratos),
// aunque entre la URL directamente.
export const noClienteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.esCliente()) return true;
  router.navigate(['/dashboard']);
  return false;
};
