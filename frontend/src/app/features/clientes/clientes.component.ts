import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientesService } from '../../core/services/clientes.service';
import { AuthService } from '../../core/services/auth.service';
import { Cliente } from '../../core/models/models';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Clientes</h1>
        <div class="desc">Empresas o personas a quienes se les presta el servicio</div>
      </div>
      @if (auth.puedeEditar()) {
        <button class="btn btn-accent" (click)="abrirNuevo()">+ Nuevo cliente</button>
      }
    </div>

    <div class="filter-bar">
      <input
        class="input"
        type="text"
        placeholder="Buscar por nombre, identificacion, email o telefono..."
        [ngModel]="filtroTexto()"
        (ngModelChange)="filtroTexto.set($event)"
        (keyup.enter)="aplicarFiltro()"
      />
      <button class="btn btn-primary" (click)="aplicarFiltro()">Filtrar</button>
      @if (filtro()) {
        <button class="btn btn-outline" (click)="limpiarFiltro()">Limpiar</button>
      }
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th><th>Identificacion</th><th>Email</th><th>Telefono</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of clientesFiltrados(); track c.id) {
            <tr>
              <td>{{ c.nombre }}</td>
              <td>{{ c.identificacion || '-' }}</td>
              <td>{{ c.email || '-' }}</td>
              <td>{{ c.telefono || '-' }}</td>
              <td><span class="badge" [class.badge-green]="c.activo" [class.badge-slate]="!c.activo">{{ c.activo ? 'Activo' : 'Inactivo' }}</span></td>
              <td class="table-actions">
                @if (auth.puedeEditar()) {
                  <button class="btn btn-outline btn-sm" (click)="abrirEditar(c)">Editar</button>
                }
                @if (auth.puedeEliminar()) {
                  <button class="btn btn-danger btn-sm" (click)="eliminar(c)">Eliminar</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6"><div class="empty-state">{{ filtro() ? 'Ningun cliente coincide con la busqueda.' : 'No hay clientes registrados todavia.' }}</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (panelAbierto()) {
      <div class="overlay" (click)="cerrarPanel()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>{{ editando() ? 'Editar cliente' : 'Nuevo cliente' }}</h2>
            <button class="close" (click)="cerrarPanel()">&times;</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="guardar()">
            <div class="form-group">
              <label>Nombre *</label>
              <input class="input" formControlName="nombre" placeholder="Empresa S.A." />
            </div>
            <div class="form-group mt-16">
              <label>Identificacion (RUC / NIT)</label>
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
              <textarea class="input" rows="2" formControlName="direccion"></textarea>
            </div>
            <div class="form-group mt-16">
              <label class="flex items-center gap-8"><input type="checkbox" formControlName="activo" /> Cliente activo</label>
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
export class ClientesComponent implements OnInit {
  clientes = signal<Cliente[]>([]);
  panelAbierto = signal(false);
  editando = signal<Cliente | null>(null);

  filtroTexto = signal('');
  filtro = signal('');

  clientesFiltrados = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return this.clientes();
    return this.clientes().filter((c) =>
      [c.nombre, c.identificacion, c.email, c.telefono]
        .some((campo) => (campo ?? '').toLowerCase().includes(texto))
    );
  });

  form = this.fb.group({
    nombre: ['', Validators.required],
    identificacion: [''],
    email: [''],
    telefono: [''],
    direccion: [''],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: ClientesService, public auth: AuthService) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void { this.srv.listar().subscribe((data) => this.clientes.set(data)); }

  aplicarFiltro(): void { this.filtro.set(this.filtroTexto()); }
  limpiarFiltro(): void { this.filtroTexto.set(''); this.filtro.set(''); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ activo: true });
    this.panelAbierto.set(true);
  }

  abrirEditar(c: Cliente): void {
    this.editando.set(c);
    this.form.reset({ ...c });
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const data = this.form.getRawValue();
    const actual = this.editando();

    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data);
    req.subscribe(() => { this.cerrarPanel(); this.cargar(); });
  }

  eliminar(c: Cliente): void {
    if (!confirm(`Eliminar al cliente "${c.nombre}"? Esta accion no se puede deshacer.`)) return;
    this.srv.eliminar(c.id).subscribe(() => this.cargar());
  }
}
