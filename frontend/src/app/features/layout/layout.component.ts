import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, Validators, AbstractControl } from '@angular/forms';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { EmpresaSeleccionable } from '../../core/models/models';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive],
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
          @if (auth.esSuperAdmin()) {
            <a routerLink="/empresas" routerLinkActive="active">Empresas</a>
          }
        </nav>

        <div class="sidebar-footer">v1.0 &middot; Conectado a Supabase</div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div>
            @if (misEmpresas().length > 1) {
              <select
                class="input"
                style="max-width:240px;"
                [disabled]="cambiandoEmpresa()"
                (change)="cambiarEmpresa($event)"
              >
                @for (e of misEmpresas(); track e.empresa_id) {
                  <option [value]="e.empresa_id" [selected]="e.empresa_id === auth.empresaActiva()?.empresa_id">
                    {{ e.empresa_nombre }}
                  </option>
                }
              </select>
            } @else if (auth.empresaActiva()) {
              <span class="text-muted text-sm">{{ auth.empresaActiva()?.empresa_nombre }}</span>
            }
          </div>

          <div class="user-menu">
            <button class="user-pill user-pill-btn" (click)="menuAbierto.set(!menuAbierto())">
              @if (auth.usuario()?.avatar) {
                <img class="avatar-img" [src]="auth.usuario()?.avatar" alt="Avatar" />
              } @else {
                <div class="avatar">{{ iniciales() }}</div>
              }
              <div>
                <div>{{ auth.usuario()?.nombre }}</div>
                <div class="text-muted" style="font-size:11px;">{{ auth.usuario()?.rol }}</div>
              </div>
            </button>

            @if (menuAbierto()) {
              <div class="dropdown-backdrop" (click)="menuAbierto.set(false)"></div>
              <div class="dropdown-menu">
                <button type="button" class="dropdown-item" (click)="fileInput.click()">Cambiar foto de perfil</button>
                <button type="button" class="dropdown-item" (click)="abrirCambioPassword()">Cambiar contrasena</button>
                <button type="button" class="dropdown-item dropdown-item-danger" (click)="auth.logout()">Salir</button>
              </div>
            }
          </div>

          <input #fileInput type="file" accept="image/*" style="display:none" (change)="onArchivoSeleccionado($event)" />
        </header>

        <main class="content">
          <router-outlet></router-outlet>
        </main>

        <footer class="page-footer">&copy; {{ anioActual }} Edwin Cedeño. Todos los derechos reservados.</footer>
      </div>
    </div>

    @if (panelPasswordAbierto()) {
      <div class="overlay" (click)="cerrarCambioPassword()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>Cambiar contrasena</h2>
            <button class="close" (click)="cerrarCambioPassword()">&times;</button>
          </div>
          <form [formGroup]="passwordForm" (ngSubmit)="guardarPassword()">
            <div class="form-group">
              <label>Contrasena actual *</label>
              <input class="input" type="password" formControlName="password_actual" />
            </div>
            <div class="form-group mt-16">
              <label>Nueva contrasena *</label>
              <input class="input" type="password" formControlName="password_nueva" />
            </div>
            <div class="form-group mt-16">
              <label>Confirmar nueva contrasena *</label>
              <input class="input" type="password" formControlName="password_confirmar" />
              @if (passwordForm.errors?.['noCoincide']) {
                <div class="error-text">Las contrasenas no coinciden.</div>
              }
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="passwordForm.invalid">Guardar</button>
              <button type="button" class="btn btn-outline" (click)="cerrarCambioPassword()">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class LayoutComponent implements OnInit {
  anioActual = new Date().getFullYear();
  menuAbierto = signal(false);
  panelPasswordAbierto = signal(false);
  misEmpresas = signal<EmpresaSeleccionable[]>([]);
  cambiandoEmpresa = signal(false);

  passwordForm = this.fb.group(
    {
      password_actual: ['', Validators.required],
      password_nueva: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmar: ['', Validators.required],
    },
    { validators: passwordsCoincidenValidator }
  );

  constructor(public auth: AuthService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.auth.misEmpresas().subscribe((data) => this.misEmpresas.set(data));
  }

  cambiarEmpresa(event: Event): void {
    const empresaId = (event.target as HTMLSelectElement).value;
    if (!empresaId || empresaId === this.auth.empresaActiva()?.empresa_id) return;
    this.cambiandoEmpresa.set(true);
    this.auth.seleccionarEmpresa(empresaId).subscribe({
      next: () => window.location.reload(),
      error: (err) => {
        this.cambiandoEmpresa.set(false);
        alert(err?.error?.mensaje || 'No se pudo cambiar de empresa');
      },
    });
  }

  iniciales(): string {
    const nombre = this.auth.usuario()?.nombre || '';
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }

  onArchivoSeleccionado(event: Event): void {
    this.menuAbierto.set(false);
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen valido.');
      return;
    }

    redimensionarImagen(archivo, 200).then((base64) => {
      this.auth.actualizarAvatar(base64).subscribe({
        next: () => {},
        error: (err) => alert(err?.error?.mensaje || 'No se pudo actualizar la foto de perfil'),
      });
    });

    input.value = '';
  }

  abrirCambioPassword(): void {
    this.menuAbierto.set(false);
    this.passwordForm.reset();
    this.panelPasswordAbierto.set(true);
  }

  cerrarCambioPassword(): void { this.panelPasswordAbierto.set(false); }

  guardarPassword(): void {
    if (this.passwordForm.invalid) return;
    const { password_actual, password_nueva } = this.passwordForm.getRawValue();
    this.auth.cambiarPassword(password_actual!, password_nueva!).subscribe({
      next: () => {
        this.cerrarCambioPassword();
        alert('Contrasena actualizada correctamente.');
      },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo cambiar la contrasena'),
    });
  }
}

function passwordsCoincidenValidator(group: AbstractControl): ValidationErrors | null {
  const nueva = group.get('password_nueva')?.value;
  const confirmar = group.get('password_confirmar')?.value;
  if (!nueva || !confirmar) return null;
  return nueva === confirmar ? null : { noCoincide: true };
}

function redimensionarImagen(archivo: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error);
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        const escala = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}
