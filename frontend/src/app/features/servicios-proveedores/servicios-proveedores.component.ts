import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedoresService } from '../../core/services/proveedores.service';
import { ServiciosProveedoresService } from '../../core/services/servicios-proveedores.service';
import { MenuService } from '../../core/services/menu.service';
import {
  ContactoProveedor,
  EstadoFacturaServicio,
  EstadoServicioProveedor,
  FacturaServicioProveedor,
  FormaPagoFactura,
  Proveedor,
  SectorProveedor,
  ServicioProveedor
} from '../../core/models/models';

const SECTORES: { valor: SectorProveedor; etiqueta: string }[] = [
  { valor: 'comunicaciones', etiqueta: 'Comunicaciones' },
  { valor: 'energia', etiqueta: 'Energía' },
  { valor: 'data', etiqueta: 'Data / Cloud' },
  { valor: 'agua', etiqueta: 'Agua / Servicios Básicos' },
  { valor: 'alquiler', etiqueta: 'Alquiler / Bienes Raíces' },
  { valor: 'otro', etiqueta: 'Otro' },
];

const ESTADOS_SERVICIO: { valor: EstadoServicioProveedor; etiqueta: string }[] = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'en pausa', etiqueta: 'En Pausa' },
  { valor: 'cancelado', etiqueta: 'Cancelado' },
];

const ESTADOS_FACTURA: { valor: EstadoFacturaServicio; etiqueta: string }[] = [
  { valor: 'pagada', etiqueta: 'Pagada' },
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'anulada', etiqueta: 'Anulada' },
];

const FORMAS_PAGO: { valor: FormaPagoFactura; etiqueta: string }[] = [
  { valor: 'transferencia', etiqueta: 'Transferencia Bancaria' },
  { valor: 'visa', etiqueta: 'Tarjeta Visa / Crédito' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'otro', etiqueta: 'Otro' },
];

@Component({
  selector: 'app-servicios-proveedores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  providers: [CurrencyPipe, DatePipe],
  templateUrl: './servicios-proveedores.component.html',
  styleUrl: './servicios-proveedores.component.css',
})
export class ServiciosProveedoresComponent implements OnInit {
  pestanaActiva = signal<'servicios' | 'proveedores'>('servicios');

  sectores = SECTORES;
  estadosServicio = ESTADOS_SERVICIO;
  estadosFactura = ESTADOS_FACTURA;
  formasPago = FORMAS_PAGO;

  // Listas de datos
  proveedores = signal<Proveedor[]>([]);
  servicios = signal<ServicioProveedor[]>([]);
  cargando = signal(false);
  errorMsg = signal('');

  // Filtros Proveedores
  filtroProveedor = signal('');

