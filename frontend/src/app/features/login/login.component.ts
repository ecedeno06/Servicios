import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { EmpresaSeleccionable } from '../../core/models/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">HS</div>

        @if (!empresasParaElegir()) {
          <h1>Ingresar</h1>
          <p class="text-muted text-sm">Gestion de horas de servicio a clientes</p>

          @if (error()) {
            <div class="auth-error mt-16">{{ error() }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="enviar()" class="mt-16">
            <div class="form-group">
              <label>Correo electronico</label>
              <input class="input" type="email" formControlName="email" placeholder="tucorreo@empresa.com" />
            </div>
            <div class="form-group mt-16">
              <label>Contrasena</label>
              <input class="input" type="password" formControlName="password" placeholder="********" />
            </div>
            <button class="btn btn-primary w-full mt-16" type="submit" [disabled]="form.invalid || cargando()">
              {{ cargando() ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>
        } @else {
          <h1>Selecciona una empresa</h1>
          <p class="text-muted text-sm">Tu cuenta tiene acceso a mas de una empresa.</p>

          @if (error()) {
            <div class="auth-error mt-16">{{ error() }}</div>
          }

          <div class="mt-16" style="display:flex; flex-direction:column; gap:8px;">
            @for (e of empresasParaElegir(); track e.empresa_id) {
              <button
                type="button"
                class="btn btn-outline w-full"
                [disabled]="cargando()"
                (click)="elegirEmpresa(e.empresa_id)"
              >
                {{ e.empresa_nombre }} <span class="text-muted text-sm">({{ e.rol }})</span>
              </button>
            }
          </div>

          <button type="button" class="btn btn-outline w-full mt-16" (click)="cancelarSeleccion()">
            Volver
          </button>
        }
      </div>
    </div>
  `,
})
export class LoginComponent {
  cargando = signal(false);
  error = signal<string | null>(null);
  empresasParaElegir = signal<EmpresaSeleccionable[] | null>(null);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  enviar() {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        this.cargando.set(false);
        if ('requiereSeleccionEmpresa' in res) {
          this.empresasParaElegir.set(res.empresas);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err?.error?.mensaje || 'No se pudo iniciar sesion');
      },
    });
  }

  elegirEmpresa(empresaId: string) {
    this.cargando.set(true);
    this.error.set(null);
    this.auth.seleccionarEmpresa(empresaId).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err?.error?.mensaje || 'No se pudo seleccionar la empresa');
      },
    });
  }

  cancelarSeleccion() {
    this.empresasParaElegir.set(null);
    this.error.set(null);
  }
}
