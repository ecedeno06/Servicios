import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Usuario, Rol } from '../../core/models/models';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Usuarios</h1>
        <div class="desc">Personas que acceden al sistema (tecnicos, supervisores, administradores)</div>
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
          <form [formGroup]="form" (ngSubmit)="guardar()">
            <div class="form-group">
              <label>Nombre completo *</label>
              <input class="input" formControlName="nombre" />
            </div>
            <div class="form-group mt-16">
              <label>Email *</label>
              <input class="input" type="email" formControlName="email" />
            </div>
            <div class="form-group mt-16">
              <label>{{ editando() ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena *' }}</label>
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
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    rol: ['tecnico' as Rol],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: UsuariosService) {}

  ngOnInit(): void { this.cargar(); }
  cargar(): void { this.srv.listar().subscribe((data) => this.usuarios.set(data)); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ rol: 'tecnico', activo: true });
    this.form.get('password')?.setValidators(Validators.required);
    this.form.get('password')?.updateValueAndValidity();
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
    req.subscribe(() => { this.cerrarPanel(); this.cargar(); });
  }

  eliminar(u: Usuario): void {
    if (!confirm(`Eliminar al usuario "${u.nombre}"?`)) return;
    this.srv.eliminar(u.id).subscribe(() => this.cargar());
  }
}
