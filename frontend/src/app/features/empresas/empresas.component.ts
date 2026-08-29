import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpresasService } from '../../core/services/empresas.service';
import { Empresa, UsuarioGlobal, UsuarioDeEmpresa, Rol } from '../../core/models/models';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Empresas</h1>
        <div class="desc">Organizaciones que usan el sistema (solo super administradores)</div>
      </div>
      <button class="btn btn-accent" (click)="abrirNuevo()">+ Nueva empresa</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Identificacion</th><th>Email</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (e of empresas(); track e.id) {
            <tr>
              <td>{{ e.nombre }}</td>
              <td>{{ e.identificacion || '-' }}</td>
              <td>{{ e.email || '-' }}</td>
              <td><span class="badge" [class.badge-green]="e.activo" [class.badge-slate]="!e.activo">{{ e.activo ? 'Activa' : 'Inactiva' }}</span></td>
              <td class="table-actions">
                <button class="btn btn-outline btn-sm" (click)="abrirEditar(e)">Editar</button>
                <button class="btn btn-danger btn-sm" (click)="eliminar(e)">Eliminar</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5"><div class="empty-state">No hay empresas registradas.</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (panelAbierto()) {
      <div class="overlay" (click)="cerrarPanel()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>{{ editando() ? 'Editar empresa' : 'Nueva empresa' }}</h2>
            <button class="close" (click)="cerrarPanel()">&times;</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="guardar()">
            <div class="form-group">
              <label>Nombre *</label>
              <input class="input" formControlName="nombre" />
            </div>
            <div class="form-group mt-16">
              <label>Identificacion (RUC / NIT / Cedula juridica)</label>
              <input class="input" formControlName="identificacion" />
            </div>
            <div class="form-group mt-16">
              <label>Email</label>
              <input class="input" type="email" formControlName="email" />
            </div>
            <div class="form-group mt-16">
              <label>Telefono</label>
              <input class="input" formControlName="telefono" />
            </div>
            <div class="form-group mt-16">
              <label>Direccion</label>
              <input class="input" formControlName="direccion" />
            </div>

            @if (editando(); as e) {
              <div class="card mt-16">
                <h3 style="margin:0;">Usuarios de esta empresa</h3>

                <div class="table-wrap mt-16">
                  <table class="data-table">
                    <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead>
                    <tbody>
                      @for (u of usuariosDeEmpresa(); track u.id) {
                        <tr>
                          <td>{{ u.nombre }}</td>
                          <td>{{ u.email }}</td>
                          <td><span class="badge badge-slate">{{ u.rol }}</span></td>
                          <td class="table-actions">
                            <button type="button" class="btn btn-danger btn-sm" (click)="desasociarUsuario(e.id, u)">Quitar</button>
                          </td>
                        </tr>
                      } @empty {
                        <tr><td colspan="4"><div class="empty-state">Esta empresa todavia no tiene usuarios asociados.</div></td></tr>
                      }
                    </tbody>
                  </table>
                </div>

                <div class="form-group mt-16">
                  <label>Asociar usuario existente</label>
                  <select class="input" [(ngModel)]="usuarioParaAsociar" [ngModelOptions]="{ standalone: true }">
                    <option [ngValue]="''" disabled>Selecciona un usuario</option>
                    @for (u of usuariosDisponibles(); track u.id) {
                      <option [ngValue]="u.id">{{ u.nombre }} &middot; {{ u.email }}</option>
                    }
                  </select>
                </div>
                <div class="form-group mt-16">
                  <label>Rol en esta empresa</label>
                  <select class="input" [(ngModel)]="rolParaAsociar" [ngModelOptions]="{ standalone: true }">
                    <option value="tecnico">Tecnico</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <button type="button" class="btn btn-outline btn-sm mt-16" [disabled]="!usuarioParaAsociar" (click)="asociarUsuario(e.id)">
                  + Asociar usuario
                </button>
              </div>
            }

            <div class="form-group mt-16">
              <label class="flex items-center gap-8"><input type="checkbox" formControlName="activo" /> Empresa activa</label>
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
export class EmpresasComponent implements OnInit {
  empresas = signal<Empresa[]>([]);
  panelAbierto = signal(false);
  editando = signal<Empresa | null>(null);

  usuariosGlobales = signal<UsuarioGlobal[]>([]);
  usuariosDeEmpresa = signal<UsuarioDeEmpresa[]>([]);
  usuarioParaAsociar = '';
  rolParaAsociar: Rol = 'tecnico';

  // Solo ofrece en el selector a los usuarios que todavia no estan asociados
  usuariosDisponibles = computed(() => {
    const yaAsociados = new Set(this.usuariosDeEmpresa().map((u) => u.id));
    return this.usuariosGlobales().filter((u) => !yaAsociados.has(u.id));
  });

  form = this.fb.group({
    nombre: ['', Validators.required],
    identificacion: [''],
    email: [''],
    telefono: [''],
    direccion: [''],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: EmpresasService) {}

  ngOnInit(): void {
    this.cargar();
    this.srv.usuariosGlobales().subscribe((data) => this.usuariosGlobales.set(data));
  }

  cargar(): void { this.srv.listar().subscribe((data) => this.empresas.set(data)); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.usuariosDeEmpresa.set([]);
    this.form.reset({ activo: true });
    this.panelAbierto.set(true);
  }

  abrirEditar(e: Empresa): void {
    this.editando.set(e);
    this.form.reset({ ...e });
    this.usuarioParaAsociar = '';
    this.rolParaAsociar = 'tecnico';
    this.cargarUsuariosDeEmpresa(e.id);
    this.panelAbierto.set(true);
  }

  cargarUsuariosDeEmpresa(empresaId: string): void {
    this.srv.usuariosDeEmpresa(empresaId).subscribe((data) => this.usuariosDeEmpresa.set(data));
  }

  asociarUsuario(empresaId: string): void {
    if (!this.usuarioParaAsociar) return;
    this.srv.asociarUsuario(empresaId, { usuario_id: this.usuarioParaAsociar, rol: this.rolParaAsociar }).subscribe({
      next: () => {
        this.usuarioParaAsociar = '';
        this.rolParaAsociar = 'tecnico';
        this.cargarUsuariosDeEmpresa(empresaId);
      },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo asociar el usuario'),
    });
  }

  desasociarUsuario(empresaId: string, u: UsuarioDeEmpresa): void {
    if (!confirm(`Quitar a "${u.nombre}" de esta empresa?`)) return;
    this.srv.desasociarUsuario(empresaId, u.id).subscribe({
      next: () => this.cargarUsuariosDeEmpresa(empresaId),
      error: (err) => alert(err?.error?.mensaje || 'No se pudo quitar al usuario'),
    });
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const data = this.form.getRawValue();
    const actual = this.editando();
    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data);
    req.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar la empresa'),
    });
  }

  eliminar(e: Empresa): void {
    if (!confirm(`Eliminar la empresa "${e.nombre}"?`)) return;
    this.srv.eliminar(e.id).subscribe({
      next: () => this.cargar(),
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar la empresa'),
    });
  }
}
