import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CarritosService } from '../../core/services/carritos.service';
import { AuthService } from '../../core/services/auth.service';
import { ReporteCarritoPdfService } from '../../core/services/reporte-carrito-pdf.service';
import { ReporteCarritoExcelService } from '../../core/services/reporte-carrito-excel.service';
import { EstadoCarrito, ReporteCarritoCabecera, ReporteCarritoDetalleItem } from '../../core/models/models';
import { MultiSelectFilterComponent } from '../../core/components/multi-select-filter/multi-select-filter.component';

const ETIQUETAS_ESTADO: Record<EstadoCarrito, string> = {
  en_construccion: 'En Construccion',
  en_revision: 'En Revision',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
};

const CLASES_BADGE_ESTADO: Record<EstadoCarrito, string> = {
  en_construccion: 'badge-slate',
  en_revision: 'badge-amber',
  aprobada: 'badge-green',
  cerrada: 'badge-slate',
};

function hoyISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

@Component({
  selector: 'app-reporte-carrito',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MultiSelectFilterComponent],
  templateUrl: './reporte-carrito.component.html',
  styleUrl: './reporte-carrito.component.css',
})
export class ReporteCarritoComponent implements OnInit {
  etiquetasEstado = ETIQUETAS_ESTADO;
  clasesBadgeEstado = CLASES_BADGE_ESTADO;
  estados: EstadoCarrito[] = ['en_construccion', 'en_revision', 'aprobada', 'cerrada'];

  cabeceras = signal<ReporteCarritoCabecera[]>([]);
  detalles = signal<ReporteCarritoDetalleItem[]>([]);
  buscado = signal(false);
  cargando = signal(false);
  errorBuscar = signal<string | null>(null);

  generandoPdf = signal(false);
  errorPdf = signal<string | null>(null);
  generandoExcel = signal(false);
  errorExcel = signal<string | null>(null);

  filtroForm = this.fb.group({
    estado: [''],
    fechaInicio: [primerDiaDelMes(), Validators.required],
    fechaFin: [hoyISO(), Validators.required],
  });

  seleccionadas = signal<Set<string>>(new Set());

  // Filtros por columna, estilo Excel (igual patron que Reporte de Servicios).
  filtroId = signal<Set<string>>(new Set());
  filtroTitulo = signal<Set<string>>(new Set());
  filtroFechaSolicitud = signal<Set<string>>(new Set());
  filtroEstadoCol = signal<Set<string>>(new Set());
  filtroFechaAprobacion = signal<Set<string>>(new Set());
  filtroCostoPropuesto = signal<Set<string>>(new Set());
  filtroCostoAprobado = signal<Set<string>>(new Set());
  filtroCreadoPor = signal<Set<string>>(new Set());

  hayFiltrosColumna = computed(() => !!(
    this.filtroId().size || this.filtroTitulo().size || this.filtroFechaSolicitud().size ||
    this.filtroEstadoCol().size || this.filtroFechaAprobacion().size ||
    this.filtroCostoPropuesto().size || this.filtroCostoAprobado().size || this.filtroCreadoPor().size
  ));

  limpiarFiltrosColumna(): void {
    this.filtroId.set(new Set());
    this.filtroTitulo.set(new Set());
    this.filtroFechaSolicitud.set(new Set());
    this.filtroEstadoCol.set(new Set());
    this.filtroFechaAprobacion.set(new Set());
    this.filtroCostoPropuesto.set(new Set());
    this.filtroCostoAprobado.set(new Set());
    this.filtroCreadoPor.set(new Set());
  }

