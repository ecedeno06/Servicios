import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedoresService } from '../../core/services/proveedores.service';
import { ServiciosProveedoresService } from '../../core/services/servicios-proveedores.service';
import { SectoresProveedoresService } from '../../core/services/sectores-proveedores.service';
import { MenuService } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ContactoProveedor,
  EstadoFacturaServicio,
  EstadoServicioProveedor,
  FacturaServicioProveedor,
  FormaPagoFactura,
  ImagenServicioProveedor,
  Proveedor,
  SectorProveedorItem,
  ServicioProveedor
} from '../../core/models/models';
import { MultiSelectFilterComponent } from '../../core/components/multi-select-filter/multi-select-filter.component';
import { leerArchivoComoBase64 } from '../../core/utils/imagen.util';

const ESTADOS_SERVICIO: { valor: EstadoServicioProveedor; etiqueta: string }[] = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'en pausa', etiqueta: 'En Pausa' },
  { valor: 'no renovar', etiqueta: 'No Renovar' },
  { valor: 'vencido', etiqueta: 'Vencido' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
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

// Codigo de pais del telefono, separado del numero -- sin esto, el
// enlace de WhatsApp (wa.me) sale incompleto si el usuario olvida
// escribirlo a mano dentro del campo de telefono.
const CODIGOS_PAIS: { codigo: string; nombre: string }[] = [
  { codigo: '+54', nombre: 'Argentina (+54)' },
  { codigo: '+591', nombre: 'Bolivia (+591)' },
  { codigo: '+55', nombre: 'Brasil (+55)' },
  { codigo: '+56', nombre: 'Chile (+56)' },
  { codigo: '+57', nombre: 'Colombia (+57)' },
  { codigo: '+506', nombre: 'Costa Rica (+506)' },
  { codigo: '+53', nombre: 'Cuba (+53)' },
  { codigo: '+593', nombre: 'Ecuador (+593)' },
  { codigo: '+503', nombre: 'El Salvador (+503)' },
  { codigo: '+34', nombre: 'España (+34)' },
  { codigo: '+1', nombre: 'Estados Unidos / Canada (+1)' },
  { codigo: '+502', nombre: 'Guatemala (+502)' },
  { codigo: '+504', nombre: 'Honduras (+504)' },
  { codigo: '+52', nombre: 'Mexico (+52)' },
  { codigo: '+505', nombre: 'Nicaragua (+505)' },
  { codigo: '+507', nombre: 'Panama (+507)' },
  { codigo: '+595', nombre: 'Paraguay (+595)' },
  { codigo: '+51', nombre: 'Peru (+51)' },
  { codigo: '+1', nombre: 'Republica Dominicana (+1)' },
  { codigo: '+598', nombre: 'Uruguay (+598)' },
  { codigo: '+58', nombre: 'Venezuela (+58)' },
];

@Component({
  selector: 'app-servicios-proveedores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MultiSelectFilterComponent],
  providers: [CurrencyPipe, DatePipe],
  templateUrl: './servicios-proveedores.component.html',
  styleUrl: './servicios-proveedores.component.css',
})
export class ServiciosProveedoresComponent implements OnInit {
  pestanaActiva = signal<'servicios' | 'proveedores' | 'sectores'>('servicios');

  estadosServicio = ESTADOS_SERVICIO;
  estadosFactura = ESTADOS_FACTURA;
  formasPago = FORMAS_PAGO;
  codigosPais = CODIGOS_PAIS;

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

  ordenColumnaSec = signal<string | null>(null);
  ordenDireccionSec = signal<'asc' | 'desc'>('asc');

  ordenarPorSec(columna: string): void {
    if (this.ordenColumnaSec() === columna) {
      this.ordenDireccionSec.set(this.ordenDireccionSec() === 'asc' ? 'desc' : 'asc');
    } else {
      this.ordenColumnaSec.set(columna);
      this.ordenDireccionSec.set('asc');
    }
  }

  iconoOrdenSec(columna: string): string {
    if (this.ordenColumnaSec() !== columna) return '';
    return this.ordenDireccionSec() === 'asc' ? '▲' : '▼';
  }

  private valorOrdenSec(s: SectorProveedorItem, columna: string): string | number {
    switch (columna) {
      case 'nombre': return s.nombre.toLowerCase();
      case 'estado': return s.activo ? 'activo' : 'inactivo';
      case 'proveedores': return s.proveedores_count ?? 0;
      default: return '';
    }
  }

  sectoresOrdenados = computed(() => {
    const columna = this.ordenColumnaSec();
    const filtrados = this.sectoresFiltrados();
    if (!columna) return filtrados;
    const signo = this.ordenDireccionSec() === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = this.valorOrdenSec(a, columna);
      const vb = this.valorOrdenSec(b, columna);
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return 0;
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

  ordenColumnaProv = signal<string | null>(null);
  ordenDireccionProv = signal<'asc' | 'desc'>('asc');

  ordenarPorProv(columna: string): void {
    if (this.ordenColumnaProv() === columna) {
      this.ordenDireccionProv.set(this.ordenDireccionProv() === 'asc' ? 'desc' : 'asc');
    } else {
      this.ordenColumnaProv.set(columna);
      this.ordenDireccionProv.set('asc');
    }
  }

  iconoOrdenProv(columna: string): string {
    if (this.ordenColumnaProv() !== columna) return '';
    return this.ordenDireccionProv() === 'asc' ? '▲' : '▼';
  }

  private valorOrdenProv(p: Proveedor, columna: string): string | number {
    switch (columna) {
      case 'nombre': return p.nombre.toLowerCase();
      case 'sector': return this.obtenerNombreSector(p.sector_id, p.sector_nombre || p.sector).toLowerCase();
      case 'contacto': return (p.contacto ?? '').toLowerCase();
      case 'correo': return (p.correo ?? '').toLowerCase();
      case 'telefono': return (p.telefono ?? '').toLowerCase();
      case 'servicios': return p.servicios_count ?? 0;
      default: return '';
    }
  }

  proveedoresOrdenados = computed(() => {
    const columna = this.ordenColumnaProv();
    const filtrados = this.proveedoresFiltrados();
    if (!columna) return filtrados;
    const signo = this.ordenDireccionProv() === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = this.valorOrdenProv(a, columna);
      const vb = this.valorOrdenProv(b, columna);
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return 0;
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
      this.textoAvisoVencimiento(s), s.estado, s.facturas_count, s.observacion, s.responsable,
    ];
    return campos.some((c) => c != null && String(c).toLowerCase().includes(texto));
  }

  // Columna "Observacion": texto expandible -- colapsado por defecto
  // (una linea, con puntos suspensivos), se expande al hacer click.
  private observacionesExpandidas = signal<Set<string>>(new Set());

  estaObservacionExpandida(id: string): boolean {
    return this.observacionesExpandidas().has(id);
  }

  toggleObservacion(id: string): void {
    const set = new Set(this.observacionesExpandidas());
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.observacionesExpandidas.set(set);
  }

  // Filtros Servicios -- seleccion multiple estilo Excel (Set vacio = sin
  // filtro / "Todos") en las columnas visibles de la tabla. Contrato,
  // Facturas y Observacion quedan como texto libre: sus columnas estan
  // ocultas (ver thead) y ya no tienen control en pantalla.
  filtroServNombre = signal<Set<string>>(new Set());
  filtroServProveedor = signal<Set<string>>(new Set());
  filtroServSector = signal<Set<string>>(new Set());
  filtroServContrato = signal('');
  filtroServCostoMensual = signal<Set<string>>(new Set());
  filtroServCostoAnual = signal<Set<string>>(new Set());
  filtroServPagado = signal<Set<string>>(new Set());
  filtroServFechaFin = signal<Set<string>>(new Set());
  filtroServAviso = signal<Set<string>>(new Set());
  filtroServEstado = signal<Set<string>>(new Set());
  filtroServFacturas = signal('');
  filtroServObservacion = signal('');
  filtroServResponsable = signal<Set<string>>(new Set());

  private valoresUnicosServ(valores: (string | null | undefined)[]): string[] {
    const set = new Set(valores.filter((v): v is string => !!v));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  valoresServNombre = computed(() => this.valoresUnicosServ(this.servicios().map((s) => s.servicio)));
  valoresServProveedor = computed(() => this.valoresUnicosServ(this.servicios().map((s) => s.proveedor_nombre)));
  valoresServSector = computed(() => this.valoresUnicosServ(this.servicios().map((s) => this.obtenerNombreSector(s.proveedor_sector_id, s.proveedor_sector))));
  valoresServFechaFin = computed(() => this.valoresUnicosServ(this.servicios().map((s) => this.textoFechaFin(s))));
  valoresServAviso = computed(() => this.valoresUnicosServ(this.servicios().map((s) => this.textoAvisoVencimiento(s))));
  valoresServCostoMensual = computed(() =>
    this.valoresUnicosServ(this.servicios().map((s) => String(s.costo_mensual))).sort((a, b) => Number(a) - Number(b))
  );
  valoresServCostoAnual = computed(() =>
    this.valoresUnicosServ(this.servicios().map((s) => String(s.costo_anual))).sort((a, b) => Number(a) - Number(b))
  );
  valoresServPagado = computed(() =>
    this.valoresUnicosServ(this.servicios().map((s) => String(s.monto_total_pagado ?? 0))).sort((a, b) => Number(a) - Number(b))
  );
  valoresServEstado = computed(() => this.valoresUnicosServ(this.servicios().map((s) => s.estado)));
  valoresServResponsable = computed(() => this.valoresUnicosServ(this.servicios().map((s) => s.responsable)));

  formatoMonedaServ = (v: string): string => {
    const n = Number(v);
    return isNaN(n) ? v : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  formatoEstadoServ = (v: string): string => ESTADOS_SERVICIO.find((e) => e.valor === v)?.etiqueta ?? v;

  hayFiltrosServ = computed(() => !!(
    this.busquedaGeneralServ() ||
    this.filtroServNombre().size || this.filtroServProveedor().size || this.filtroServSector().size || this.filtroServContrato() ||
    this.filtroServCostoMensual().size || this.filtroServCostoAnual().size || this.filtroServPagado().size || this.filtroServFechaFin().size ||
    this.filtroServAviso().size || this.filtroServEstado().size || this.filtroServFacturas() || this.filtroServObservacion() ||
    this.filtroServResponsable().size || this.filtroSoloPendientes()
  ));

  limpiarFiltrosServ(): void {
    this.busquedaGeneralServInput.set('');
    this.busquedaGeneralServ.set('');
    this.filtroServNombre.set(new Set());
    this.filtroServProveedor.set(new Set());
    this.filtroServSector.set(new Set());
    this.filtroServContrato.set('');
    this.filtroServCostoMensual.set(new Set());
    this.filtroServCostoAnual.set(new Set());
    this.filtroServPagado.set(new Set());
    this.filtroServFechaFin.set(new Set());
    this.filtroServAviso.set(new Set());
    this.filtroServEstado.set(new Set());
    this.filtroServFacturas.set('');
    this.filtroServObservacion.set('');
    this.filtroServResponsable.set(new Set());
    this.filtroSoloPendientes.set(false);
  }

  serviciosFiltrados = computed(() => {
    const fGeneral = this.busquedaGeneralServ().trim().toLowerCase();
    const nom = this.filtroServNombre();
    const prov = this.filtroServProveedor();
    const sec = this.filtroServSector();
    const ctr = this.filtroServContrato().trim().toLowerCase();
    const costoM = this.filtroServCostoMensual();
    const costoA = this.filtroServCostoAnual();
    const pagado = this.filtroServPagado();
    const fechaFin = this.filtroServFechaFin();
    const aviso = this.filtroServAviso();
    const est = this.filtroServEstado();
    const fact = this.filtroServFacturas().trim().toLowerCase();
    const obs = this.filtroServObservacion().trim().toLowerCase();
    const resp = this.filtroServResponsable();

    return this.servicios().filter((s) => {
      if (fGeneral && !this.coincideBusquedaGeneralServicio(s, fGeneral)) return false;
      if (nom.size && !nom.has(s.servicio)) return false;
      if (prov.size && !prov.has(s.proveedor_nombre ?? '')) return false;
      if (sec.size && !sec.has(this.obtenerNombreSector(s.proveedor_sector_id, s.proveedor_sector))) return false;
      if (ctr && !(s.no_contrato || '').toLowerCase().includes(ctr)) return false;
      if (costoM.size && !costoM.has(String(s.costo_mensual))) return false;
      if (costoA.size && !costoA.has(String(s.costo_anual))) return false;
      if (pagado.size && !pagado.has(String(s.monto_total_pagado ?? 0))) return false;
      if (fechaFin.size && !fechaFin.has(this.textoFechaFin(s))) return false;
      if (aviso.size && !aviso.has(this.textoAvisoVencimiento(s))) return false;
      if (obs && !(s.observacion || '').toLowerCase().includes(obs)) return false;
      if (est.size && !est.has(s.estado)) return false;
      if (fact && !String(s.facturas_count ?? 0).toLowerCase().includes(fact)) return false;
      if (resp.size && !resp.has(s.responsable ?? '')) return false;
      if (this.filtroSoloPendientes() && !(s.facturas_pendientes_count && s.facturas_pendientes_count > 0)) return false;
      return true;
    });
  });

  // Orden por columna (click en el encabezado alterna asc/desc).
  ordenColumnaServ = signal<string | null>(null);
  ordenDireccionServ = signal<'asc' | 'desc'>('asc');

  ordenarPorServ(columna: string): void {
    if (this.ordenColumnaServ() === columna) {
      this.ordenDireccionServ.set(this.ordenDireccionServ() === 'asc' ? 'desc' : 'asc');
    } else {
      this.ordenColumnaServ.set(columna);
      this.ordenDireccionServ.set('asc');
    }
  }

  iconoOrdenServ(columna: string): string {
    if (this.ordenColumnaServ() !== columna) return '';
    return this.ordenDireccionServ() === 'asc' ? '▲' : '▼';
  }

  private valorOrdenServ(s: ServicioProveedor, columna: string): string | number {
    switch (columna) {
      case 'servicio': return s.servicio.toLowerCase();
      case 'proveedor': return (s.proveedor_nombre ?? '').toLowerCase();
      case 'sector': return this.obtenerNombreSector(s.proveedor_sector_id, s.proveedor_sector).toLowerCase();
      case 'fechaFin': return s.es_indefinido || !s.fecha_fin ? Number.POSITIVE_INFINITY : new Date(s.fecha_fin).getTime();
      case 'aviso': return this.diasRestantes(s) ?? Number.POSITIVE_INFINITY;
      case 'costoMensual': return Number(s.costo_mensual) || 0;
      case 'costoAnual': return Number(s.costo_anual) || 0;
      case 'pagado': return Number(s.monto_total_pagado) || 0;
      case 'estado': return s.estado.toLowerCase();
      case 'facturas': return s.facturas_count ?? 0;
      case 'observacion': return (s.observacion ?? '').toLowerCase();
      case 'responsable': return (s.responsable ?? '').toLowerCase();
      default: return '';
    }
  }

  serviciosOrdenados = computed(() => {
    const columna = this.ordenColumnaServ();
    const filtrados = this.serviciosFiltrados();
    if (!columna) return filtrados;
    const signo = this.ordenDireccionServ() === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = this.valorOrdenServ(a, columna);
      const vb = this.valorOrdenServ(b, columna);
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return 0;
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

  // Compara el monto de la ultima factura pagada del servicio contra el de
  // la anterior -- '' si no hay al menos dos pagos para comparar, o si el
  // monto no cambio (redondeado a centavos).
  indicadorPagado(s: ServicioProveedor): 'up' | 'down' | '' {
    if (s.ultimo_pago_monto == null || s.penultimo_pago_monto == null) return '';
    const ultimo = Math.round(Number(s.ultimo_pago_monto) * 100) / 100;
    const anterior = Math.round(Number(s.penultimo_pago_monto) * 100) / 100;
    if (ultimo > anterior) return 'up';
    if (ultimo < anterior) return 'down';
    return '';
  }

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
    telefono_codigo_pais: ['+507'],
    acepta_whatsapp: [false],
    url: [''],
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
    observacion: [''],
    url: [''],
    responsable: [''],
    contactos: this.fb.array([]),
    imagenes: this.fb.array([]),
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
  // IMAGENES Y DOCUMENTOS (adjuntos del servicio, PDF/PNG/JPG en base64)
  // -------------------------------------------------------------------
  get imagenesArray(): FormArray {
    return this.servicioForm.get('imagenes') as FormArray;
  }

  private crearImagenGroup(img: ImagenServicioProveedor): FormGroup {
    return this.fb.group({
      fecha: [img.fecha],
      descripcion: [img.descripcion || ''],
      imagen_base64: [img.imagen_base64, Validators.required],
      creado_por: [img.creado_por],
    });
  }

  agregarImagenEntry(img: ImagenServicioProveedor): void {
    this.imagenesArray.push(this.crearImagenGroup(img));
  }

  eliminarImagen(index: number): void {
    this.imagenesArray.removeAt(index);
  }

  // Angular sanitiza por defecto cualquier [href]/[src] cuyo esquema no
  // reconozca (http/https/mailto/tel/ftp/file/sms) -- un data: URI queda
  // reescrito a "unsafe:data:..." y el link no navega a ningun lado (el
  // click no hace nada). bypassSecurityTrustUrl() es seguro aca porque el
  // contenido es el propio adjunto base64 que ya validamos al subirlo, no
  // una URL arbitraria ingresada por el usuario.
  urlSegura(base64: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(base64);
  }

  private readonly TIPOS_ARCHIVO_PERMITIDOS = ['image/png', 'image/jpeg', 'application/pdf'];
  private readonly MAX_ARCHIVO_BYTES = 5 * 1024 * 1024; // 5MB, antes de inflarse a base64
  private readonly MAX_IMAGENES = 20;
  errorArchivoImagen = signal<string | null>(null);

  // El archivo se guarda tal cual lo sube el usuario (base64 sin recomprimir
  // ni redimensionar) -- pedido explicito, distinto del avatar/logo que si
  // pasan por redimensionarImagen().
  onSeleccionArchivoImagen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (archivo) this.procesarArchivoImagen(archivo);
    input.value = '';
  }

  // Mismo patron de "pegar" que el selector de foto de perfil
  // (selector-foto.component.ts, onPasteFoto) -- Ctrl+V sobre el recuadro
  // de pegado, pero sin pasar por redimensionarImagen() (pedido explicito
  // de guardar el archivo tal cual).
  onPasteImagen(event: ClipboardEvent): void {
    this.errorArchivoImagen.set(null);
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const archivo = items[i].getAsFile();
        if (archivo) this.procesarArchivoImagen(archivo);
        return;
      }
    }
    this.errorArchivoImagen.set('No se encontró ninguna imagen en el portapapeles.');
  }

  private procesarArchivoImagen(archivo: File): void {
    this.errorArchivoImagen.set(null);
    if (!this.TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) {
      this.errorArchivoImagen.set('Solo se permiten archivos PDF, PNG o JPG.');
    } else if (archivo.size > this.MAX_ARCHIVO_BYTES) {
      this.errorArchivoImagen.set('El archivo supera el tamaño máximo permitido (5MB).');
    } else if (this.imagenesArray.length >= this.MAX_IMAGENES) {
      this.errorArchivoImagen.set(`Se alcanzó el máximo de ${this.MAX_IMAGENES} archivos adjuntos.`);
    } else {
      leerArchivoComoBase64(archivo).then((base64) => {
        this.agregarImagenEntry({
          fecha: new Date().toISOString(),
          descripcion: '',
          imagen_base64: base64,
          creado_por: this.auth.usuario()?.nombre || '',
        });
      }).catch(() => this.errorArchivoImagen.set('No se pudo leer el archivo.'));
    }
  }

  // -------------------------------------------------------------------
  // PANEL FACTURAS Y TRANSACCIONES (DRAWER)
  // -------------------------------------------------------------------
  panelFacturasAbierto = signal(false);
  servicioSeleccionado = signal<ServicioProveedor | null>(null);
  facturas = signal<FacturaServicioProveedor[]>([]);
  cargandoFacturas = signal(false);
  guardandoFactura = signal(false);

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
    private auth: AuthService,
    public menu: MenuService,
    private sanitizer: DomSanitizer
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
      telefono_codigo_pais: '+507',
      acepta_whatsapp: false,
      url: '',
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
      telefono_codigo_pais: p.telefono_codigo_pais || '+507',
      acepta_whatsapp: p.acepta_whatsapp,
      url: p.url || '',
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

  // codigoPais (ej. "+507") se antepone al numero local -- sin esto el
  // enlace de WhatsApp sale incompleto si el telefono no trae el codigo
  // de pais ya incluido.
  enlaceWhatsApp(telefono?: string | null, codigoPais?: string | null): string {
    if (!telefono) return '#';
    const num = telefono.replace(/\D/g, '');
    const cod = (codigoPais || '').replace(/\D/g, '');
    return `https://wa.me/${cod}${num}`;
  }

  // -------------------------------------------------------------------
  // CONTACTOS DEL SERVICIO: tooltip al pasar el mouse + acciones rapidas
  // de correo/WhatsApp hacia esos contactos (no el telefono del
  // proveedor -- este es el listado de contactos propios del servicio).
  // -------------------------------------------------------------------
  tooltipContactos(s: ServicioProveedor): string {
    const contactos = s.contactos || [];
    if (!contactos.length) return 'Sin contactos registrados para este servicio';
    return contactos
      .map((c) => {
        const partes = [c.nombre || '(sin nombre)'];
        if (c.cargo) partes.push(c.cargo);
        if (c.telefono) partes.push(`Tel: ${c.telefono_codigo_pais || ''} ${c.telefono}`.trim());
        if (c.email) partes.push(`Correo: ${c.email}`);
        return partes.join(' • ');
      })
      .join('\n');
  }

  private contactosConEmail(s: ServicioProveedor): ContactoProveedor[] {
    return (s.contactos || []).filter((c) => !!c.email);
  }

  private contactosConTelefono(s: ServicioProveedor): ContactoProveedor[] {
    return (s.contactos || []).filter((c) => !!c.telefono);
  }

  tieneContactoEmail(s: ServicioProveedor): boolean {
    return this.contactosConEmail(s).length > 0;
  }

  tieneContactoTelefono(s: ServicioProveedor): boolean {
    return this.contactosConTelefono(s).length > 0;
  }

  // -------------------------------------------------------------------
  // MODAL: ver la Observacion de un servicio (icono junto a Responsable).
  // -------------------------------------------------------------------
  modalObservacionAbierta = signal(false);
  servicioObservacionActual = signal<ServicioProveedor | null>(null);

  abrirModalObservacion(s: ServicioProveedor): void {
    this.servicioObservacionActual.set(s);
    this.modalObservacionAbierta.set(true);
  }

  cerrarModalObservacion(): void {
    this.modalObservacionAbierta.set(false);
    this.servicioObservacionActual.set(null);
  }

  // Parte la Observacion en lineas para poder ofrecer un boton de copiar
  // junto a las que son un link completo (ej. el link de VaultWarden/tarjeta).
  lineasObservacionModal = computed(() => {
    const obs = this.servicioObservacionActual()?.observacion;
    if (!obs) return [];
    return obs.split('\n').map((linea) => ({
      texto: linea,
      esUrl: /^https?:\/\//i.test(linea.trim()),
    }));
  });

  textoCopiado = signal<string | null>(null);

  copiarTexto(texto: string): void {
    navigator.clipboard?.writeText(texto.trim()).then(() => {
      this.textoCopiado.set(texto);
      setTimeout(() => {
        if (this.textoCopiado() === texto) this.textoCopiado.set(null);
      }, 1500);
    }).catch(() => {});
  }

  // -------------------------------------------------------------------
  // MODAL: seleccionar a cuales contactos del servicio enviarles correo
  // (antes se mandaba a todos de una, sin poder elegir).
  // -------------------------------------------------------------------
  modalEmailAbierto = signal(false);
  servicioEmailActual = signal<ServicioProveedor | null>(null);
  contactosEmailSeleccionados = signal<Set<string>>(new Set());

  contactosEmailModal = computed(() => {
    const s = this.servicioEmailActual();
    return s ? this.contactosConEmail(s) : [];
  });

  abrirModalEmail(s: ServicioProveedor): void {
    this.servicioEmailActual.set(s);
    // Todos marcados por defecto (mismo comportamiento de antes), el
    // usuario desmarca los que no quiere incluir.
    this.contactosEmailSeleccionados.set(new Set(this.contactosConEmail(s).map((c) => c.email!)));
    this.modalEmailAbierto.set(true);
  }

  cerrarModalEmail(): void {
    this.modalEmailAbierto.set(false);
    this.servicioEmailActual.set(null);
  }

  toggleContactoEmail(email: string): void {
    const set = new Set(this.contactosEmailSeleccionados());
    if (set.has(email)) set.delete(email);
    else set.add(email);
    this.contactosEmailSeleccionados.set(set);
  }

  // Muestra un check por un momento en el boton de copiar, para confirmar
  // la accion sin interrumpir con un alert.
  correoCopiado = signal<string | null>(null);

  copiarCorreo(email: string): void {
    navigator.clipboard?.writeText(email).then(() => {
      this.correoCopiado.set(email);
      setTimeout(() => {
        if (this.correoCopiado() === email) this.correoCopiado.set(null);
      }, 1500);
    }).catch(() => {});
  }

  // "EMPRESA - Servicio - No.Contrato" (cualquiera de las 3 partes se
  // omite si no esta disponible) -- para que el contacto del proveedor
  // identifique de inmediato de que empresa y contrato viene el correo.
  private construirAsuntoCorreo(s: ServicioProveedor): string {
    const empresa = this.auth.empresaActiva()?.empresa_nombre;
    const contrato = s.no_contrato ? `Contrato No.: ${s.no_contrato}` : null;
    const partes = [empresa?.toUpperCase(), s.servicio, contrato].filter((p): p is string => !!p);
    return partes.join(' - ');
  }

  // mailto solo admite abrir el cliente de correo local.
  enviarCorreoSeleccionados(): void {
    const s = this.servicioEmailActual();
    const correos = Array.from(this.contactosEmailSeleccionados());
    if (!s || !correos.length) return;

    const asunto = this.construirAsuntoCorreo(s);
    window.location.href = `mailto:${correos.join(',')}?subject=${encodeURIComponent(asunto)}`;
    this.cerrarModalEmail();
  }

  // wa.me solo admite un numero por enlace -- se usa el primer contacto
  // que tenga telefono registrado.
  enlaceWhatsAppServicio(s: ServicioProveedor): string {
    const contacto = this.contactosConTelefono(s)[0];
    return this.enlaceWhatsApp(contacto?.telefono, contacto?.telefono_codigo_pais);
  }

  // -------------------------------------------------------------------
  // ACCIONES SERVICIOS
  // -------------------------------------------------------------------
  abrirNuevoServicio(): void {
    this.servicioEdicion.set(null);
    this.contactosArray.clear();
    this.imagenesArray.clear();
    this.errorArchivoImagen.set(null);
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
      observacion: '',
      url: '',
      // Sugerido, no forzado: suele ser quien esta creando el servicio, pero
      // queda editable (y vacio al editar uno existente, ver abajo).
      responsable: this.auth.usuario()?.nombre || '',
    });
    this.onToggleIndefinido();
    this.panelServicioAbierto.set(true);
  }

  abrirEditarServicio(s: ServicioProveedor): void {
    this.servicioEdicion.set(s);
    this.contactosArray.clear();
    this.imagenesArray.clear();
    this.errorArchivoImagen.set(null);

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
      observacion: s.observacion || '',
      url: s.url || '',
      responsable: s.responsable || '',
    });
    this.onToggleIndefinido();

    if (Array.isArray(s.contactos)) {
      s.contactos.forEach((c) => this.agregarContacto(c));
    }
    if (Array.isArray(s.imagenes)) {
      s.imagenes.forEach((img) => this.agregarImagenEntry(img));
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
      telefono_codigo_pais: [c?.telefono_codigo_pais || '+507'],
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
    this.guardandoFactura.set(false);
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
    // guardandoFactura evita que un doble clic o un Enter repetido mientras
    // la peticion anterior sigue en vuelo registre la misma factura dos veces.
    if (this.facturaForm.invalid || this.guardandoFactura()) return;

    const servicio = this.servicioSeleccionado();
    if (!servicio) return;

    const val = this.facturaForm.getRawValue() as any;

    this.guardandoFactura.set(true);
    this.serviciosSrv.crearFactura(servicio.id, val).subscribe({
      next: () => {
        this.guardandoFactura.set(false);
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
      error: (err) => {
        this.guardandoFactura.set(false);
        alert(err.error?.mensaje || 'Error al registrar factura');
      },
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
      case 'no renovar': return 'badge-red-solid';
      case 'vencido': return 'badge-red';
      case 'cancelado': return 'badge-red';
      case 'inactivo': return 'badge-slate';
      default: return 'badge-slate';
    }
  }

  // Un servicio con fecha de fin (no indefinido) tiene un costo anual
  // estimado -- si ya se pago mas que eso, es una senal de que el contrato
  // esta costando mas de lo presupuestado.
  pagadoExcedeCostoAnual(s: ServicioProveedor): boolean {
    if (s.es_indefinido) return false;
    return Number(s.monto_total_pagado || 0) > Number(s.costo_anual || 0);
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
