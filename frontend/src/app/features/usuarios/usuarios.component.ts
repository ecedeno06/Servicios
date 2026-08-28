import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { AuthService } from '../../core/services/auth.service';
import { Usuario, Rol } from '../../core/models/models';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Usuarios</h1>
        <div class="desc">Personas con acceso a esta empresa (tecnicos, supervisores, administradores)</div>
      </div>
      <button class="btn btn-accent" (click)="abrirNuevo()">+ Nuevo usuario</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (u of usuarios(); track u.id) {
            <tr>
              <td>{{ u.nombre }}</td>
              <td>{{ u.email }}</td>
              <td><span class="badge badge-slate">{{ u.rol }}</span></td>
              <td><span class="badge" [class.badge-green]="u.activo" [class.badge-slate]="!u.activo">{{ u.activo ? 'Activo' : 'Inactivo' }}</span></td>
              <td class="table-actions">
                <button class="btn btn-outline btn-sm" (click)="abrirEditar(u)">Editar</button>
                <button class="btn btn-danger btn-sm" (click)="eliminar(u)">Eliminar</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5"><div class="empty-state">No hay usuarios registrados.</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (panelAbierto()) {
      <div class="overlay" (click)="cerrarPanel()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>{{ editando() ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
            <button class="close" (click)="cerrarPanel()">&times;</button>
          </div>
          <p class="text-muted text-sm">
            Empresa: <strong>{{ auth.empresaActiva()?.empresa_nombre }}</strong>.
            El rol que elijas abajo aplica solo a esta empresa (para asociar a alguien
            a otra empresa, primero cambia la empresa activa en la barra superior).
          </p>
          @if (!editando()) {
            <p class="text-muted text-sm">
              Si el email ya pertenece a alguien con cuenta en el sistema, se le
              asociara a esta empresa con el rol indicado (no hace falta nombre ni contrasena).
            </p>
          }
          <form [formGroup]="form" (ngSubmit)="guardar()">
            <div class="form-group">
              <label>Email *</label>
              <input class="input" type="email" formControlName="email" />
            </div>
            <div class="form-group mt-16">
              <label>{{ editando() ? 'Nombre completo' : 'Nombre completo (solo si es una persona nueva)' }}</label>
              <input class="input" formControlName="nombre" />
            </div>
            <div class="form-group mt-16">
              <label>{{ editando() ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena (solo si es una persona nueva)' }}</label>
              <input class="input" type="password" formControlName="password" />
            </div>
            <div class="form-group mt-16">
              <label>Rol</label>
              <select class="input" formControlName="rol">
                <option value="tecnico">Tecnico</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div class="form-group mt-16">
              <label class="flex items-center gap-8"><input type="checkbox" formControlName="activo" /> Usuario activo</label>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="form.invalid">Guardar</button>
              <button type="button" class="btn btn-outline" (click)="cerrarPanel()">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class UsuariosComponent implements OnInit {
  usuarios = signal<Usuario[]>([]);
  panelAbierto = signal(false);
  editando = signal<Usuario | null>(null);

  form = this.fb.group({
    nombre: [''],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    rol: ['tecnico' as Rol],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: UsuariosService, public auth: AuthService) {}

  ngOnInit(): void { this.cargar(); }
  cargar(): void { this.srv.listar().subscribe((data) => this.usuarios.set(data)); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ rol: 'tecnico', activo: true });
    // nombre/password no son obligatorios aqui: si el email ya existe en el
    // sistema (otra empresa), el backend solo lo asocia a esta con el rol
    // indicado. Si es una persona nueva, el backend exige ambos y lo avisa.
    this.panelAbierto.set(true);
  }

  abrirEditar(u: Usuario): void {
    this.editando.set(u);
    this.form.reset({ ...u, password: '' });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const data = { ...this.form.getRawValue() };
    if (!data.password) delete (data as any).password;

    const actual = this.editando();
    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data as any);
    req.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el usuario'),
    });
  }

  eliminar(u: Usuario): void {
    if (!confirm(`Quitar a "${u.nombre}" de esta empresa?`)) return;
    this.srv.eliminar(u.id).subscribe({
      next: () => this.cargar(),
      error: (err) => alert(err?.error?.mensaje || 'No se pudo quitar al usuario'),
    });
  }
}
