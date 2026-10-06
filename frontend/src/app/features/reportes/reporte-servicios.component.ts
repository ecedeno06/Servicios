import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedoresService } from '../../core/services/proveedores.service';
import { SectoresProveedoresService } from '../../core/services/sectores-proveedores.service';
import { ServiciosProveedoresService } from '../../core/services/servicios-proveedores.service';
import { AuthService } from '../../core/services/auth.service';
import { ReporteServiciosPdfService } from '../../core/services/reporte-servicios-pdf.service';
import { ReporteServiciosExcelService } from '../../core/services/reporte-servicios-excel.service';
import { EstadoServicioProveedor, Proveedor, ReporteServicioPagos, SectorProveedorItem } from '../../core/models/models';

@Component({
  selector: 'app-reporte-servicios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './reporte-servicios.component.html',
  styleUrl: './reporte-servicios.component.css',
})
export class ReporteServiciosComponent implements OnInit {
  proveedores = signal<Proveedor[]>([]);
  sectores = signal<SectorProveedorItem[]>([]);

  filas = signal<ReporteServicioPagos[]>([]);
  buscado = signal(false);
  cargando = signal(false);
  errorBuscar = signal<string | null>(null);

  generandoPdf = signal(false);
  errorPdf = signal<string | null>(null);
  generandoExcel = signal(false);
  errorExcel = signal<string | null>(null);

  filtroForm = this.fb.group({
    proveedor_id: [''],
    sector_id: [''],
    fechaInicio: [primerDiaDelMes(), Validators.required],
    fechaFin: [hoyISO(), Validators.required],
  });

  seleccionadas = signal<Set<string>>(new Set());

  todasSeleccionadas = computed(() => {
    const filas = this.filas();
    return filas.length > 0 && filas.every((f) => this.seleccionadas().has(f.id));
  });

  totalSeleccionadas = computed(() => this.seleccionadas().size);

  totalCostoMensual = computed(() => this.filas().reduce((sum, f) => sum + Number(f.costo_mensual ?? 0), 0));
  totalPagosRango = computed(() => this.filas().reduce((sum, f) => sum + Number(f.pagos_total_rango ?? 0), 0));

  constructor(
    private fb: FormBuilder,
    private proveedoresSrv: ProveedoresService,
    private sectoresSrv: SectoresProveedoresService,
    private serviciosSrv: ServiciosProveedoresService,
    private auth: AuthService,
    private pdfSrv: ReporteServiciosPdfService,
    private excelSrv: ReporteServiciosExcelService
  ) {}

  ngOnInit(): void {
    this.proveedoresSrv.listar().subscribe((data) => this.proveedores.set(data));
    this.sectoresSrv.listar().subscribe((data) => this.sectores.set(data));
  }

  buscar(): void {
    if (this.filtroForm.invalid) return;
    const { proveedor_id, sector_id, fechaInicio, fechaFin } = this.filtroForm.getRawValue();

    this.errorBuscar.set(null);
    this.cargando.set(true);
    this.serviciosSrv.reportePagos(fechaInicio!, fechaFin!).subscribe({
      next: (data) => {
        const proveedorNombre = proveedor_id ? this.proveedores().find((p) => p.id === proveedor_id)?.nombre : null;
        const sectorNombre = sector_id ? this.sectores().find((s) => s.id === sector_id)?.nombre : null;
        const filtrados = data.filter((f) =>
          (!proveedorNombre || f.proveedor_nombre === proveedorNombre) &&
          (!sectorNombre || f.sector_nombre === sectorNombre)
        );
        this.filas.set(filtrados);
        // Por defecto se seleccionan todos los resultados -- el usuario
        // puede destildar los que no quiere incluir en el PDF/Excel.
        this.seleccionadas.set(new Set(filtrados.map((f) => f.id)));
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
      this.seleccionadas.set(new Set(this.filas().map((f) => f.id)));
    }
  }

  claseBadgeEstado(e: EstadoServicioProveedor): string {
    switch (e) {
      case 'activo': return 'badge-green';
      case 'en pausa': return 'badge-amber';
      case 'vencido': return 'badge-red';
      case 'cancelado': return 'badge-red';
      case 'inactivo': return 'badge-slate';
      default: return 'badge-slate';
    }
  }

  private filasSeleccionadas(): ReporteServicioPagos[] {
    return this.filas().filter((f) => this.seleccionadas().has(f.id));
  }

  private filtroActual() {
    const { proveedor_id, sector_id, fechaInicio, fechaFin } = this.filtroForm.getRawValue();
    return {
      proveedor: (proveedor_id && this.proveedores().find((p) => p.id === proveedor_id)?.nombre) || '',
      sector: (sector_id && this.sectores().find((s) => s.id === sector_id)?.nombre) || '',
      fechaInicio: fechaInicio!,
      fechaFin: fechaFin!,
    };
  }

  generarPdf(): void {
    const seleccion = this.filasSeleccionadas();
    if (!seleccion.length) return;
    // La ventana se abre YA, sincronicamente dentro del click, para que el
    // navegador no la bloquee (mismo patron que reporte-horas).
    const ventana = window.open('', '_blank') ?? undefined;

    this.errorPdf.set(null);
    this.generandoPdf.set(true);
    const empresa = this.auth.empresaActiva();
    this.pdfSrv
      .generar(seleccion, this.filtroActual(), { nombre: empresa?.empresa_nombre, logo: empresa?.empresa_logo })
      .then((doc) => doc.open(undefined, ventana))
      .catch(() => this.errorPdf.set('No se pudo generar el PDF.'))
      .finally(() => this.generandoPdf.set(false));
  }

  descargarExcel(): void {
    const seleccion = this.filasSeleccionadas();
    if (!seleccion.length) return;

    this.errorExcel.set(null);
    this.generandoExcel.set(true);
    const empresa = this.auth.empresaActiva();
    this.excelSrv
      .descargar(seleccion, this.filtroActual(), { nombre: empresa?.empresa_nombre })
      .catch(() => this.errorExcel.set('No se pudo generar el Excel.'))
      .finally(() => this.generandoExcel.set(false));
  }
}

function hoyISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
