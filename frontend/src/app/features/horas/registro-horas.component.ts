import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { ContratosService } from '../../core/services/contratos.service';
import { RegistroHora, Contrato, ConsumoHoras, Documento } from '../../core/models/models';

@Component({
  selector: 'app-registro-horas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Registro de horas</h1>
        <div class="desc">Horas de servicio ejecutadas a cada cliente, por contrato y tipo de servicio</div>
      </div>
      <button class="btn btn-accent" (click)="abrirNuevo()">+ Registrar horas</button>
    </div>

    <div class="filter-bar">
      <input
        class="input"
        type="text"
        placeholder="Buscar por cliente, contrato, servicio o quien registro..."
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
            <th class="sortable" (click)="ordenarPor('fecha')">Fecha{{ indicadorOrden('fecha') }}</th>
            <th class="sortable" (click)="ordenarPor('cliente_nombre')">Cliente{{ indicadorOrden('cliente_nombre') }}</th>
            <th class="sortable" (click)="ordenarPor('numero_contrato')">Contrato{{ indicadorOrden('numero_contrato') }}</th>
            <th class="sortable" (click)="ordenarPor('tipo_servicio_nombre')">Servicio{{ indicadorOrden('tipo_servicio_nombre') }}</th>
            <th class="sortable" (click)="ordenarPor('horas')">Horas{{ indicadorOrden('horas') }}</th>
            <th class="sortable" (click)="ordenarPor('usuario_nombre')">Registrado por{{ indicadorOrden('usuario_nombre') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of registrosOrdenados(); track r.id) {
            <tr>
              <td>{{ r.fecha | date:'dd/MM/yyyy' }}{{ r.created_at ? ' ' + (r.created_at | date:'HH:mm') : '' }}</td>
              <td>{{ r.cliente_nombre }}</td>
              <td>{{ r.numero_contrato }}</td>
              <td>{{ r.tipo_servicio_nombre }}</td>
              <td>{{ r.horas | number:'1.0-2' }}</td>
              <td>{{ r.usuario_nombre }}</td>
              <td class="table-actions">
                <button class="btn btn-outline btn-sm" (click)="abrirEditar(r)">Editar</button>
                <button class="btn btn-danger btn-sm" (click)="eliminar(r)">Eliminar</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7"><div class="empty-state">{{ filtro() ? 'Ningun registro coincide con la busqueda.' : 'Aun no se han registrado horas ejecutadas.' }}</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (panelAbierto()) {
      <div class="overlay" (click)="cerrarPanel()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>{{ registroEditando() ? 'Editar registro de horas' : 'Registrar horas ejecutadas' }}</h2>
            <button class="close" (click)="cerrarPanel()">&times;</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="guardar()">
            @if (registroEditando(); as r) {
              <div class="form-group">
                <label>Contrato</label>
                <input class="input" type="text" [value]="r.numero_contrato + ' · ' + r.cliente_nombre" disabled />
              </div>
              <div class="form-group mt-16">
                <label>Tipo de servicio</label>
                <input class="input" type="text" [value]="r.tipo_servicio_nombre" disabled />
              </div>
            } @else {
              <div class="form-group">
                <label>Contrato *</label>
                <select class="input" formControlName="contrato_id">
                  <option value="" disabled>Selecciona un contrato</option>
                  @for (c of contratos(); track c.id) { <option [value]="c.id">{{ c.numero_contrato }} &middot; {{ c.cliente_nombre }}</option> }
                </select>
              </div>

              <div class="form-group mt-16">
                <label>Tipo de servicio *</label>
                <select class="input" formControlName="tipo_servicio_id">
                  <option value="" disabled>Selecciona un servicio</option>
                  @for (s of serviciosDisponibles(); track s.tipo_servicio_id) {
                    <option [value]="s.tipo_servicio_id">{{ s.tipo_servicio_nombre }} ({{ s.horas_disponibles | number:'1.0-1' }} h libres)</option>
                  }
                </select>
                @if (form.get('contrato_id')?.value && serviciosDisponibles().length === 0) {
                  <div class="hint">Este contrato no tiene horas establecidas para ningun servicio. Ve al detalle del contrato para asignarlas.</div>
                }
              </div>
            }

            <div class="form-group mt-16">
              <label>Fecha *</label>
              <input class="input" type="date" formControlName="fecha" />
            </div>
            <div class="form-group mt-16">
              <label>Hora de inicio *</label>
              <input class="input" type="time" formControlName="hora_inicio" />
            </div>
            <div class="form-group mt-16">
              <label>Hora de fin *</label>
              <input class="input" type="time" formControlName="hora_fin" />
              @if (form.errors?.['horaFinInvalida']) {
                <div class="error-text">La hora de fin debe ser posterior a la hora de inicio.</div>
              }
            </div>
            <div class="form-group mt-16">
              <label>Horas ejecutadas</label>
              <input class="input" type="text" [value]="horasCalculadas() | number:'1.0-2'" disabled />
            </div>
            <div class="form-group mt-16">
              <label>Descripcion</label>
              <textarea class="input" rows="3" formControlName="descripcion" placeholder="Detalle de la actividad realizada"></textarea>
            </div>

            <div class="card mt-16">
              <h3 style="margin:0;">Documentos</h3>

              <div class="table-wrap mt-16">
                <table class="data-table">
                  <thead>
                    <tr><th>Nombre</th><th>URL</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (d of documentosActuales(); track d.url) {
                      <tr>
                        <td>{{ d.nombre }}</td>
                        <td><a [href]="d.url" target="_blank" rel="noopener">Abrir</a></td>
                        <td class="table-actions">
                          <button type="button" class="btn btn-danger btn-sm" (click)="quitarDocumento(d)">Quitar</button>
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="3"><div class="empty-state">Sin documentos asociados.</div></td></tr>
                    }
                  </tbody>
                </table>
              </div>

              <div [formGroup]="docForm">
                <div class="form-group mt-16">
                  <label>Nombre</label>
                  <input class="input" formControlName="nombre" placeholder="Evidencia.pdf" />
                </div>
                <div class="form-group mt-16">
                  <label>URL (OneDrive u otro origen)</label>
                  <input class="input" type="url" formControlName="url" placeholder="https://onedrive.live.com/..." />
                </div>
                <button type="button" class="btn btn-outline btn-sm mt-16" [disabled]="docForm.invalid" (click)="agregarDocumento()">+ Agregar documento</button>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="form.invalid">{{ registroEditando() ? 'Guardar cambios' : 'Guardar' }}</button>
              <button type="button" class="btn btn-outline" (click)="cerrarPanel()">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class RegistroHorasComponent implements OnInit {
  registros = signal<RegistroHora[]>([]);
  contratos = signal<Contrato[]>([]);
  serviciosDisponibles = signal<ConsumoHoras[]>([]);
  panelAbierto = signal(false);
  registroEditando = signal<RegistroHora | null>(null);

  filtroTexto = signal('');
  filtro = signal('');

  registrosFiltrados = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return this.registros();
    return this.registros().filter((r) =>
      [r.cliente_nombre, r.numero_contrato, r.tipo_servicio_nombre, r.usuario_nombre, r.descripcion]
        .some((campo) => (campo ?? '').toLowerCase().includes(texto))
    );
  });

  columnaOrden = signal<keyof RegistroHora | null>(null);
  direccionOrden = signal<'asc' | 'desc'>('asc');

  registrosOrdenados = computed(() => {
    const columna = this.columnaOrden();
    const filas = [...this.registrosFiltrados()];
    if (!columna) return filas;
    const direccion = this.direccionOrden() === 'asc' ? 1 : -1;
    return filas.sort((a, b) => {
      if (columna === 'fecha') return claveFechaHora(a).localeCompare(claveFechaHora(b)) * direccion;

      const valorA = a[columna];
      const valorB = b[columna];
      if (valorA == null && valorB == null) return 0;
      if (valorA == null) return -1 * direccion;
      if (valorB == null) return 1 * direccion;
      if (typeof valorA === 'number' && typeof valorB === 'number') return (valorA - valorB) * direccion;
      return String(valorA).localeCompare(String(valorB)) * direccion;
    });
  });

  horasCalculadas = signal(0);
  documentosActuales = signal<Documento[]>([]);

  form = this.fb.group(
    {
      contrato_id: ['', Validators.required],
      tipo_servicio_id: ['', Validators.required],
      fecha: [new Date().toISOString().substring(0, 10), Validators.required],
      hora_inicio: ['', Validators.required],
      hora_fin: ['', Validators.required],
      descripcion: [''],
    },
    { validators: horaFinPosteriorValidator }
  );

  docForm = this.fb.group({
    nombre: ['', Validators.required],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
  });

  constructor(
    private fb: FormBuilder,
    private srv: RegistroHorasService,
    private contratosSrv: ContratosService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.contratosSrv.listar().subscribe((data) => this.contratos.set(data));
    this.form.get('contrato_id')?.valueChanges.subscribe((contratoId) => this.alCambiarContrato(contratoId));
    this.form.valueChanges.subscribe(({ hora_inicio, hora_fin }) => {
      this.horasCalculadas.set(calcularHoras(hora_inicio, hora_fin));
    });
  }

  cargar(): void { this.srv.listar().subscribe((data) => this.registros.set(data)); }

  aplicarFiltro(): void { this.filtro.set(this.filtroTexto()); }
  limpiarFiltro(): void { this.filtroTexto.set(''); this.filtro.set(''); }

  ordenarPor(columna: keyof RegistroHora): void {
    if (this.columnaOrden() === columna) {
      this.direccionOrden.set(this.direccionOrden() === 'asc' ? 'desc' : 'asc');
    } else {
      this.columnaOrden.set(columna);
      this.direccionOrden.set('asc');
    }
  }

  indicadorOrden(columna: keyof RegistroHora): string {
    if (this.columnaOrden() !== columna) return '';
    return this.direccionOrden() === 'asc' ? ' ▲' : ' ▼';
  }

  abrirNuevo(): void {
    this.registroEditando.set(null);
    this.form.reset({ fecha: new Date().toISOString().substring(0, 10) });
    this.horasCalculadas.set(0);
    this.documentosActuales.set([]);
    this.docForm.reset();
    this.serviciosDisponibles.set([]);
    this.panelAbierto.set(true);
  }

  abrirEditar(r: RegistroHora): void {
    this.registroEditando.set(r);
    this.form.reset({
      contrato_id: r.contrato_id,
      tipo_servicio_id: r.tipo_servicio_id,
      fecha: r.fecha.substring(0, 10),
      hora_inicio: r.hora_inicio?.substring(0, 5) ?? '',
      hora_fin: r.hora_fin?.substring(0, 5) ?? '',
      descripcion: r.descripcion ?? '',
    });
    this.horasCalculadas.set(calcularHoras(r.hora_inicio, r.hora_fin));
    this.documentosActuales.set(r.documentos ?? []);
    this.docForm.reset();
    this.panelAbierto.set(true);
  }

  agregarDocumento(): void {
    if (this.docForm.invalid) return;
    this.documentosActuales.update((docs) => [...docs, this.docForm.getRawValue() as Documento]);
    this.docForm.reset();
  }

  quitarDocumento(doc: Documento): void {
    this.documentosActuales.update((docs) => docs.filter((d) => d.url !== doc.url));
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  alCambiarContrato(contratoId: string | null): void {
    this.form.get('tipo_servicio_id')?.setValue('', { emitEvent: false });
    if (!contratoId) { this.serviciosDisponibles.set([]); return; }
    this.srv.consumoPorContrato(contratoId).subscribe((data) => this.serviciosDisponibles.set(data));
  }

  guardar(): void {
    if (this.form.invalid) return;
    const editando = this.registroEditando();
    const documentos = this.documentosActuales();
    const { fecha, hora_inicio, hora_fin, descripcion } = this.form.getRawValue();
    const peticion = editando
      ? this.srv.actualizar(editando.id, { fecha, hora_inicio, hora_fin, descripcion, documentos })
      : this.srv.crear({ ...this.form.getRawValue(), documentos });
    peticion.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el registro de horas'),
    });
  }

  eliminar(r: RegistroHora): void {
    if (!confirm('Eliminar este registro de horas?')) return;
    this.srv.eliminar(r.id).subscribe(() => this.cargar());
  }
}

function claveFechaHora(r: RegistroHora): string {
  const fecha = r.fecha?.substring(0, 10) ?? '';
  const hora = r.created_at?.substring(11, 19) ?? '00:00:00';
  return `${fecha}T${hora}`;
}

function calcularHoras(horaInicio: string | null | undefined, horaFin: string | null | undefined): number {
  if (!horaInicio || !horaFin) return 0;
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  return minutos > 0 ? Math.round((minutos / 60) * 100) / 100 : 0;
}

function horaFinPosteriorValidator(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('hora_inicio')?.value;
  const fin = group.get('hora_fin')?.value;
  if (!inicio || !fin) return null;
  return calcularHoras(inicio, fin) <= 0 ? { horaFinInvalida: true } : null;
}
