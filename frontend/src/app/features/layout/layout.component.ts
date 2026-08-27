import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="mark">HS</div>
          <div>
            <div class="title">Horas de Servicio</div>
            <div class="subtitle">Panel de gestion</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/dashboard" routerLinkActive="active">Resumen</a>
          <a routerLink="/contratos" routerLinkActive="active">Contratos</a>
          <a routerLink="/horas" routerLinkActive="active">Registro de horas</a>
          <a routerLink="/clientes" routerLinkActive="active">Clientes</a>
          <a routerLink="/tipos-servicio" routerLinkActive="active">Tipos de servicio</a>
          @if (auth.usuario()?.rol === 'admin') {
            <a routerLink="/usuarios" routerLinkActive="active">Usuarios</a>
          }
        </nav>

        <div class="sidebar-footer">v1.0 &middot; Conectado a Supabase</div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div></div>
          <div class="user-pill">
            <div class="avatar">{{ iniciales() }}</div>
            <div>
              <div>{{ auth.usuario()?.nombre }}</div>
              <div class="text-muted" style="font-size:11px;">{{ auth.usuario()?.rol }}</div>
            </div>
            <button class="btn btn-outline btn-sm" (click)="auth.logout()">Salir</button>
          </div>
        </header>

        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
})
export class LayoutComponent {
  constructor(public auth: AuthService) {}

  iniciales(): string {
    const nombre = this.auth.usuario()?.nombre || '';
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }
}
