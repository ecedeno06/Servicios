import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpresasService } from '../../core/services/empresas.service';
import { Empresa } from '../../core/models/models';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  form = this.fb.group({
    nombre: ['', Validators.required],
    identificacion: [''],
    email: [''],
    telefono: [''],
    direccion: [''],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: EmpresasService) {}

  ngOnInit(): void { this.cargar(); }
  cargar(): void { this.srv.listar().subscribe((data) => this.empresas.set(data)); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ activo: true });
    this.panelAbierto.set(true);
  }

  abrirEditar(e: Empresa): void {
    this.editando.set(e);
    this.form.reset({ ...e });
    this.panelAbierto.set(true);
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