  proveedoresFiltrados = computed(() => {
    const q = this.filtroProveedor().trim().toLowerCase();
    if (!q) return this.proveedores();
    return this.proveedores().filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.contacto && p.contacto.toLowerCase().includes(q)) ||
        (p.correo && p.correo.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q)) ||
        p.sector.toLowerCase().includes(q)
    );
  });

  // Filtros Servicios
  filtroServicioBusqueda = signal('');
  filtroServicioSector = signal('');
  filtroServicioEstado = signal('');

  serviciosFiltrados = computed(() => {
    const q = this.filtroServicioBusqueda().trim().toLowerCase();
    const sector = this.filtroServicioSector();
    const estado = this.filtroServicioEstado();

    return this.servicios().filter((s) => {
      const cumpleBusqueda =
        !q ||
        s.servicio.toLowerCase().includes(q) ||
        (s.proveedor_nombre && s.proveedor_nombre.toLowerCase().includes(q)) ||
        (s.no_contrato && s.no_contrato.toLowerCase().includes(q));

      const cumpleSector = !sector || s.proveedor_sector === sector;
      const cumpleEstado = !estado || s.estado === estado;

      return cumpleBusqueda && cumpleSector && cumpleEstado;
    });
  });

  // Métricas KPI
  kpiTotalServicios = computed(() => this.servicios().filter((s) => s.estado === 'activo').length);

  kpiCostoMensualTotal = computed(() =>
    this.servicios()
      .filter((s) => s.estado === 'activo')
      .reduce((acc, s) => acc + (Number(s.costo_mensual) || 0), 0)
  );

  kpiCostoAnualTotal = computed(() =>
    this.servicios()
      .filter((s) => s.estado === 'activo')
      .reduce((acc, s) => acc + (Number(s.costo_anual) || 0), 0)
  );

  kpiFacturasPendientes = signal(0);

  // -------------------------------------------------------------------
  // MODAL PROVEEDOR (Crear / Editar)
  // -------------------------------------------------------------------
  modalProveedorAbierto = signal(false);
  proveedorEdicion = signal<Proveedor | null>(null);
  guardandoProveedor = signal(false);

  proveedorForm = this.fb.group({
    nombre: ['', [Validators.required]],
    sector: ['comunicaciones' as SectorProveedor, [Validators.required]],
    descripcion: [''],
    contacto: [''],
    correo: ['', [Validators.email]],
    telefono: [''],
    acepta_whatsapp: [false],
  });

  // -------------------------------------------------------------------
  // MODAL SERVICIO (Crear / Editar)
  // -------------------------------------------------------------------
  modalServicioAbierto = signal(false);
  servicioEdicion = signal<ServicioProveedor | null>(null);
  guardandoServicio = signal(false);

  servicioForm = this.fb.group({
    proveedor_id: ['', [Validators.required]],
    servicio: ['', [Validators.required]],
    costo_mensual: [0, [Validators.required, Validators.min(0)]],
    costo_anual: [0, [Validators.required, Validators.min(0)]],
    fecha_inicio: [new Date().toISOString().substring(0, 10), [Validators.required]],
    no_contrato: [''],
    estado: ['activo' as EstadoServicioProveedor, [Validators.required]],
    contactos: this.fb.array([]),
  });

  get contactosArray(): FormArray {
    return this.servicioForm.get('contactos') as FormArray;
  }

  // -------------------------------------------------------------------
  // MODAL / DRAWER FACTURAS Y TRANSACCIONES
  // -------------------------------------------------------------------
  modalFacturasAbierto = signal(false);
  servicioSeleccionado = signal<ServicioProveedor | null>(null);
  facturas = signal<FacturaServicioProveedor[]>([]);
  cargandoFacturas = signal(false);

  facturaForm = this.fb.group({
    fecha_factura: [new Date().toISOString().substring(0, 10), [Validators.required]],
    monto_factura: [0, [Validators.required, Validators.min(0.01)]],
    estado: ['pendiente' as EstadoFacturaServicio, [Validators.required]],
    forma_pago: ['transferencia' as FormaPagoFactura, [Validators.required]],
    observaciones: [''],
  });

  constructor(
    private fb: FormBuilder,
    private proveedoresSrv: ProveedoresService,
    private serviciosSrv: ServiciosProveedoresService,
    public menuSrv: MenuService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set('');

    this.proveedoresSrv.listar().subscribe({
      next: (provs) => {
        this.proveedores.set(provs);
        this.serviciosSrv.listar().subscribe({
          next: (servs) => {
            this.servicios.set(servs);
            this.calcularFacturasPendientesTotal();
            this.cargando.set(false);
          },
          error: (err) => {
            this.errorMsg.set(err.error?.mensaje || 'Error al cargar servicios');
            this.cargando.set(false);
          },
        });
      },
      error: (err) => {
        this.errorMsg.set(err.error?.mensaje || 'Error al cargar proveedores');
        this.cargando.set(false);
      },
    });
  }

  calcularFacturasPendientesTotal(): void {
    let pendientes = 0;
    this.servicios().forEach((s) => {
      if (s.id) {
        this.serviciosSrv.listarFacturas(s.id).subscribe({
          next: (facts) => {
            pendientes += facts.filter((f) => f.estado === 'pendiente').length;
            this.kpiFacturasPendientes.set(pendientes);
          },
        });
      }
    });
  }

  // -------------------------------------------------------------------
  // CRUD PROVEEDORES
  // -------------------------------------------------------------------
  abrirModalProveedor(p?: Proveedor): void {
    this.proveedorEdicion.set(p || null);
    if (p) {
      this.proveedorForm.patchValue({
        nombre: p.nombre,
        sector: p.sector,
        descripcion: p.descripcion || '',
        contacto: p.contacto || '',
        correo: p.correo || '',
        telefono: p.telefono || '',
        acepta_whatsapp: p.acepta_whatsapp,
      });
    } else {
      this.proveedorForm.reset({
        nombre: '',
        sector: 'comunicaciones',
        descripcion: '',
        contacto: '',
        correo: '',
        telefono: '',
        acepta_whatsapp: false,
      });
    }
    this.modalProveedorAbierto.set(true);
  }

  cerrarModalProveedor(): void {
    this.modalProveedorAbierto.set(false);
    this.proveedorEdicion.set(null);
  }

  guardarProveedor(): void {
    if (this.proveedorForm.invalid) {
      this.proveedorForm.markAllAsTouched();
      return;
    }

    this.guardandoProveedor.set(true);
    const val = this.proveedorForm.getRawValue() as any;
    const edicion = this.proveedorEdicion();

    if (edicion) {
      this.proveedoresSrv.actualizar(edicion.id, val).subscribe({
        next: () => {
          this.guardandoProveedor.set(false);
          this.cerrarModalProveedor();
          this.cargarDatos();
        },
        error: (err) => {
          alert(err.error?.mensaje || 'Error al actualizar proveedor');
          this.guardandoProveedor.set(false);
        },
      });
    } else {
      this.proveedoresSrv.crear(val).subscribe({
        next: () => {
          this.guardandoProveedor.set(false);
          this.cerrarModalProveedor();
          this.cargarDatos();
        },
        error: (err) => {
          alert(err.error?.mensaje || 'Error al crear proveedor');
          this.guardandoProveedor.set(false);
        },
      });
    }
  }

  eliminarProveedor(p: Proveedor): void {
    if (p.servicios_count && p.servicios_count > 0) {
      alert(`No se puede eliminar el proveedor ${p.nombre} porque tiene ${p.servicios_count} servicio(s) asociado(s).`);
      return;
    }

    if (confirm(`¿Estás seguro de eliminar el proveedor "${p.nombre}"?`)) {
      this.proveedoresSrv.eliminar(p.id).subscribe({
        next: () => this.cargarDatos(),
        error: (err) => alert(err.error?.mensaje || 'Error al eliminar proveedor'),
      });
    }
  }

  enlaceWhatsApp(telefono?: string | null): string {
    if (!telefono) return '#';
    const num = telefono.replace(/\D/g, '');
    return `https://wa.me/${num}`;
  }

  // -------------------------------------------------------------------
  // CRUD SERVICIOS
  // -------------------------------------------------------------------
  abrirModalServicio(s?: ServicioProveedor): void {
    this.servicioEdicion.set(s || null);
    this.contactosArray.clear();

    if (s) {
      this.servicioForm.patchValue({
        proveedor_id: s.proveedor_id,
        servicio: s.servicio,
        costo_mensual: s.costo_mensual,
        costo_anual: s.costo_anual,
        fecha_inicio: s.fecha_inicio ? s.fecha_inicio.substring(0, 10) : new Date().toISOString().substring(0, 10),
        no_contrato: s.no_contrato || '',
        estado: s.estado,
      });

      if (Array.isArray(s.contactos)) {
        s.contactos.forEach((c) => this.agregarContacto(c));
      }
    } else {
      this.servicioForm.reset({
        proveedor_id: this.proveedores().length > 0 ? this.proveedores()[0].id : '',
        servicio: '',
        costo_mensual: 0,
        costo_anual: 0,
        fecha_inicio: new Date().toISOString().substring(0, 10),
        no_contrato: '',
        estado: 'activo',
      });
    }
    this.modalServicioAbierto.set(true);
  }

  cerrarModalServicio(): void {
    this.modalServicioAbierto.set(false);
    this.servicioEdicion.set(null);
  }

  crearContactoGroup(c?: ContactoProveedor): FormGroup {
    return this.fb.group({
      nombre: [c?.nombre || '', [Validators.required]],
      telefono: [c?.telefono || ''],
      email: [c?.email || ''],
      cargo: [c?.cargo || ''],
    });
  }

  agregarContacto(c?: ContactoProveedor): void {
    this.contactosArray.push(this.crearContactoGroup(c));
  }

  eliminarContacto(index: number): void {
    this.contactosArray.removeAt(index);
  }

  calcularCostoAnualDesdeMensual(): void {
    const mensual = Number(this.servicioForm.get('costo_mensual')?.value) || 0;
    this.servicioForm.patchValue({ costo_anual: +(mensual * 12).toFixed(2) });
  }

  guardarServicio(): void {
    if (this.servicioForm.invalid) {
      this.servicioForm.markAllAsTouched();
      return;
    }

    this.guardandoServicio.set(true);
    const val = this.servicioForm.getRawValue() as any;
    const edicion = this.servicioEdicion();

    if (edicion) {
      this.serviciosSrv.actualizar(edicion.id, val).subscribe({
        next: () => {
          this.guardandoServicio.set(false);
          this.cerrarModalServicio();
          this.cargarDatos();
        },
        error: (err) => {
          alert(err.error?.mensaje || 'Error al actualizar servicio');
          this.guardandoServicio.set(false);
        },
      });
    } else {
      this.serviciosSrv.crear(val).subscribe({
        next: () => {
          this.guardandoServicio.set(false);
          this.cerrarModalServicio();
          this.cargarDatos();
        },
        error: (err) => {
          alert(err.error?.mensaje || 'Error al crear servicio');
          this.guardandoServicio.set(false);
        },
      });
    }
  }

  eliminarServicio(s: ServicioProveedor): void {
    if (confirm(`¿Estás seguro de eliminar el servicio "${s.servicio}"?`)) {
      this.serviciosSrv.eliminar(s.id).subscribe({
        next: () => this.cargarDatos(),
        error: (err) => alert(err.error?.mensaje || 'Error al eliminar servicio'),
      });
    }
  }

  // -------------------------------------------------------------------
  // DETALLE DE FACTURAS / TRANSACCIONES
  // -------------------------------------------------------------------
  abrirModalFacturas(s: ServicioProveedor): void {
    this.servicioSeleccionado.set(s);
    this.modalFacturasAbierto.set(true);
    this.facturaForm.reset({
      fecha_factura: new Date().toISOString().substring(0, 10),
      monto_factura: 0,
      estado: 'pendiente',
      forma_pago: 'transferencia',
      observaciones: '',
    });
    this.cargarFacturas(s.id);
  }

  cerrarModalFacturas(): void {
    this.modalFacturasAbierto.set(false);
    this.servicioSeleccionado.set(null);
    this.facturas.set([]);
  }

  cargarFacturas(servicioId: string): void {
    this.cargandoFacturas.set(true);
    this.serviciosSrv.listarFacturas(servicioId).subscribe({
      next: (facts) => {
        this.facturas.set(facts);
        this.cargandoFacturas.set(false);
      },
      error: (err) => {
        alert(err.error?.mensaje || 'Error al cargar facturas');
        this.cargandoFacturas.set(false);
      },
    });
  }

  guardarFactura(): void {
    if (this.facturaForm.invalid) {
      this.facturaForm.markAllAsTouched();
      return;
    }

    const servicio = this.servicioSeleccionado();
    if (!servicio) return;

    const val = this.facturaForm.getRawValue() as any;

    this.serviciosSrv.crearFactura(servicio.id, val).subscribe({
      next: () => {
        this.facturaForm.reset({
          fecha_factura: new Date().toISOString().substring(0, 10),
          monto_factura: 0,
          estado: 'pendiente',
          forma_pago: 'transferencia',
          observaciones: '',
        });
        this.cargarFacturas(servicio.id);
        this.cargarDatos();
      },
      error: (err) => alert(err.error?.mensaje || 'Error al registrar factura'),
    });
  }

  cambiarEstadoFactura(f: FacturaServicioProveedor, nuevoEstado: EstadoFacturaServicio): void {
    const servicio = this.servicioSeleccionado();
    if (!servicio) return;

    this.serviciosSrv.actualizarFactura(servicio.id, f.id, { estado: nuevoEstado }).subscribe({
      next: () => {
        this.cargarFacturas(servicio.id);
        this.cargarDatos();
      },
      error: (err) => alert(err.error?.mensaje || 'Error al actualizar estado de la factura'),
    });
  }

  eliminarFactura(f: FacturaServicioProveedor): void {
    const servicio = this.servicioSeleccionado();
    if (!servicio) return;

    if (confirm('¿Deseas eliminar esta factura?')) {
      this.serviciosSrv.eliminarFactura(servicio.id, f.id).subscribe({
        next: () => {
          this.cargarFacturas(servicio.id);
          this.cargarDatos();
        },
        error: (err) => alert(err.error?.mensaje || 'Error al eliminar factura'),
      });
    }
  }

  // Helpers
  etiquetaSector(s?: SectorProveedor): string {
    return this.sectores.find((item) => item.valor === s)?.etiqueta || s || '';
  }

  claseBadgeSector(s?: SectorProveedor): string {
    switch (s) {
      case 'comunicaciones': return 'badge-blue';
      case 'energia': return 'badge-amber';
      case 'data': return 'badge-purple';
      case 'agua': return 'badge-cyan';
      case 'alquiler': return 'badge-emerald';
      default: return 'badge-gray';
    }
  }

  claseBadgeEstadoServicio(e: EstadoServicioProveedor): string {
    switch (e) {
      case 'activo': return 'badge-emerald';
      case 'en pausa': return 'badge-amber';
      case 'cancelado': return 'badge-rose';
      default: return 'badge-gray';
    }
  }

  claseBadgeEstadoFactura(e: EstadoFacturaServicio): string {
    switch (e) {
      case 'pagada': return 'badge-emerald';
      case 'pendiente': return 'badge-amber';
      case 'anulada': return 'badge-rose';
      default: return 'badge-gray';
    }
  }
}
