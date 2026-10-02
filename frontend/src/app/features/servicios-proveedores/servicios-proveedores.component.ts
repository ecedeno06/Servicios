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
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'visa', etiqueta: 'Tarjeta Visa' },
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

  // Filtros Proveedores
  filtroProvNombre = signal('');
  filtroProvSector = signal('');
  filtroProvContacto = signal('');
  filtroProvEmail = signal('');
  filtroProvTelefono = signal('');

  hayFiltrosProv = computed(() =>
    !!(this.filtroProvNombre() || this.filtroProvSector() || this.filtroProvContacto() || this.filtroProvEmail() || this.filtroProvTelefono())
  );

  limpiarFiltrosProv(): void {
    this.filtroProvNombre.set('');
    this.filtroProvSector.set('');
    this.filtroProvContacto.set('');
    this.filtroProvEmail.set('');
    this.filtroProvTelefono.set('');
  }

  proveedoresFiltrados = computed(() => {
    const nom = this.filtroProvNombre().trim().toLowerCase();
    const sec = this.filtroProvSector();
    const con = this.filtroProvContacto().trim().toLowerCase();
    const em = this.filtroProvEmail().trim().toLowerCase();
    const tel = this.filtroProvTelefono().trim().toLowerCase();

    return this.proveedores().filter((p) => {
      if (nom && !p.nombre.toLowerCase().includes(nom)) return false;
      if (sec && p.sector !== sec) return false;
      if (con && !(p.contacto || '').toLowerCase().includes(con)) return false;
      if (em && !(p.correo || '').toLowerCase().includes(em)) return false;
      if (tel && !(p.telefono || '').toLowerCase().includes(tel)) return false;
      return true;
    });
  });

  // Filtros Servicios
  filtroServNombre = signal('');
  filtroServProveedor = signal('');
  filtroServSector = signal('');
  filtroServContrato = signal('');
  filtroServEstado = signal('');

  hayFiltrosServ = computed(() =>
    !!(this.filtroServNombre() || this.filtroServProveedor() || this.filtroServSector() || this.filtroServContrato() || this.filtroServEstado())
  );

  limpiarFiltrosServ(): void {
    this.filtroServNombre.set('');
    this.filtroServProveedor.set('');
    this.filtroServSector.set('');
    this.filtroServContrato.set('');
    this.filtroServEstado.set('');
  }

  serviciosFiltrados = computed(() => {
    const nom = this.filtroServNombre().trim().toLowerCase();
    const prov = this.filtroServProveedor().trim().toLowerCase();
    const sec = this.filtroServSector();
    const ctr = this.filtroServContrato().trim().toLowerCase();
    const est = this.filtroServEstado();

    return this.servicios().filter((s) => {
      if (nom && !s.servicio.toLowerCase().includes(nom)) return false;
      if (prov && !(s.proveedor_nombre || '').toLowerCase().includes(prov)) return false;
      if (sec && s.proveedor_sector !== sec) return false;
      if (ctr && !(s.no_contrato || '').toLowerCase().includes(ctr)) return false;
      if (est && s.estado !== est) return false;
      return true;
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
  // PANEL PROVEEDOR (Crear / Editar)
  // -------------------------------------------------------------------
  panelProveedorAbierto = signal(false);
  proveedorEdicion = signal<Proveedor | null>(null);

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
  // PANEL SERVICIO (Crear / Editar)
  // -------------------------------------------------------------------
  panelServicioAbierto = signal(false);
  servicioEdicion = signal<ServicioProveedor | null>(null);

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
  // PANEL FACTURAS Y TRANSACCIONES (DRAWER)
  // -------------------------------------------------------------------
  panelFacturasAbierto = signal(false);
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
    public menu: MenuService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);

    this.proveedoresSrv.listar().subscribe({
      next: (provs) => {
        this.proveedores.set(provs);
        this.serviciosSrv.listar().subscribe({
          next: (servs) => {
            this.servicios.set(servs);
            this.calcularFacturasPendientesTotal();
            this.cargando.set(false);
          },
          error: () => this.cargando.set(false),
        });
      },
      error: () => this.cargando.set(false),
    });
  }

  calcularFacturasPendientesTotal(): void {
    let pendientes = 0;
    const servs = this.servicios();
    if (servs.length === 0) {
      this.kpiFacturasPendientes.set(0);
      return;
    }

    let procesados = 0;
    servs.forEach((s) => {
      if (s.id) {
        this.serviciosSrv.listarFacturas(s.id).subscribe({
          next: (facts) => {
            pendientes += facts.filter((f) => f.estado === 'pendiente').length;
            procesados++;
            if (procesados === servs.length) {
              this.kpiFacturasPendientes.set(pendientes);
            }
          },
          error: () => {
            procesados++;
            if (procesados === servs.length) {
              this.kpiFacturasPendientes.set(pendientes);
            }
          }
        });
      }
    });
  }

  // -------------------------------------------------------------------
  // ACCIONES PROVEEDORES
  // -------------------------------------------------------------------
  abrirNuevoProveedor(): void {
    this.proveedorEdicion.set(null);
    this.proveedorForm.reset({
      nombre: '',
      sector: 'comunicaciones',
      descripcion: '',
      contacto: '',
      correo: '',
      telefono: '',
      acepta_whatsapp: false,
    });
    this.panelProveedorAbierto.set(true);
  }

  abrirEditarProveedor(p: Proveedor): void {
    this.proveedorEdicion.set(p);
    this.proveedorForm.patchValue({
      nombre: p.nombre,
      sector: p.sector,
      descripcion: p.descripcion || '',
      contacto: p.contacto || '',
      correo: p.correo || '',
      telefono: p.telefono || '',
      acepta_whatsapp: p.acepta_whatsapp,
    });
    this.panelProveedorAbierto.set(true);
  }

  cerrarPanelProveedor(): void {
    this.panelProveedorAbierto.set(false);
    this.proveedorEdicion.set(null);
  }

  guardarProveedor(): void {
    if (this.proveedorForm.invalid) return;

    const val = this.proveedorForm.getRawValue() as any;
    const edicion = this.proveedorEdicion();

    const req = edicion
      ? this.proveedoresSrv.actualizar(edicion.id, val)
      : this.proveedoresSrv.crear(val);

    req.subscribe({
      next: () => {
        this.cerrarPanelProveedor();
        this.cargarDatos();
      },
      error: (err) => alert(err.error?.mensaje || 'Error al guardar proveedor'),
    });
  }

  eliminarProveedor(p: Proveedor): void {
    if (p.servicios_count && p.servicios_count > 0) {
      alert(`No se puede eliminar el proveedor "${p.nombre}" porque tiene ${p.servicios_count} servicio(s) asociado(s).`);
      return;
    }

    if (!confirm(`¿Eliminar el proveedor "${p.nombre}"? Esta acción no se puede deshacer.`)) return;

    this.proveedoresSrv.eliminar(p.id).subscribe({
      next: () => this.cargarDatos(),
      error: (err) => alert(err.error?.mensaje || 'Error al eliminar proveedor'),
    });
  }

  enlaceWhatsApp(telefono?: string | null): string {
    if (!telefono) return '#';
    const num = telefono.replace(/\D/g, '');
    return `https://wa.me/${num}`;
  }

  // -------------------------------------------------------------------
  // ACCIONES SERVICIOS
  // -------------------------------------------------------------------
  abrirNuevoServicio(): void {
    this.servicioEdicion.set(null);
    this.contactosArray.clear();
    this.servicioForm.reset({
      proveedor_id: this.proveedores().length > 0 ? this.proveedores()[0].id : '',
      servicio: '',
      costo_mensual: 0,
      costo_anual: 0,
      fecha_inicio: new Date().toISOString().substring(0, 10),
      no_contrato: '',
      estado: 'activo',
    });
    this.panelServicioAbierto.set(true);
  }

  abrirEditarServicio(s: ServicioProveedor): void {
    this.servicioEdicion.set(s);
    this.contactosArray.clear();

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

    this.panelServicioAbierto.set(true);
  }

  cerrarPanelServicio(): void {
    this.panelServicioAbierto.set(false);
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
    if (this.servicioForm.invalid) return;

    const val = this.servicioForm.getRawValue() as any;
    const edicion = this.servicioEdicion();

    const req = edicion
      ? this.serviciosSrv.actualizar(edicion.id, val)
      : this.serviciosSrv.crear(val);

    req.subscribe({
      next: () => {
        this.cerrarPanelServicio();
        this.cargarDatos();
      },
      error: (err) => alert(err.error?.mensaje || 'Error al guardar servicio'),
    });
  }

  eliminarServicio(s: ServicioProveedor): void {
    if (!confirm(`¿Eliminar el servicio "${s.servicio}"? Esta acción no se puede deshacer.`)) return;

    this.serviciosSrv.eliminar(s.id).subscribe({
      next: () => this.cargarDatos(),
      error: (err) => alert(err.error?.mensaje || 'Error al eliminar servicio'),
    });
  }

  // -------------------------------------------------------------------
  // FACTURAS / DRAWER
  // -------------------------------------------------------------------
  abrirFacturas(s: ServicioProveedor): void {
    this.servicioSeleccionado.set(s);
    this.panelFacturasAbierto.set(true);
    this.facturaForm.reset({
      fecha_factura: new Date().toISOString().substring(0, 10),
      monto_factura: 0,
      estado: 'pendiente',
      forma_pago: 'transferencia',
      observaciones: '',
    });
    this.cargarFacturas(s.id);
  }

  cerrarPanelFacturas(): void {
    this.panelFacturasAbierto.set(false);
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
      error: () => this.cargandoFacturas.set(false),
    });
  }

  guardarFactura(): void {
    if (this.facturaForm.invalid) return;

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
      error: (err) => alert(err.error?.mensaje || 'Error al actualizar estado de factura'),
    });
  }

  eliminarFactura(f: FacturaServicioProveedor): void {
    const servicio = this.servicioSeleccionado();
    if (!servicio) return;

    if (!confirm('¿Eliminar esta factura del registro?')) return;

    this.serviciosSrv.eliminarFactura(servicio.id, f.id).subscribe({
      next: () => {
        this.cargarFacturas(servicio.id);
        this.cargarDatos();
      },
      error: (err) => alert(err.error?.mensaje || 'Error al eliminar factura'),
    });
  }

  // Helpers de Formato y Badges
  etiquetaSector(s?: SectorProveedor): string {
    return this.sectores.find((item) => item.valor === s)?.etiqueta || s || '';
  }

  claseBadgeEstadoServicio(e: EstadoServicioProveedor): string {
    switch (e) {
      case 'activo': return 'badge-green';
      case 'en pausa': return 'badge-amber';
      case 'cancelado': return 'badge-red';
      default: return 'badge-slate';
    }
  }

  claseBadgeEstadoFactura(e: EstadoFacturaServicio): string {
    switch (e) {
      case 'pagada': return 'badge-green';
      case 'pendiente': return 'badge-amber';
      case 'anulada': return 'badge-red';
      default: return 'badge-slate';
    }
  }
}
