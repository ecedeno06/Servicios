import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedoresService } from '../../core/services/proveedores.service';
import { ServiciosProveedoresService } from '../../core/services/servicios-proveedores.service';
import { SectoresProveedoresService } from '../../core/services/sectores-proveedores.service';
import { MenuService } from '../../core/services/menu.service';
import {
  ContactoProveedor,
  EstadoFacturaServicio,
  EstadoServicioProveedor,
  FacturaServicioProveedor,
  FormaPagoFactura,
  Proveedor,
  SectorProveedorItem,
  ServicioProveedor
} from '../../core/models/models';

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
  pestanaActiva = signal<'servicios' | 'proveedores' | 'sectores'>('servicios');

  estadosServicio = ESTADOS_SERVICIO;
  estadosFactura = ESTADOS_FACTURA;
  formasPago = FORMAS_PAGO;

  // Listas de datos
  sectores = signal<SectorProveedorItem[]>([]);
  proveedores = signal<Proveedor[]>([]);
  servicios = signal<ServicioProveedor[]>([]);
  cargando = signal(false);

  // Filtros Sectores
  filtroSecNombre = signal('');
  filtroSecEstado = signal('');

  hayFiltrosSec = computed(() => !!(this.filtroSecNombre() || this.filtroSecEstado()));

  limpiarFiltrosSec(): void {
    this.filtroSecNombre.set('');
    this.filtroSecEstado.set('');
  }

  sectoresFiltrados = computed(() => {
    const nom = this.filtroSecNombre().trim().toLowerCase();
    const est = this.filtroSecEstado();

    return this.sectores().filter((s) => {
      if (nom && !s.nombre.toLowerCase().includes(nom) && !(s.descripcion || '').toLowerCase().includes(nom)) return false;
      if (est && (s.activo ? 'activo' : 'inactivo') !== est) return false;
      return true;
    });
  });

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
      if (sec && p.sector_id !== sec && p.sector !== sec) return false;
      if (con && !(p.contacto || '').toLowerCase().includes(con)) return false;
      if (em && !(p.correo || '').toLowerCase().includes(em)) return false;
      if (tel && !(p.telefono || '').toLowerCase().includes(tel)) return false;
      return true;
    });
  });

  // Buscador general: igual que en Equipos asignados -- solo se activa
  // con el boton de la lupa (no en cada tecla), busca en cualquier campo
  // visible de la fila (no solo en las columnas con filtro propio).
  busquedaGeneralServInput = signal('');
  busquedaGeneralServ = signal('');

  buscarGeneralServicios(): void {
    this.busquedaGeneralServ.set(this.busquedaGeneralServInput());
  }

  // "Indefinido" si es_indefinido, la fecha formateada si no, '-' si no
  // hay ninguna de las dos (dato viejo de antes de la migracion 029).
  textoFechaFin(s: ServicioProveedor): string {
    if (s.es_indefinido) return 'Indefinido';
    if (!s.fecha_fin) return '-';
    return this.datePipe.transform(s.fecha_fin, 'dd/MM/yyyy', 'UTC') || '-';
  }

  // Dias de hoy a fecha_fin (negativo si ya vencio). No aplica a
  // servicios indefinidos. Compara fechas puras en UTC (sin hora) para
  // no desfasarse un dia en timezones negativos.
  private diasRestantes(s: ServicioProveedor): number | null {
    if (s.es_indefinido || !s.fecha_fin) return null;
    const fin = new Date(s.fecha_fin);
    const finUTC = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());
    const hoy = new Date();
    const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return Math.round((finUTC - hoyUTC) / 86400000);
  }

  // Columna "Aviso Previo": muestra cuanto falta para vencer (no el
  // umbral configurado en dias_aviso_vencimiento -- ese solo decide
  // cuando se activa la alerta, ver debeAvisarVencimiento/claseBadgeAviso).
  textoAvisoVencimiento(s: ServicioProveedor): string {
    const dias = this.diasRestantes(s);
    if (dias == null) return '-';
    if (dias < 0) return `Vencido hace ${Math.abs(dias)} dia(s)`;
    if (dias === 0) return 'Vence hoy';
    return `${dias} dia(s)`;
  }

  // La alerta (badge amber/rojo) solo aparece si hay un umbral configurado
  // y ya estamos dentro de esa ventana (o ya vencio).
  debeAvisarVencimiento(s: ServicioProveedor): boolean {
    if (s.dias_aviso_vencimiento == null) return false;
    const dias = this.diasRestantes(s);
    return dias != null && dias <= s.dias_aviso_vencimiento;
  }

  claseBadgeAviso(s: ServicioProveedor): string {
    const dias = this.diasRestantes(s);
    return dias != null && dias < 0 ? 'badge-red' : 'badge-amber';
  }

  private coincideBusquedaGeneralServicio(s: ServicioProveedor, texto: string): boolean {
    const campos: (string | number | null | undefined)[] = [
      s.servicio, s.proveedor_nombre, this.obtenerNombreSector(s.proveedor_sector_id, s.proveedor_sector),
      s.no_contrato, s.costo_mensual, s.costo_anual, s.monto_total_pagado, this.textoFechaFin(s),
      this.textoAvisoVencimiento(s), s.estado, s.facturas_count,
    ];
    return campos.some((c) => c != null && String(c).toLowerCase().includes(texto));
  }

  // Filtros Servicios
  filtroServNombre = signal('');
  filtroServProveedor = signal('');
  filtroServSector = signal('');
  filtroServContrato = signal('');
  filtroServCostoMensual = signal('');
  filtroServCostoAnual = signal('');
  filtroServPagado = signal('');
  filtroServFechaFin = signal('');
  filtroServAviso = signal('');
  filtroServEstado = signal('');
  filtroServFacturas = signal('');

  hayFiltrosServ = computed(() => !!(
    this.busquedaGeneralServ() ||
    this.filtroServNombre() || this.filtroServProveedor() || this.filtroServSector() || this.filtroServContrato() ||
    this.filtroServCostoMensual() || this.filtroServCostoAnual() || this.filtroServPagado() || this.filtroServFechaFin() ||
    this.filtroServAviso() || this.filtroServEstado() || this.filtroServFacturas() || this.filtroSoloPendientes()
  ));

  limpiarFiltrosServ(): void {
    this.busquedaGeneralServInput.set('');
    this.busquedaGeneralServ.set('');
    this.filtroServNombre.set('');
    this.filtroServProveedor.set('');
    this.filtroServSector.set('');
    this.filtroServContrato.set('');
    this.filtroServCostoMensual.set('');
    this.filtroServCostoAnual.set('');
    this.filtroServPagado.set('');
    this.filtroServFechaFin.set('');
    this.filtroServAviso.set('');
    this.filtroServEstado.set('');
    this.filtroServFacturas.set('');
    this.filtroSoloPendientes.set(false);
  }

  serviciosFiltrados = computed(() => {
    const fGeneral = this.busquedaGeneralServ().trim().toLowerCase();
    const nom = this.filtroServNombre().trim().toLowerCase();
    const prov = this.filtroServProveedor().trim().toLowerCase();
    const sec = this.filtroServSector();
    const ctr = this.filtroServContrato().trim().toLowerCase();
    const costoM = this.filtroServCostoMensual().trim().toLowerCase();
    const costoA = this.filtroServCostoAnual().trim().toLowerCase();
    const pagado = this.filtroServPagado().trim().toLowerCase();
    const fechaFin = this.filtroServFechaFin().trim().toLowerCase();
    const aviso = this.filtroServAviso().trim().toLowerCase();
    const est = this.filtroServEstado();
    const fact = this.filtroServFacturas().trim().toLowerCase();

    return this.servicios().filter((s) => {
      if (fGeneral && !this.coincideBusquedaGeneralServicio(s, fGeneral)) return false;
      if (nom && !s.servicio.toLowerCase().includes(nom)) return false;
      if (prov && !(s.proveedor_nombre || '').toLowerCase().includes(prov)) return false;
      if (sec && s.proveedor_sector_id !== sec && s.proveedor_sector !== sec) return false;
      if (ctr && !(s.no_contrato || '').toLowerCase().includes(ctr)) return false;
      if (costoM && !String(s.costo_mensual ?? '').toLowerCase().includes(costoM)) return false;
      if (costoA && !String(s.costo_anual ?? '').toLowerCase().includes(costoA)) return false;
      if (pagado && !String(s.monto_total_pagado ?? 0).toLowerCase().includes(pagado)) return false;
      if (fechaFin && !this.textoFechaFin(s).toLowerCase().includes(fechaFin)) return false;
      if (aviso && !this.textoAvisoVencimiento(s).toLowerCase().includes(aviso)) return false;
      if (est && s.estado !== est) return false;
      if (fact && !String(s.facturas_count ?? 0).toLowerCase().includes(fact)) return false;
      if (this.filtroSoloPendientes() && !(s.facturas_pendientes_count && s.facturas_pendientes_count > 0)) return false;
      return true;
    });
  });

  // Métricas KPI: se calculan sobre serviciosFiltrados(), no sobre
  // servicios() completo -- al aplicar cualquier filtro/busqueda (o
  // tocar la tarjeta de Facturas Pendientes) las tarjetas reflejan solo
  // lo que esta visible en la tabla en ese momento.
  kpiTotalServicios = computed(() => this.serviciosFiltrados().filter((s) => s.estado === 'activo').length);

  kpiCostoMensualTotal = computed(() =>
    this.serviciosFiltrados()
      .filter((s) => s.estado === 'activo')
      .reduce((acc, s) => acc + (Number(s.costo_mensual) || 0), 0)
  );

  kpiCostoAnualTotal = computed(() =>
    this.serviciosFiltrados()
      .filter((s) => s.estado === 'activo')
      .reduce((acc, s) => acc + (Number(s.costo_anual) || 0), 0)
  );

  kpiFacturasPendientes = computed(() =>
    this.serviciosFiltrados().reduce((acc, s) => acc + (s.facturas_pendientes_count || 0), 0)
  );

  // Suma de todo lo ya pagado (no filtra por estado, igual que facturas
  // pendientes: un servicio pausado/cancelado igual conserva su historial
  // de pagos).
  kpiTotalPagado = computed(() =>
    this.serviciosFiltrados().reduce((acc, s) => acc + (Number(s.monto_total_pagado) || 0), 0)
  );

  // Click en la tarjeta "Facturas Pendientes": filtra la tabla a solo los
  // servicios que tienen al menos una factura pendiente.
  filtroSoloPendientes = signal(false);

  verSoloPendientes(): void {
    this.filtroSoloPendientes.set(true);
  }

  // -------------------------------------------------------------------
  // PANEL SECTOR (Crear / Editar)
  // -------------------------------------------------------------------
  panelSectorAbierto = signal(false);
  sectorEdicion = signal<SectorProveedorItem | null>(null);

  sectorForm = this.fb.group({
    nombre: ['', [Validators.required]],
    descripcion: [''],
    activo: [true],
  });

  // -------------------------------------------------------------------
  // PANEL PROVEEDOR (Crear / Editar)
  // -------------------------------------------------------------------
  panelProveedorAbierto = signal(false);
  proveedorEdicion = signal<Proveedor | null>(null);

  proveedorForm = this.fb.group({
    nombre: ['', [Validators.required]],
    sector_id: ['', [Validators.required]],
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
    fecha_fin: [{ value: null as string | null, disabled: true }],
    es_indefinido: [true],
    dias_aviso_vencimiento: [{ value: null as number | null, disabled: true }],
    no_contrato: [''],
    estado: ['activo' as EstadoServicioProveedor, [Validators.required]],
    contactos: this.fb.array([]),
  });

  // "Indefinido" deshabilita y limpia fecha_fin y dias_aviso_vencimiento --
  // un contrato indefinido no tiene fecha de vencimiento ni aviso previo.
  // getRawValue() en guardarServicio() igual incluye el valor (null) de un
  // control deshabilitado.
  onToggleIndefinido(): void {
    const indefinido = !!this.servicioForm.get('es_indefinido')?.value;
    const fechaFinCtrl = this.servicioForm.get('fecha_fin');
    const diasAvisoCtrl = this.servicioForm.get('dias_aviso_vencimiento');
    if (indefinido) {
      fechaFinCtrl?.reset(null);
      fechaFinCtrl?.disable();
      diasAvisoCtrl?.reset(null);
      diasAvisoCtrl?.disable();
    } else {
      fechaFinCtrl?.enable();
      diasAvisoCtrl?.enable();
    }
  }

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
    private sectoresSrv: SectoresProveedoresService,
    private proveedoresSrv: ProveedoresService,
    private serviciosSrv: ServiciosProveedoresService,
    private datePipe: DatePipe,
    public menu: MenuService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);

    this.sectoresSrv.listar().subscribe({
      next: (secs) => {
        this.sectores.set(secs);
        this.proveedoresSrv.listar().subscribe({
          next: (provs) => {
            this.proveedores.set(provs);
            this.serviciosSrv.listar().subscribe({
              next: (servs) => {
                this.servicios.set(servs);
                this.cargando.set(false);
              },
              error: () => this.cargando.set(false),
            });
          },
          error: () => this.cargando.set(false),
        });
      },
      error: () => this.cargando.set(false),
    });
  }

  // -------------------------------------------------------------------
  // ACCIONES SECTORES
  // -------------------------------------------------------------------
  abrirNuevoSector(): void {
    this.sectorEdicion.set(null);
    this.sectorForm.reset({
      nombre: '',
      descripcion: '',
      activo: true,
    });
    this.panelSectorAbierto.set(true);
  }

  abrirEditarSector(s: SectorProveedorItem): void {
    this.sectorEdicion.set(s);
    this.sectorForm.patchValue({
      nombre: s.nombre,
      descripcion: s.descripcion || '',
      activo: s.activo,
    });
    this.panelSectorAbierto.set(true);
  }

  cerrarPanelSector(): void {
    this.panelSectorAbierto.set(false);
    this.sectorEdicion.set(null);
  }

  guardarSector(): void {
    if (this.sectorForm.invalid) return;

    const val = this.sectorForm.getRawValue() as any;
    const edicion = this.sectorEdicion();

    const req = edicion
      ? this.sectoresSrv.actualizar(edicion.id, val)
      : this.sectoresSrv.crear(val);

    req.subscribe({
      next: () => {
        this.cerrarPanelSector();
        this.cargarDatos();
      },
      error: (err) => alert(err.error?.mensaje || 'Error al guardar sector'),
    });
  }

  eliminarSector(s: SectorProveedorItem): void {
    if (s.proveedores_count && s.proveedores_count > 0) {
      alert(`No se puede eliminar el sector "${s.nombre}" porque está asignado a ${s.proveedores_count} proveedor(es).`);
      return;
    }

    if (!confirm(`¿Eliminar el sector "${s.nombre}"? Esta acción no se puede deshacer.`)) return;

    this.sectoresSrv.eliminar(s.id).subscribe({
      next: () => this.cargarDatos(),
      error: (err) => alert(err.error?.mensaje || 'Error al eliminar sector'),
    });
  }

  // -------------------------------------------------------------------
  // ACCIONES PROVEEDORES
  // -------------------------------------------------------------------
  abrirNuevoProveedor(): void {
    this.proveedorEdicion.set(null);
    const primerSectorId = this.sectores().length > 0 ? this.sectores()[0].id : '';
    this.proveedorForm.reset({
      nombre: '',
      sector_id: primerSectorId,
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
      sector_id: p.sector_id || (this.sectores().find((sec) => sec.nombre === p.sector)?.id || ''),
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
      fecha_fin: null,
      es_indefinido: true,
      dias_aviso_vencimiento: null,
      no_contrato: '',
      estado: 'activo',
    });
    this.onToggleIndefinido();
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
      fecha_fin: s.fecha_fin ? s.fecha_fin.substring(0, 10) : null,
      es_indefinido: s.es_indefinido ?? true,
      dias_aviso_vencimiento: s.dias_aviso_vencimiento ?? null,
      no_contrato: s.no_contrato || '',
      estado: s.estado,
    });
    this.onToggleIndefinido();

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
  obtenerNombreSector(secId?: string | null, secNombreLegacy?: string | null): string {
    if (secId) {
      const sec = this.sectores().find((item) => item.id === secId);
      if (sec) return sec.nombre;
    }
    return secNombreLegacy || '-';
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
