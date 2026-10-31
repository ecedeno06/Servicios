import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EquiposAsignadosService } from '../../core/services/equipos-asignados.service';
import { AuthService } from '../../core/services/auth.service';
import { ReporteEquiposPdfService } from '../../core/services/reporte-equipos-pdf.service';
import { ReporteEquiposExcelService } from '../../core/services/reporte-equipos-excel.service';
import { EquipoAsignado, EstadoEquipo } from '../../core/models/models';
import { MultiSelectFilterComponent } from '../../core/components/multi-select-filter/multi-select-filter.component';

const ESTADOS: { valor: EstadoEquipo; etiqueta: string }[] = [
  { valor: 'en_uso', etiqueta: 'En uso' },
  { valor: 'stock', etiqueta: 'Stock' },
  { valor: 'reparacion', etiqueta: 'Reparacion' },
  { valor: 'dano', etiqueta: 'Danado' },
  { valor: 'descarte', etiqueta: 'Descarte' },
  { valor: 'vendida', etiqueta: 'Vendida' },
];

function hoyISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

@Component({
  selector: 'app-reporte-equipos-asignados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MultiSelectFilterComponent],
  templateUrl: './reporte-equipos-asignados.component.html',
  styleUrl: './reporte-equipos-asignados.component.css',
})
export class ReporteEquiposAsignadosComponent {
  estados = ESTADOS;

  equipos = signal<EquipoAsignado[]>([]);
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

  // Filtros por columna, estilo Excel -- mismo patron que Equipos Asignados
  // y los demas reportes.
  filtroCategoria = signal<Set<string>>(new Set());
  filtroMarcaModelo = signal<Set<string>>(new Set());
  filtroEstadoCol = signal<Set<string>>(new Set());
  filtroAsignadaA = signal<Set<string>>(new Set());
  filtroEntrada = signal<Set<string>>(new Set());
  filtroVidaUtil = signal<Set<string>>(new Set());
  filtroCpu = signal<Set<string>>(new Set());
  filtroRam = signal<Set<string>>(new Set());
  filtroDisco = signal<Set<string>>(new Set());
  filtroMac = signal<Set<string>>(new Set());
  filtroProveedor = signal<Set<string>>(new Set());

  hayFiltrosColumna = computed(() => !!(
    this.filtroCategoria().size || this.filtroMarcaModelo().size || this.filtroEstadoCol().size || this.filtroAsignadaA().size ||
    this.filtroEntrada().size || this.filtroVidaUtil().size || this.filtroCpu().size || this.filtroRam().size ||
    this.filtroDisco().size || this.filtroMac().size || this.filtroProveedor().size
  ));

  limpiarFiltrosColumna(): void {
    this.filtroCategoria.set(new Set());
    this.filtroMarcaModelo.set(new Set());
    this.filtroEstadoCol.set(new Set());
    this.filtroAsignadaA.set(new Set());
    this.filtroEntrada.set(new Set());
    this.filtroVidaUtil.set(new Set());
    this.filtroCpu.set(new Set());
    this.filtroRam.set(new Set());
    this.filtroDisco.set(new Set());
    this.filtroMac.set(new Set());
    this.filtroProveedor.set(new Set());
  }

  etiquetaEstado(e: EquipoAsignado): string {
    return this.estados.find((x) => x.valor === e.estado)?.etiqueta ?? e.estado;
  }

  claseEstado(estado: EstadoEquipo): string {
    switch (estado) {
      case 'en_uso': return 'badge-green';
      case 'reparacion': return 'badge-amber';
      case 'dano': return 'badge-red';
      case 'descarte': return 'badge-red';
      default: return 'badge-slate'; // stock, vendida
    }
  }

  textoMac(e: EquipoAsignado): string {
    if (!e.mac_address && !e.hardware_address) return '-';
    return `${e.mac_address ?? '-'} - ${e.hardware_address ?? '-'}`;
  }

  // Meses calendario desde fecha_entrada hasta hoy -- mismo calculo que
  // equipos-asignados.component.ts (fecha_entrada es un "date" puro, se lee
  // en UTC para no desfasarse un dia).
  private mesesTranscurridos(fechaEntrada: string): number {
    const inicio = new Date(fechaEntrada);
    const hoy = new Date();
    let meses = (hoy.getFullYear() - inicio.getUTCFullYear()) * 12 + (hoy.getMonth() - inicio.getUTCMonth());
    if (hoy.getDate() < inicio.getUTCDate()) meses -= 1;
    return Math.max(0, meses);
  }

