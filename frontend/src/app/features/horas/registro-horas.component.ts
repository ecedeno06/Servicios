import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { ContratosService } from '../../core/services/contratos.service';
import { AuthService } from '../../core/services/auth.service';
import { HojaServicioPdfService } from '../../core/services/hoja-servicio-pdf.service';
import { RegistroHora, Contrato, ConsumoHoras, Documento } from '../../core/models/models';

@Component({
  selector: 'app-registro-horas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './registro-horas.component.html',
  styleUrl: './registro-horas.component.css',
})
export class RegistroHorasComponent implements OnInit {
  registros = signal<RegistroHora[]>([]);
  contratos = signal<Contrato[]>([]);
  serviciosDisponibles = signal<ConsumoHoras[]>([]);
  panelAbierto = signal(false);
  registroEditando = signal<RegistroHora | null>(null);

  filtroTexto = signal('');
  filtro = signal('');

  // Filtro por contrato+servicio via query params (ej. desde "Ver horas" en el detalle del contrato)
  filtroContratoId = signal<string | null>(null);
  filtroTipoServicioId = signal<string | null>(null);

  registrosFiltrados = computed(() => {
    const contratoId = this.filtroContratoId();
    const tipoServicioId = this.filtroTipoServicioId();
    const texto = this.filtro().trim().toLowerCase();

    return this.registros().filter((r) => {
      if (contratoId && r.contrato_id !== contratoId) return false;
      if (tipoServicioId && r.tipo_servicio_id !== tipoServicioId) return false;
      if (!texto) return true;
      const campos = [
        this.numeroServicio(r),
        formatearFecha(r.fecha),
        r.cliente_nombre,
        r.numero_contrato,
        r.tipo_servicio_nombre,
        String(r.horas ?? ''),
        r.usuario_nombre,
        r.descripcion,
      ];
      return campos.some((campo) => (campo ?? '').toString().toLowerCase().includes(texto));
    });
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
  errorGuardar = signal<string | null>(null);

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
    private contratosSrv: ContratosService,
    private route: ActivatedRoute,
    private pdfSrv: HojaServicioPdfService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.contratosSrv.listar().subscribe((data) => this.contratos.set(data));
    this.form.get('contrato_id')?.valueChanges.subscribe((contratoId) => this.alCambiarContrato(contratoId));
    this.form.valueChanges.subscribe(({ hora_inicio, hora_fin }) => {
      this.horasCalculadas.set(calcularHoras(hora_inicio, hora_fin));
    });
    this.route.queryParamMap.subscribe((params) => {
      this.filtroContratoId.set(params.get('contrato_id'));
      this.filtroTipoServicioId.set(params.get('tipo_servicio_id'));
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
    const contratoId = this.filtroContratoId();
    const tipoServicioId = this.filtroTipoServicioId();
    this.form.reset({ fecha: new Date().toISOString().substring(0, 10), contrato_id: contratoId ?? '' });
    this.horasCalculadas.set(0);
    this.documentosActuales.set([]);
    this.docForm.reset();
    this.errorGuardar.set(null);

    if (contratoId) {
      this.srv.consumoPorContrato(contratoId).subscribe((data) => {
        this.serviciosDisponibles.set(data);
        if (tipoServicioId) this.form.get('tipo_servicio_id')?.setValue(tipoServicioId);
      });
    } else {
      this.serviciosDisponibles.set([]);
    }

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
    this.errorGuardar.set(null);
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
    this.errorGuardar.set(null);
    const editando = this.registroEditando();
    const documentos = this.documentosActuales();
    const { fecha, hora_inicio, hora_fin, descripcion } = this.form.getRawValue();
    const peticion = editando
      ? this.srv.actualizar(editando.id, { fecha, hora_inicio, hora_fin, descripcion, documentos })
      : this.srv.crear({ ...this.form.getRawValue(), documentos });
    peticion.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => this.errorGuardar.set(err?.error?.mensaje || 'No se pudo guardar el registro de horas'),
    });
  }

  eliminar(r: RegistroHora): void {
    if (!confirm('Eliminar este registro de horas?')) return;
    this.srv.eliminar(r.id).subscribe(() => this.cargar());
  }

  numeroServicio(r: RegistroHora): string {
    return r.id.slice(0, 8).toUpperCase();
  }

  generarPdf(r: RegistroHora): void {
    // La ventana se abre YA, sincronicamente dentro del click, para que el
    // navegador no la bloquee -- pdfmake se carga de forma diferida
    // (import() dinamico) y para cuando el PDF esta listo ya no estamos
    // dentro del gesto de click original.
    const ventana = window.open('', '_blank') ?? undefined;
    const empresa = this.auth.empresaActiva();
    this.pdfSrv.generar({
      empresaNombre: empresa?.empresa_nombre ?? '',
      empresaLogo: empresa?.empresa_logo ?? null,
      numeroServicio: this.numeroServicio(r),
      fechaEmision: formatearFecha(new Date().toISOString()),
      cliente: r.cliente_nombre ?? '',
      numeroContrato: r.numero_contrato ?? '',
      direccion: '',
      ordenTrabajo: '',
      tecnico: r.usuario_nombre ?? '',
      supervisor: '',
      tipoServicio: r.tipo_servicio_nombre ?? '',
      prioridad: '',
      detalle: [{
        fecha: formatearFecha(r.fecha),
        horaInicio: r.hora_inicio?.substring(0, 5) ?? '',
        horaFin: r.hora_fin?.substring(0, 5) ?? '',
        descripcion: r.descripcion ?? '',
      }],
      observaciones: '',
    }).then((doc) => doc.open(undefined, ventana))
      .catch(() => alert('No se pudo generar la hoja de servicio.'));
  }
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
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
