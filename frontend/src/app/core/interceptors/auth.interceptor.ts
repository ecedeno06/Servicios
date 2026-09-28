import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401) {
        // El backend ya cerro la sesion del lado del servidor en este caso
        // (token invalido/expirado, o cerrada/bloqueada desde Auditoria) --
        // 'token_invalido' la distingue de un cierre manual en el reporte.
        auth.logout('token_invalido');
        router.navigate(['/login']);
      } else if (err.status === 403 && err.error?.requiereCambioPassword) {
        // El token en uso quedo "viejo" -- se emitio antes de que un admin
        // reseteara esta contrasena. Fuerza el formulario obligatorio sin
        // esperar a que el usuario recargue la pagina.
        auth.marcarCambioPasswordObligatorio();
      }
      return throwError(() => err);
    })
  );
};