  idCorto(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  formatoFecha = (v: string): string => {
    if (!v || v === '-') return '-';
    const [anio, mes, dia] = v.substring(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  };

  formatoMoneda = (v: string): string => {
    const n = Number(v);
    return isNaN(n) ? v : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  formatoEstado = (v: string): string => this.etiquetasEstado[v as EstadoCarrito] ?? v;

  private valoresUnicos(valores: (string | null | undefined)[]): string[] {
    const set = new Set(valores.filter((v): v is string => !!v));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  valoresId = computed(() => this.valoresUnicos(this.cabeceras().map((c) => this.idCorto(c.id))));
  valoresTitulo = computed(() => this.valoresUnicos(this.cabeceras().map((c) => c.titulo)));
  valoresFechaSolicitud = computed(() => this.valoresUnicos(this.cabeceras().map((c) => c.fecha_solicitud?.substring(0, 10))).sort());
  valoresEstadoCol = computed(() => this.valoresUnicos(this.cabeceras().map((c) => c.estado)));
  valoresFechaAprobacion = computed(() => this.valoresUnicos(this.cabeceras().map((c) => c.fecha_aprobacion?.substring(0, 10) || '-')).sort());
  valoresCostoPropuesto = computed(() =>
    this.valoresUnicos(this.cabeceras().map((c) => String(c.costo_estimado_propuesto_total))).sort((a, b) => Number(a) - Number(b))
  );
  valoresCostoAprobado = computed(() =>
    this.valoresUnicos(this.cabeceras().map((c) => String(c.costo_estimado_aprobado_total))).sort((a, b) => Number(a) - Number(b))
  );
  valoresCreadoPor = computed(() => this.valoresUnicos(this.cabeceras().map((c) => c.creado_por_nombre)));

  // Orden por columna (click en el encabezado alterna asc/desc).
  ordenColumna = signal<string | null>(null);
  ordenDireccion = signal<'asc' | 'desc'>('asc');

  ordenarPor(columna: string): void {
    if (this.ordenColumna() === columna) {
      this.ordenDireccion.set(this.ordenDireccion() === 'asc' ? 'desc' : 'asc');
    } else {
      this.ordenColumna.set(columna);
      this.ordenDireccion.set('asc');
    }
  }

  iconoOrden(columna: string): string {
    if (this.ordenColumna() !== columna) return '';
    return this.ordenDireccion() === 'asc' ? '▲' : '▼';
  }

  private valorOrden(c: ReporteCarritoCabecera, columna: string): string | number {
    switch (columna) {
      case 'id': return this.idCorto(c.id);
      case 'titulo': return c.titulo.toLowerCase();
      case 'fechaSolicitud': return c.fecha_solicitud ?? '';
      case 'estado': return c.estado;
      case 'fechaAprobacion': return c.fecha_aprobacion ?? '';
      case 'costoPropuesto': return Number(c.costo_estimado_propuesto_total ?? 0);
      case 'costoAprobado': return Number(c.costo_estimado_aprobado_total ?? 0);
      case 'creadoPor': return (c.creado_por_nombre ?? '').toLowerCase();
      default: return '';
    }
  }

  filasFiltradas = computed(() => {
    const fId = this.filtroId();
    const fTitulo = this.filtroTitulo();
    const fFechaSolicitud = this.filtroFechaSolicitud();
    const fEstado = this.filtroEstadoCol();
    const fFechaAprobacion = this.filtroFechaAprobacion();
    const fCostoPropuesto = this.filtroCostoPropuesto();
    const fCostoAprobado = this.filtroCostoAprobado();
    const fCreadoPor = this.filtroCreadoPor();

    const filtradas = this.cabeceras().filter((c) => {
      if (fId.size && !fId.has(this.idCorto(c.id))) return false;
      if (fTitulo.size && !fTitulo.has(c.titulo)) return false;
      if (fFechaSolicitud.size && !fFechaSolicitud.has(c.fecha_solicitud?.substring(0, 10))) return false;
      if (fEstado.size && !fEstado.has(c.estado)) return false;
      if (fFechaAprobacion.size && !fFechaAprobacion.has(c.fecha_aprobacion?.substring(0, 10) || '-')) return false;
      if (fCostoPropuesto.size && !fCostoPropuesto.has(String(c.costo_estimado_propuesto_total))) return false;
      if (fCostoAprobado.size && !fCostoAprobado.has(String(c.costo_estimado_aprobado_total))) return false;
      if (fCreadoPor.size && !fCreadoPor.has(c.creado_por_nombre ?? '')) return false;
      return true;
    });

    const columna = this.ordenColumna();
    if (!columna) return filtradas;
    const signo = this.ordenDireccion() === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      const va = this.valorOrden(a, columna);
      const vb = this.valorOrden(b, columna);
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return 0;
    });
  });

  todasSeleccionadas = computed(() => {
    const filas = this.filasFiltradas();
    return filas.length > 0 && filas.every((c) => this.seleccionadas().has(c.id));
  });

  totalSeleccionadas = computed(() => this.seleccionadas().size);

  totalCostoPropuesto = computed(() => this.filasFiltradas().reduce((sum, c) => sum + Number(c.costo_estimado_propuesto_total ?? 0), 0));
  totalCostoAprobado = computed(() => this.filasFiltradas().reduce((sum, c) => sum + Number(c.costo_estimado_aprobado_total ?? 0), 0));

  constructor(
    private fb: FormBuilder,
    private srv: CarritosService,
    private auth: AuthService,
    private pdfSrv: ReporteCarritoPdfService,
    private excelSrv: ReporteCarritoExcelService
  ) {}

  ngOnInit(): void {}

  buscar(): void {
    if (this.filtroForm.invalid) return;
    const { estado, fechaInicio, fechaFin } = this.filtroForm.getRawValue();

    this.errorBuscar.set(null);
    this.cargando.set(true);
    this.srv.reporte(fechaInicio!, fechaFin!, estado || undefined).subscribe({
      next: ({ cabeceras, detalles }) => {
        this.cabeceras.set(cabeceras);
        this.detalles.set(detalles);
        // Por defecto se seleccionan todas las ordenes -- el usuario puede
        // destildar las que no quiere incluir en el PDF/Excel.
        this.seleccionadas.set(new Set(cabeceras.map((c) => c.id)));
        this.limpiarFiltrosColumna();
        this.ordenColumna.set(null);
        this.buscado.set(true);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.errorBuscar.set('No se pudieron cargar los datos del reporte.');
      },
    });
  }

  toggleSeleccion(id: string): void {
    const set = new Set(this.seleccionadas());
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.seleccionadas.set(set);
  }

  toggleSeleccionarTodas(): void {
    if (this.todasSeleccionadas()) {
      this.seleccionadas.set(new Set());
    } else {
      this.seleccionadas.set(new Set(this.filasFiltradas().map((c) => c.id)));
    }
  }

  private cabecerasSeleccionadas(): ReporteCarritoCabecera[] {
    return this.cabeceras().filter((c) => this.seleccionadas().has(c.id));
  }

  private detallesSeleccionados(): ReporteCarritoDetalleItem[] {
    return this.detalles().filter((d) => this.seleccionadas().has(d.carrito_id));
  }

  private filtroActual() {
    const { estado, fechaInicio, fechaFin } = this.filtroForm.getRawValue();
    return {
      estado: (estado && this.etiquetasEstado[estado as EstadoCarrito]) || '',
      fechaInicio: fechaInicio!,
      fechaFin: fechaFin!,
    };
  }

  generarPdf(): void {
    const seleccion = this.cabecerasSeleccionadas();
    if (!seleccion.length) return;
    // La ventana se abre YA, sincronicamente dentro del click, para que el
    // navegador no la bloquee (mismo patron que reporte-servicios).
    const ventana = window.open('', '_blank') ?? undefined;

    this.errorPdf.set(null);
    this.generandoPdf.set(true);
    const empresa = this.auth.empresaActiva();
    this.pdfSrv
      .generar(seleccion, this.detallesSeleccionados(), this.filtroActual(), { nombre: empresa?.empresa_nombre, logo: empresa?.empresa_logo })
      .then((doc) => doc.open(undefined, ventana))
      .catch(() => this.errorPdf.set('No se pudo generar el PDF.'))
      .finally(() => this.generandoPdf.set(false));
  }

  descargarExcel(): void {
    const seleccion = this.cabecerasSeleccionadas();
    if (!seleccion.length) return;

    this.errorExcel.set(null);
    this.generandoExcel.set(true);
    const empresa = this.auth.empresaActiva();
    this.excelSrv
      .descargar(seleccion, this.detallesSeleccionados(), this.filtroActual(), { nombre: empresa?.empresa_nombre })
      .catch(() => this.errorExcel.set('No se pudo generar el Excel.'))
      .finally(() => this.generandoExcel.set(false));
  }
}
