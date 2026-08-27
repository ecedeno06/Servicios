import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TiposServicioService } from '../../core/services/tipos-servicio.service';
import { AuthService } from '../../core/services/auth.service';
import { TipoServicio } from '../../core/models/models';

@Component({
  selector: 'app-tipos-servicio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Tipos de servicio</h1>
        <div class="desc">Catalogo de servicios que se pueden asignar a un contrato</div>
      </div>
      @if (auth.puedeEditar()) {
        <button class="btn btn-accent" (click)="abrirNuevo()">+ Nuevo tipo de servicio</button>
      }
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Descripcion</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (t of tipos(); track t.id) {
            <tr>
              <td>{{ t.nombre }}</td>
              <td>{{ t.descripcion || '-' }}</td>
              <td><span class="badge" [class.badge-green]="t.activo" [class.badge-slate]="!t.activo">{{ t.activo ? 'Activo' : 'Inactivo' }}</span></td>
              <td class="table-actions">
                @if (auth.puedeEditar()) {
                  <button class="btn btn-outline btn-sm" (click)="abrirEditar(t)">Editar</button>
                }
                @if (auth.puedeEliminar()) {
                  <button class="btn btn-danger btn-sm" (click)="eliminar(t)">Eliminar</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="4"><div class="empty-state">No hay tipos de servicio registrados.</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (panelAbierto()) {
      <div class="overlay" (click)="cerrarPanel()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>{{ editando() ? 'Editar tipo de servicio' : 'Nuevo tipo de servicio' }}</h2>
            <button class="close" (click)="cerrarPanel()">&times;</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="guardar()">
            <div class="form-group">
              <label>Nombre *</label>
              <input class="input" formControlName="nombre" placeholder="Soporte tecnico, mantenimiento, etc." />
            </div>
            <div class="form-group mt-16">
              <label>Descripcion</label>
              <textarea class="input" rows="3" formControlName="descripcion"></textarea>
            </div>
            <div class="form-group mt-16">
              <label class="flex items-center gap-8"><input type="checkbox" formControlName="activo" /> Servicio activo</label>
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
export class TiposServicioComponent implements OnInit {
  tipos = signal<TipoServicio[]>([]);
  panelAbierto = signal(false);
  editando = signal<TipoServicio | null>(null);

  form = this.fb.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: TiposServicioService, public auth: AuthService) {}

  ngOnInit(): void { this.cargar(); }
  cargar(): void { this.srv.listar().subscribe((data) => this.tipos.set(data)); }

  abrirNuevo(): void { this.editando.set(null); this.form.reset({ activo: true }); this.panelAbierto.set(true); }
  abrirEditar(t: TipoServicio): void { this.editando.set(t); this.form.reset({ ...t }); this.panelAbierto.set(true); }
  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const data = this.form.getRawValue();
    const actual = this.editando();
    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data);
    req.subscribe(() => { this.cerrarPanel(); this.cargar(); });
  }

  eliminar(t: TipoServicio): void {
    if (!confirm(`Eliminar el tipo de servicio "${t.nombre}"?`)) return;
    this.srv.eliminar(t.id).subscribe(() => this.cargar());
  }
}
