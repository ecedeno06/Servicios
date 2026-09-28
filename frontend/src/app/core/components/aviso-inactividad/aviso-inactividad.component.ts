import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InactividadService } from '../../services/inactividad.service';
import { AuthService } from '../../services/auth.service';

// Aviso de sesion por expirar por inactividad -- ver InactividadService.
// Se muestra desde LayoutComponent (unica instancia, fuera del contenido
// de cada pantalla) para que bloquee toda la app mientras esta visible.
@Component({
  selector: 'app-aviso-inactividad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aviso-inactividad.component.html',
  styleUrl: './aviso-inactividad.component.css',
})
export class AvisoInactividadComponent {
  constructor(public inactividad: InactividadService, private auth: AuthService) {}

  cerrarSesion(): void {
    this.auth.logout('logout_usuario');
  }

  continuar(): void {
    this.inactividad.extenderSesion();
  }
}