  private mesesRestantesVidaUtil(e: EquipoAsignado): number | null {
    if (e.vida_util_meses == null) return null;
    return e.vida_util_meses - this.mesesTranscurridos(e.fecha_entrada);
  }

  textoVidaUtil(e: EquipoAsignado): string {
    const restantes = this.mesesRestantesVidaUtil(e);
    if (restantes == null) return '-';
    return `${Math.max(0, restantes)} de ${e.vida_util_meses} m`;
  }

  claseVidaUtil(e: EquipoAsignado): string {
    const restantes = this.mesesRestantesVidaUtil(e);
    if (restantes == null) return '';
    if (restantes <= 0) return 'vida-util-vencida';
    if (restantes <= 2) return 'vida-util-por-vencer';
    return '';
  }

  private valoresUnicos(valores: (string | null | undefined)[]): string[] {
    const set = new Set(valores.filter((v): v is string => !!v));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  valoresCategoria = computed(() => this.valoresUnicos(this.equipos().map((e) => e.categoria_nombre)));
  valoresMarcaModelo = computed(() => this.valoresUnicos(this.equipos().map((e) => `${e.marca} ${e.modelo}`)));
  valoresEstadoCol = computed(() => this.valoresUnicos(this.equipos().map((e) => this.etiquetaEstado(e))));
  valoresAsignadaA = computed(() => this.valoresUnicos(this.equipos().map((e) => e.asignada_a)));
  valoresEntrada = computed(() => this.valoresUnicos(this.equipos().map((e) => e.fecha_entrada?.substring(0, 10))).sort());
  valoresVidaUtil = computed(() => this.valoresUnicos(this.equipos().map((e) => this.textoVidaUtil(e))));
  valoresCpu = computed(() => this.valoresUnicos(this.equipos().map((e) => e.procesador_nombre)));
  valoresRam = computed(() => this.valoresUnicos(this.equipos().map((e) => e.memoria_ram)));
  valoresDisco = computed(() => this.valoresUnicos(this.equipos().map((e) => e.disco_duro)));
  valoresMac = computed(() => this.valoresUnicos(this.equipos().map((e) => this.textoMac(e)).filter((v) => v !== '-')));
  valoresProveedor = computed(() => this.valoresUnicos(this.equipos().map((e) => e.proveedor_nombre)));

  formatoFecha = (v: string): string => {
    if (!v || v === '-') return '-';
    const [anio, mes, dia] = v.substring(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  };

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

  private valorOrden(e: EquipoAsignado, columna: string): string | number {
    switch (columna) {
      case 'categoria': return e.categoria_nombre.toLowerCase();
      case 'marcaModelo': return `${e.marca} ${e.modelo}`.toLowerCase();
      case 'estado': return this.etiquetaEstado(e).toLowerCase();
      case 'asignadaA': return (e.asignada_a ?? '').toLowerCase();
      case 'entrada': return e.fecha_entrada;
      case 'vidaUtil': return this.mesesRestantesVidaUtil(e) ?? Number.NEGATIVE_INFINITY;
      case 'cpu': return (e.procesador_nombre ?? '').toLowerCase();
      case 'ram': return (e.memoria_ram ?? '').toLowerCase();
      case 'disco': return (e.disco_duro ?? '').toLowerCase();
      case 'mac': return this.textoMac(e).toLowerCase();
      case 'proveedor': return (e.proveedor_nombre ?? '').toLowerCase();
      default: return '';
    }
  }

  filasFiltradas = computed(() => {
    const fCat = this.filtroCategoria();
    const fMarcaModelo = this.filtroMarcaModelo();
    const fEstado = this.filtroEstadoCol();
    const fAsignada = this.filtroAsignadaA();
    const fEntrada = this.filtroEntrada();
    const fVidaUtil = this.filtroVidaUtil();
    const fCpu = this.filtroCpu();
    const fRam = this.filtroRam();
    const fDisco = this.filtroDisco();
    const fMac = this.filtroMac();
    const fProveedor = this.filtroProveedor();

    const filtradas = this.equipos().filter((e) => {
      if (fCat.size && !fCat.has(e.categoria_nombre)) return false;
      if (fMarcaModelo.size && !fMarcaModelo.has(`${e.marca} ${e.modelo}`)) return false;
      if (fEstado.size && !fEstado.has(this.etiquetaEstado(e))) return false;
      if (fAsignada.size && !fAsignada.has(e.asignada_a ?? '')) return false;
      if (fEntrada.size && !fEntrada.has(e.fecha_entrada?.substring(0, 10))) return false;
      if (fVidaUtil.size && !fVidaUtil.has(this.textoVidaUtil(e))) return false;
      if (fCpu.size && !fCpu.has(e.procesador_nombre ?? '')) return false;
      if (fRam.size && !fRam.has(e.memoria_ram ?? '')) return false;
      if (fDisco.size && !fDisco.has(e.disco_duro ?? '')) return false;
      if (fMac.size && !fMac.has(this.textoMac(e))) return false;
      if (fProveedor.size && !fProveedor.has(e.proveedor_nombre ?? '')) return false;
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
    return filas.length > 0 && filas.every((e) => this.seleccionadas().has(e.id));
  });

  totalSeleccionadas = computed(() => this.seleccionadas().size);

  constructor(
    private fb: FormBuilder,
    private srv: EquiposAsignadosService,
    private auth: AuthService,
    private pdfSrv: ReporteEquiposPdfService,
    private excelSrv: ReporteEquiposExcelService
  ) {}

  buscar(): void {
    if (this.filtroForm.invalid) return;
    const { estado, fechaInicio, fechaFin } = this.filtroForm.getRawValue();

    this.errorBuscar.set(null);
    this.cargando.set(true);
    this.srv.reporte(fechaInicio!, fechaFin!, estado || undefined).subscribe({
      next: (equipos) => {
        this.equipos.set(equipos);
        // Por defecto se seleccionan todos los equipos -- el usuario puede
        // destildar los que no quiere incluir en el PDF/Excel.
        this.seleccionadas.set(new Set(equipos.map((e) => e.id)));
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
      this.seleccionadas.set(new Set(this.filasFiltradas().map((e) => e.id)));
    }
  }

  private equiposSeleccionados(): EquipoAsignado[] {
    return this.equipos().filter((e) => this.seleccionadas().has(e.id));
  }

  private filtroActual() {
    const { estado, fechaInicio, fechaFin } = this.filtroForm.getRawValue();
    const estadoEtiqueta = estado ? this.estados.find((x) => x.valor === estado)?.etiqueta ?? '' : '';
    return { estado: estadoEtiqueta, fechaInicio: fechaInicio!, fechaFin: fechaFin! };
  }

  generarPdf(): void {
    const seleccion = this.equiposSeleccionados();
    if (!seleccion.length) return;
    // La ventana se abre YA, sincronicamente dentro del click, para que el
    // navegador no la bloquee (mismo patron que reporte-carrito).
    const ventana = window.open('', '_blank') ?? undefined;

    this.errorPdf.set(null);
    this.generandoPdf.set(true);
    const empresa = this.auth.empresaActiva();
    this.pdfSrv
      .generar(seleccion, this.filtroActual(), (e) => this.textoVidaUtil(e), (e) => this.etiquetaEstado(e), { nombre: empresa?.empresa_nombre, logo: empresa?.empresa_logo })
      .then((doc) => doc.open(undefined, ventana))
      .catch(() => this.errorPdf.set('No se pudo generar el PDF.'))
      .finally(() => this.generandoPdf.set(false));
  }

  descargarExcel(): void {
    const seleccion = this.equiposSeleccionados();
    if (!seleccion.length) return;

    this.errorExcel.set(null);
    this.generandoExcel.set(true);
    const empresa = this.auth.empresaActiva();
    this.excelSrv
      .descargar(seleccion, this.filtroActual(), (e) => this.textoVidaUtil(e), (e) => this.etiquetaEstado(e), { nombre: empresa?.empresa_nombre })
      .catch(() => this.errorExcel.set('No se pudo generar el Excel.'))
      .finally(() => this.generandoExcel.set(false));
  }
}
