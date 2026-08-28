import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ContratosService } from '../../core/services/contratos.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AuthService } from '../../core/services/auth.service';
import { Contrato, Cliente, EstadoContrato } from '../../core/models/models';

@Component({
  selector: 'app-contratos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Contratos</h1>
        <div class="desc">Contratos firmados por cliente, con sus horas y estado</div>
      </div>
      @if (auth.puedeEditar()) {
        <button class="btn btn-accent" (click)="abrirNuevo()">+ Nuevo contrato</button>
      }
    </div>

    <div class="filter-bar">
      <input
        class="input"
        type="text"
        placeholder="Buscar por numero de contrato o cliente..."
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
          <tr><th>Numero</th><th>Cliente</th><th>Inicio</th><th>Fin</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          @for (c of contratosFiltrados(); track c.id) {
            <tr>
              <td><a [routerLink]="['/contratos', c.id]" [title]="c.observaciones || 'Sin observaciones registradas.'">{{ c.numero_contrato }}</a></td>
              <td>{{ c.cliente_nombre }}</td>
              <td>{{ c.fecha_inicio | date:'dd/MM/yyyy' }}</td>
              <td>{{ c.fecha_fin ? (c.fecha_fin | date:'dd/MM/yyyy') : '-' }}</td>
              <td><span class="badge" [ngClass]="vigencia(c).clase">{{ vigencia(c).texto }}</span></td>
              <td class="table-actions">
                <a class="btn btn-outline btn-sm" [routerLink]="['/contratos', c.id]">Ver horas</a>
                @if (auth.puedeEditar()) {
                  <button class="btn btn-outline btn-sm" (click)="abrirEditar(c)">Editar</button>
                }
                @if (auth.puedeEliminar()) {
                  <button class="btn btn-danger btn-sm" (click)="eliminar(c)">Eliminar</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6"><div class="empty-state">{{ filtro() ? 'Ningun contrato coincide con la busqueda.' : 'No hay contratos registrados todavia.' }}</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (panelAbierto()) {
      <div class="overlay" (click)="cerrarPanel()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>{{ contratoEditando() ? 'Editar contrato' : 'Nuevo contrato' }}</h2>
            <button class="close" (click)="cerrarPanel()">&times;</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="guardar()">
            <div class="form-group">
              <label>Cliente *</label>
              <select class="input" formControlName="cliente_id">
                <option value="" disabled>Selecciona un cliente</option>
                @for (cl of clientes(); track cl.id) { <option [value]="cl.id">{{ cl.nombre }}</option> }
              </select>
            </div>
            <div class="form-group mt-16">
              <label>Numero de contrato *</label>
              <input class="input" formControlName="numero_contrato" placeholder="CT-2026-001" />
            </div>
            <div class="form-group mt-16">
              <label>Fecha de inicio *</label>
              <input class="input" type="date" formControlName="fecha_inicio" />
            </div>
            <div class="form-group mt-16">
              <label>Fecha de fin</label>
              <input class="input" type="date" formControlName="fecha_fin" />
              @if (form.errors?.['fechaFinAnterior']) {
                <div class="error-text">La fecha de fin no puede ser anterior a la fecha de inicio.</div>
              }
            </div>
            <div class="form-group mt-16">
              <label>Estado</label>
              <select class="input" formControlName="estado">
                <option value="activo">Activo</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <div class="form-group mt-16">
              <label>Observaciones</label>
              <textarea class="input" rows="3" formControlName="observaciones"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="form.invalid">{{ contratoEditando() ? 'Guardar cambios' : 'Crear contrato' }}</button>
              <button type="button" class="btn btn-outline" (click)="cerrarPanel()">Cancelar</button>
            </div>
            @if (!contratoEditando()) {
              <p class="text-muted text-sm mt-16">Luego de crear el contrato podras asignarle los tipos de servicio y las horas establecidas.</p>
            }
          </form>
        </div>
      </div>
    }
  `,
})
export class ContratosComponent implements OnInit {
  contratos = signal<Contrato[]>([]);
  clientes = signal<Cliente[]>([]);
  panelAbierto = signal(false);
  contratoEditando = signal<Contrato | null>(null);

  filtroTexto = signal('');
  filtro = signal('');

  contratosFiltrados = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return this.contratos();
    return this.contratos().filter((c) =>
      [c.numero_contrato, c.cliente_nombre].some((campo) => (campo ?? '').toLowerCase().includes(texto))
    );
  });

  form = this.fb.group(
    {
      cliente_id: ['', Validators.required],
      numero_contrato: ['', Validators.required],
      fecha_inicio: ['', Validators.required],
      fecha_fin: [''],
      estado: ['activo' as EstadoContrato],
      observaciones: [''],
    },
    { validators: fechaFinNoAnteriorValidator }
  );

  constructor(
    private fb: FormBuilder,
    private srv: ContratosService,
    private clientesSrv: ClientesService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.clientesSrv.listar().subscribe((data) => this.clientes.set(data));
  }

  cargar(): void { this.srv.listar().subscribe((data) => this.contratos.set(data)); }

  aplicarFiltro(): void { this.filtro.set(this.filtroTexto()); }
  limpiarFiltro(): void { this.filtroTexto.set(''); this.filtro.set(''); }

  abrirNuevo(): void {
    this.contratoEditando.set(null);
    this.form.reset({ estado: 'activo' });
    this.panelAbierto.set(true);
  }

  abrirEditar(c: Contrato): void {
    this.contratoEditando.set(c);
    this.form.reset({
      cliente_id: c.cliente_id,
      numero_contrato: c.numero_contrato,
      fecha_inicio: c.fecha_inicio?.substring(0, 10),
      fecha_fin: c.fecha_fin?.substring(0, 10) ?? '',
      estado: c.estado,
      observaciones: c.observaciones ?? '',
    });
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const editando = this.contratoEditando();
    const peticion = editando
      ? this.srv.actualizar(editando.id, this.form.getRawValue())
      : this.srv.crear(this.form.getRawValue());
    peticion.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el contrato'),
    });
  }

  eliminar(c: Contrato): void {
    if (!confirm(`Eliminar el contrato "${c.numero_contrato}"? Se eliminaran tambien sus horas y registros.`)) return;
    this.srv.eliminar(c.id).subscribe(() => this.cargar());
  }

  vigencia(c: Contrato): { texto: string; clase: string } {
    if (c.estado === 'cancelado') return { texto: 'Cancelado', clase: 'badge-slate' };
    if (c.estado === 'finalizado') return { texto: 'Finalizado', clase: 'badge-slate' };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaInicio = new Date(c.fecha_inicio);
    fechaInicio.setHours(0, 0, 0, 0);
    if (fechaInicio > hoy) return { texto: 'No iniciado', clase: 'badge-slate' };

    if (c.estado === 'vencido') return { texto: 'Vencido', clase: 'badge-red' };

    if (!c.fecha_fin) return { texto: 'Vigente', clase: 'badge-green' };

    const fechaFin = new Date(c.fecha_fin);
    fechaFin.setHours(0, 0, 0, 0);
    const diasRestantes = Math.round((fechaFin.getTime() - hoy.getTime()) / 86400000);

    if (diasRestantes < 0) return { texto: 'Vencido', clase: 'badge-red' };
    if (diasRestantes <= 30) return { texto: `Por vencer (${diasRestantes} d)`, clase: 'badge-amber' };
    return { texto: 'Vigente', clase: 'badge-green' };
  }
}

function fechaFinNoAnteriorValidator(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('fecha_inicio')?.value;
  const fin = group.get('fecha_fin')?.value;
  if (!inicio || !fin) return null;
  return fin < inicio ? { fechaFinAnterior: true } : null;
}
