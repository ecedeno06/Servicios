import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CarritosService } from '../../core/services/carritos.service';
import { CategoriasService } from '../../core/services/categorias.service';
import { ProductosService } from '../../core/services/productos.service';
import { ProveedoresService } from '../../core/services/proveedores.service';
import { MenuService } from '../../core/services/menu.service';
import { AuthService } from '../../core/services/auth.service';
import { CarritoPdfData, CarritoPdfService } from '../../core/services/carrito-pdf.service';
import { Carrito, CarritoDetalle, Categoria, EstadoCarrito, HistoricoMovimientoCarrito, Producto, Proveedor } from '../../core/models/models';

// Orden fijo del flujo -- sin saltos ni retrocesos (ver plan). El unico
// boton de avance que se muestra es el siguiente de esta lista respecto
// al estado actual del carrito.
const ORDEN_ESTADOS: EstadoCarrito[] = ['en_construccion', 'en_revision', 'aprobada', 'cerrada'];

const ETIQUETAS_ESTADO: Record<EstadoCarrito, string> = {
  en_construccion: 'En Construccion',
  en_revision: 'En Revision',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
};

const ETIQUETAS_AVANCE: Record<EstadoCarrito, string> = {
  en_construccion: 'Enviar a Revision',
  en_revision: 'Aprobar',
  aprobada: 'Cerrar',
  cerrada: '',
};

// Clases de badge ya existentes globalmente (ver styles.css) -- no se
// inventan colores nuevos.
const CLASES_BADGE_ESTADO: Record<EstadoCarrito, string> = {
  en_construccion: 'badge-slate',
  en_revision: 'badge-amber',
  aprobada: 'badge-green',
  cerrada: 'badge-slate',
};

// Mismos tonos que CLASES_BADGE_ESTADO, pero como hex -- pdfmake no
// entiende clases CSS.
const COLOR_ESTADO_PDF: Record<EstadoCarrito, string> = {
  en_construccion: '#64748B',
  en_revision: '#D97706',
  aprobada: '#16A34A',
  cerrada: '#64748B',
};

@Component({
  selector: 'app-carritos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './carritos.component.html',
  styleUrl: './carritos.component.css',
})
export class CarritosComponent implements OnInit {
  etiquetasEstado = ETIQUETAS_ESTADO;
  clasesBadgeEstado = CLASES_BADGE_ESTADO;
  estadosFiltro = ORDEN_ESTADOS;

  carritos = signal<Carrito[]>([]);
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  proveedores = signal<Proveedor[]>([]);

  cargando = signal(false);

  // -------------------------------------------------------------
  // LISTA: filtros por columna (en el encabezado de la tabla)
  // -------------------------------------------------------------

  filtroId = signal('');
  filtroTitulo = signal('');
  filtroFechaSolicitud = signal('');
  filtroEstado = signal('');
  filtroFechaAprobacion = signal('');
  filtroCostoPropuesto = signal('');
  filtroCostoAprobado = signal('');
  filtroCreadoPor = signal('');

  hayFiltros = computed(() =>
    !!(this.filtroId() || this.filtroTitulo() || this.filtroFechaSolicitud() || this.filtroEstado() || this.filtroFechaAprobacion() ||
       this.filtroCostoPropuesto() || this.filtroCostoAprobado() || this.filtroCreadoPor())
  );

  limpiarFiltros(): void {
    this.filtroId.set('');
    this.filtroTitulo.set('');
    this.filtroFechaSolicitud.set('');
    this.filtroEstado.set('');
    this.filtroFechaAprobacion.set('');
    this.filtroCostoPropuesto.set('');
    this.filtroCostoAprobado.set('');
    this.filtroCreadoPor.set('');
  }

  idCorto(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  carritosFiltrados = computed(() => {
    const idf = this.filtroId().trim().toLowerCase();
    const t = this.filtroTitulo().trim().toLowerCase();
    const fs = this.filtroFechaSolicitud().trim().toLowerCase();
    const est = this.filtroEstado();
    const fa = this.filtroFechaAprobacion().trim().toLowerCase();
    const cop = this.filtroCostoPropuesto().trim().toLowerCase();
    const coa = this.filtroCostoAprobado().trim().toLowerCase();
    const cre = this.filtroCreadoPor().trim().toLowerCase();

    return this.carritos().filter((c) => {
      if (idf && !this.idCorto(c.id).toLowerCase().includes(idf)) return false;
      if (t && !c.titulo.toLowerCase().includes(t)) return false;
      if (fs && !(c.fecha_solicitud || '').toLowerCase().includes(fs)) return false;
      if (est && c.estado !== est) return false;
      if (fa && !(c.fecha_aprobacion || '').toLowerCase().includes(fa)) return false;
      if (cop && !String(c.costo_estimado_propuesto_total ?? 0).includes(cop)) return false;
      if (coa && !String(c.costo_estimado_aprobado_total ?? 0).includes(coa)) return false;
      if (cre && !(c.creado_por_nombre || '').toLowerCase().includes(cre)) return false;
      return true;
    });
  });

  constructor(
    private srv: CarritosService,
    private categoriasSrv: CategoriasService,
    private productosSrv: ProductosService,
    private proveedoresSrv: ProveedoresService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private auth: AuthService,
    private pdfSrv: CarritoPdfService,
    public menu: MenuService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.categoriasSrv.listar().subscribe((data) => this.categorias.set(data));
    this.productosSrv.listar().subscribe((data) => this.productos.set(data));
    this.proveedoresSrv.listar().subscribe((data) => this.proveedores.set(data));
    this.srv.listarDestinatarios().subscribe((data) => this.destinatariosDisponibles.set(data));

    // Soporta abrir un carrito puntual via ?id=... -- usado por el link
    // que se manda por correo (ver enviarPorCorreo).
    const idParam = this.route.snapshot.queryParamMap.get('id');
    if (idParam) {
      this.srv.obtener(idParam).subscribe({
        next: (c) => this.abrirCarrito(c),
        error: () => {},
      });
    }
  }

  cargar(): void {
    this.cargando.set(true);
    this.srv.listar().subscribe({
      next: (data) => { this.carritos.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  private hoyISO(): string {
    return new Date().toISOString().substring(0, 10);
  }

  // El correo ya no sale por mailto (texto plano) -- se manda de verdad
  // desde el backend (Microsoft Graph) con el mismo resumen visual del
  // PDF incrustado como HTML, a uno o varios usuarios del sistema (de
  // esta empresa) elegidos de una lista con buscador -- no texto libre.
  popupCorreoAbierto = signal(false);
  carritoCorreoActual = signal<Carrito | null>(null);
  enviandoCorreo = signal(false);
  destinatariosDisponibles = signal<{ id: string; nombre: string; email: string }[]>([]);
  destinatariosSeleccionados = signal<Set<string>>(new Set());
  busquedaDestinatarios = signal('');

  destinatariosFiltrados = computed(() => {
    const q = this.busquedaDestinatarios().trim().toLowerCase();
    if (!q) return this.destinatariosDisponibles();
    return this.destinatariosDisponibles().filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  abrirPopupCorreo(c: Carrito): void {
    this.carritoCorreoActual.set(c);
    this.destinatariosSeleccionados.set(new Set());
    this.busquedaDestinatarios.set('');
    this.popupCorreoAbierto.set(true);
  }

  cerrarPopupCorreo(): void {
    this.popupCorreoAbierto.set(false);
    this.carritoCorreoActual.set(null);
  }

  toggleDestinatario(email: string): void {
    const set = new Set(this.destinatariosSeleccionados());
    if (set.has(email)) set.delete(email);
    else set.add(email);
    this.destinatariosSeleccionados.set(set);
  }

  confirmarEnvioCorreo(): void {
    const c = this.carritoCorreoActual();
    const destinatarios = [...this.destinatariosSeleccionados()];
    if (!c || !destinatarios.length || this.enviandoCorreo()) return;
    this.enviandoCorreo.set(true);
    this.srv.enviarPorCorreo(c.id, destinatarios).subscribe({
      next: () => {
        this.enviandoCorreo.set(false);
        this.cerrarPopupCorreo();
        alert('Correo enviado correctamente.');
      },
      error: (err) => {
        this.enviandoCorreo.set(false);
        alert(err.error?.mensaje || 'No se pudo enviar el correo.');
      },
    });
  }

  eliminarCarrito(c: Carrito): void {
    if (!confirm(`¿Eliminar el carrito "${c.titulo}"? Esta accion no se puede deshacer.`)) return;
    this.srv.eliminar(c.id).subscribe({
      next: () => {
        if (this.carritoSeleccionado()?.id === c.id) this.abrirNuevo();
        this.carritos.update((arr) => arr.filter((x) => x.id !== c.id));
      },
      error: (err) => alert(err.error?.mensaje || 'Error al eliminar el carrito'),
    });
  }

  // Refresca encabezado + lineas del carrito abierto (con sus totales ya
  // recalculados por el backend) y actualiza su fila en la lista -- todo
  // en una sola llamada y sin tocar cargando()/cargandoDetalles(), para
  // que una edicion rapida (cantidad aprobada, agregar/borrar linea, etc.)
  // no haga parpadear toda la pantalla como si fuera una carga inicial.
  private refrescarCarritoActual(): void {
    const carrito = this.carritoSeleccionado();
    if (!carrito) return;
    this.srv.obtener(carrito.id).subscribe({
      next: (actualizado) => {
        this.carritoSeleccionado.set(actualizado);
        this.detalles.set(actualizado.detalles ?? []);
        this.carritos.update((arr) => arr.map((x) => (x.id === actualizado.id ? actualizado : x)));
      },
      error: () => {},
    });
  }

  // -------------------------------------------------------------
  // DETALLE DE LA SOLICITUD -- seccion inline (siempre visible debajo de
  // la lista, no un popup) que muestra el carrito elegido o el formulario
  // de uno nuevo. Mismo patron que Equipos Asignados.
  // -------------------------------------------------------------

  carritoSeleccionado = signal<Carrito | null>(null);
  detalles = signal<CarritoDetalle[]>([]);
  cargandoDetalles = signal(false);
  guardandoHeader = signal(false);
  avanzando = signal(false);

  historico = signal<HistoricoMovimientoCarrito[]>([]);
  cargandoHistorico = signal(false);

  headerForm = this.fb.group({
    titulo: ['', Validators.required],
    fecha_solicitud: [this.hoyISO(), Validators.required],
    observacion: [''],
  });

  siguienteEstado = computed<EstadoCarrito | null>(() => {
    const c = this.carritoSeleccionado();
    if (!c) return null;
    return ORDEN_ESTADOS[ORDEN_ESTADOS.indexOf(c.estado) + 1] || null;
  });

  etiquetaAvance = computed(() => {
    const c = this.carritoSeleccionado();
    return c ? ETIQUETAS_AVANCE[c.estado] : '';
  });

  // Se puede corregir un avance equivocado devolviendo el carrito al
  // estado inmediatamente anterior -- excepto la transicion final: una
  // vez "cerrada" el carrito no se puede reabrir (ver controller).
  anteriorEstado = computed<EstadoCarrito | null>(() => {
    const c = this.carritoSeleccionado();
    if (!c || c.estado === 'cerrada') return null;
    return ORDEN_ESTADOS[ORDEN_ESTADOS.indexOf(c.estado) - 1] || null;
  });

  // Mientras esta en_construccion se puede editar todo libremente (crear/
  // editar/borrar lineas, titulo, fecha). La cantidad aprobada (y su
  // observacion) se puede ir cargando/ajustando desde en_construccion y
  // hasta en_revision -- una vez "aprobada" o "cerrada" queda fija.
  puedeEditarEncabezado = computed(() => this.carritoSeleccionado()?.estado === 'en_construccion');
  puedeEditarLineas = computed(() => this.carritoSeleccionado()?.estado === 'en_construccion');
  puedeCargarAprobado = computed(() => {
    const estado = this.carritoSeleccionado()?.estado;
    return estado === 'en_construccion' || estado === 'en_revision';
  });

  totalLinea(d: CarritoDetalle): number {
    return (d.cantidad_aprobada ?? 0) * (d.costo_estimado ?? 0);
  }

  abrirNuevo(): void {
    this.carritoSeleccionado.set(null);
    this.detalles.set([]);
    this.historico.set([]);
    this.headerForm.reset({ titulo: '', fecha_solicitud: this.hoyISO(), observacion: '' });
  }

  abrirCarrito(c: Carrito): void {
    this.carritoSeleccionado.set(c);
    this.headerForm.reset({ titulo: c.titulo, fecha_solicitud: c.fecha_solicitud?.substring(0, 10), observacion: c.observacion || '' });
    this.cargarDetalles(c.id);
    this.cargarHistorico(c.id);
  }

  cargarDetalles(carritoId: string): void {
    this.cargandoDetalles.set(true);
    this.srv.listarDetalles(carritoId).subscribe({
      next: (data) => { this.detalles.set(data); this.cargandoDetalles.set(false); },
      error: () => this.cargandoDetalles.set(false),
    });
  }

  cargarHistorico(carritoId: string): void {
    this.cargandoHistorico.set(true);
    this.srv.listarHistorico(carritoId).subscribe({
      next: (data) => { this.historico.set(data); this.cargandoHistorico.set(false); },
      error: () => this.cargandoHistorico.set(false),
    });
  }

  guardarHeader(): void {
    if (this.headerForm.invalid || this.guardandoHeader()) return;
    this.guardandoHeader.set(true);
    const val = this.headerForm.getRawValue() as { titulo: string; fecha_solicitud: string; observacion: string };
    const actual = this.carritoSeleccionado();

    const esNuevo = !actual;
    const obs = actual ? this.srv.actualizar(actual.id, val) : this.srv.crear(val);
    obs.subscribe({
      next: (c) => {
        this.guardandoHeader.set(false);
        this.carritoSeleccionado.set(c);
        if (esNuevo) {
          this.carritos.update((arr) => [c, ...arr]);
          this.cargarDetalles(c.id);
          this.cargarHistorico(c.id);
        } else {
          this.carritos.update((arr) => arr.map((x) => (x.id === c.id ? c : x)));
        }
      },
      error: (err) => {
        this.guardandoHeader.set(false);
        alert(err.error?.mensaje || 'Error al guardar el carrito');
      },
    });
  }

  avanzar(): void {
    const c = this.carritoSeleccionado();
    const siguiente = this.siguienteEstado();
    if (!c || !siguiente || this.avanzando()) return;
    if (!confirm(`¿Pasar el carrito "${c.titulo}" a "${this.etiquetasEstado[siguiente]}"?`)) return;

    this.avanzando.set(true);
    this.srv.avanzarEstado(c.id, siguiente).subscribe({
      next: (actualizado) => {
        this.avanzando.set(false);
        this.carritoSeleccionado.set(actualizado);
        this.headerForm.reset({ titulo: actualizado.titulo, fecha_solicitud: actualizado.fecha_solicitud?.substring(0, 10), observacion: actualizado.observacion || '' });
        this.carritos.update((arr) => arr.map((x) => (x.id === actualizado.id ? actualizado : x)));
        this.cargarHistorico(actualizado.id);
      },
      error: (err) => {
        this.avanzando.set(false);
        alert(err.error?.mensaje || 'Error al avanzar de estado');
      },
    });
  }

  retroceder(): void {
    const c = this.carritoSeleccionado();
    const anterior = this.anteriorEstado();
    if (!c || !anterior || this.avanzando()) return;
    if (!confirm(`¿Devolver el carrito "${c.titulo}" a "${this.etiquetasEstado[anterior]}"?`)) return;

    this.avanzando.set(true);
    this.srv.retrocederEstado(c.id, anterior).subscribe({
      next: (actualizado) => {
        this.avanzando.set(false);
        this.carritoSeleccionado.set(actualizado);
        this.headerForm.reset({ titulo: actualizado.titulo, fecha_solicitud: actualizado.fecha_solicitud?.substring(0, 10), observacion: actualizado.observacion || '' });
        this.carritos.update((arr) => arr.map((x) => (x.id === actualizado.id ? actualizado : x)));
        this.cargarHistorico(actualizado.id);
      },
      error: (err) => {
        this.avanzando.set(false);
        alert(err.error?.mensaje || 'Error al devolver el estado');
      },
    });
  }

  // -------------------------------------------------------------
  // POPUP: agregar/editar una linea (equipo a comprar). Categoria ->
  // producto -> auto-completa marca/modelo, igual que Equipos Asignados.
  // -------------------------------------------------------------

  popupLineaAbierto = signal(false);
  lineaEdicion = signal<CarritoDetalle | null>(null);
  guardandoDetalle = signal(false);

  detalleForm = this.fb.group({
    categoria_id: ['', Validators.required],
    producto_id: ['', Validators.required],
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    url: ['', Validators.pattern(/^https?:\/\/.+/)],
    proveedor_id: [''],
    cantidad_propuesta: [1, [Validators.required, Validators.min(1)]],
    costo_estimado: ['', Validators.min(0)],
    observacion: [''],
  });

  private categoriaIdForm = signal<number | null>(null);

  productosDeCategoria = computed(() => {
    const catId = this.categoriaIdForm();
    return catId ? this.productos().filter((p) => p.categoria_id === catId) : [];
  });

  abrirPopupLinea(linea?: CarritoDetalle): void {
    if (linea) {
      this.lineaEdicion.set(linea);
      const catId = this.productos().find((p) => p.id === linea.producto_id)?.categoria_id ?? null;
      this.categoriaIdForm.set(catId);
      this.detalleForm.reset({
        categoria_id: catId ? String(catId) : '',
        producto_id: String(linea.producto_id),
        marca: linea.marca,
        modelo: linea.modelo,
        url: linea.url || '',
        proveedor_id: linea.proveedor_id || '',
        cantidad_propuesta: linea.cantidad_propuesta,
        costo_estimado: linea.costo_estimado != null ? String(linea.costo_estimado) : '',
        observacion: linea.observacion || '',
      });
    } else {
      this.lineaEdicion.set(null);
      this.categoriaIdForm.set(null);
      this.detalleForm.reset({
        categoria_id: '', producto_id: '', marca: '', modelo: '', url: '', proveedor_id: '', cantidad_propuesta: 1, costo_estimado: '', observacion: '',
      });
    }
    this.popupLineaAbierto.set(true);
  }

  cerrarPopupLinea(): void {
    this.popupLineaAbierto.set(false);
    this.lineaEdicion.set(null);
  }

  onCategoriaChange(): void {
    const catId = Number(this.detalleForm.get('categoria_id')?.value) || null;
    this.categoriaIdForm.set(catId);
    this.detalleForm.patchValue({ producto_id: '', marca: '', modelo: '' });
  }

  onProductoChange(): void {
    const id = Number(this.detalleForm.get('producto_id')?.value);
    const producto = this.productos().find((p) => p.id === id);
    if (!producto) return;
    const espacio = producto.nombre.indexOf(' ');
    const marca = espacio === -1 ? producto.nombre : producto.nombre.slice(0, espacio);
    const modelo = espacio === -1 ? '' : producto.nombre.slice(espacio + 1);
    this.detalleForm.patchValue({ marca, modelo });
  }

  guardarDetalle(): void {
    const carrito = this.carritoSeleccionado();
    if (!carrito || this.detalleForm.invalid || this.guardandoDetalle()) return;

    this.guardandoDetalle.set(true);
    const raw = this.detalleForm.getRawValue();
    const data = {
      producto_id: Number(raw.producto_id),
      marca: raw.marca,
      modelo: raw.modelo,
      url: raw.url || null,
      proveedor_id: raw.proveedor_id || null,
      cantidad_propuesta: Number(raw.cantidad_propuesta),
      costo_estimado: raw.costo_estimado === '' || raw.costo_estimado === null ? null : Number(raw.costo_estimado),
      observacion: raw.observacion || null,
    };

    const edicion = this.lineaEdicion();
    const obs = edicion ? this.srv.actualizarDetalle(carrito.id, edicion.id, data as any) : this.srv.crearDetalle(carrito.id, data as any);
    obs.subscribe({
      next: () => {
        this.guardandoDetalle.set(false);
        this.cerrarPopupLinea();
        this.refrescarCarritoActual();
      },
      error: (err) => {
        this.guardandoDetalle.set(false);
        alert(err.error?.mensaje || 'Error al guardar la linea');
      },
    });
  }

  guardarCantidadAprobada(d: CarritoDetalle, valor: string): void {
    const carrito = this.carritoSeleccionado();
    if (!carrito) return;
    const cantidad = valor === '' ? null : Number(valor);
    this.srv.actualizarDetalle(carrito.id, d.id, { cantidad_aprobada: cantidad } as any).subscribe({
      next: () => this.refrescarCarritoActual(),
      error: (err) => alert(err.error?.mensaje || 'Error al guardar la cantidad aprobada'),
    });
  }

  guardarObservacionDetalle(d: CarritoDetalle, valor: string): void {
    const carrito = this.carritoSeleccionado();
    if (!carrito) return;
    // La observacion no afecta ningun total -- se actualiza la linea en
    // el propio array local con la respuesta, sin recargar nada.
    this.srv.actualizarDetalle(carrito.id, d.id, { observacion: valor || null } as any).subscribe({
      next: (actualizada) => this.detalles.update((arr) => arr.map((x) => (x.id === actualizada.id ? actualizada : x))),
      error: (err) => alert(err.error?.mensaje || 'Error al guardar la observacion'),
    });
  }

  eliminarDetalle(d: CarritoDetalle): void {
    const carrito = this.carritoSeleccionado();
    if (!carrito) return;
    if (!confirm('¿Eliminar esta linea del carrito?')) return;
    this.srv.eliminarDetalle(carrito.id, d.id).subscribe({
      next: () => this.refrescarCarritoActual(),
      error: (err) => alert(err.error?.mensaje || 'Error al eliminar la linea'),
    });
  }

  abrirUrlProducto(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  // Encabezado + detalle + totales + historico de la solicitud, todo en
  // un PDF -- mismo mecanismo que el checklist de equipo (pdfmake con
  // carga diferida, ventana en blanco abierta YA dentro del click para
  // que el navegador no la bloquee mientras pdfmake carga).
  generarPdf(): void {
    const carrito = this.carritoSeleccionado();
    if (!carrito) return;

    const ventana = window.open('', '_blank') ?? undefined;

    const formatearFecha = (f?: string | null): string | null =>
      f ? this.datePipe.transform(f, 'mediumDate', 'UTC') : null;
    const formatearFechaHora = (f?: string | null): string | null =>
      f ? (this.datePipe.transform(f, 'd-MMM-y h:mm a') || '').toLowerCase() : null;

    const empresa = this.auth.empresaActiva();
    // El backend entrega el historico del mas reciente al mas antiguo --
    // el ultimo movimiento (indice 0) identifica "quien" hizo el estado
    // actual; para el PDF se muestra en orden cronologico (invertido).
    const ultimoMovimiento = this.historico()[0];
    const movimientosCronologicos = [...this.historico()].reverse();

    const data: CarritoPdfData = {
      empresaNombre: empresa?.empresa_nombre ?? '',
      empresaLogo: empresa?.empresa_logo ?? null,
      idCorto: this.idCorto(carrito.id),
      titulo: carrito.titulo,
      estado: this.etiquetasEstado[carrito.estado],
      estadoColor: COLOR_ESTADO_PDF[carrito.estado],
      fechaSolicitud: formatearFecha(carrito.fecha_solicitud) || '-',
      fechaAprobacion: formatearFecha(carrito.fecha_aprobacion),
      creadoPor: carrito.creado_por_nombre,
      observacion: carrito.observacion,
      actorUltimoEstado: ultimoMovimiento?.registrado_por_nombre || carrito.creado_por_nombre || null,
      fechaUltimoEstado: formatearFechaHora(ultimoMovimiento?.fecha_cambio) ?? formatearFechaHora(carrito.created_at),
      lineas: this.detalles().map((d) => ({
        equipo: `${d.marca} ${d.modelo}`,
        categoria: d.categoria_nombre,
        proveedor: d.proveedor_nombre,
        cantidadPropuesta: d.cantidad_propuesta,
        cantidadAprobada: d.cantidad_aprobada,
        costoEstimado: d.costo_estimado,
        totalLinea: this.totalLinea(d),
        observacion: d.observacion,
      })),
      totalPropuesto: carrito.costo_estimado_propuesto_total ?? 0,
      totalAprobado: carrito.costo_estimado_aprobado_total ?? 0,
      movimientos: movimientosCronologicos.map((h) => ({
        estadoAnterior: h.estado_anterior ? this.etiquetasEstado[h.estado_anterior] : null,
        estadoNuevo: this.etiquetasEstado[h.estado_nuevo],
        registradoPor: h.registrado_por_nombre,
        fecha: formatearFechaHora(h.fecha_cambio) || '',
      })),
      fechaGeneracion: formatearFechaHora(new Date().toISOString()) || '',
      generadoPor: this.auth.usuario()?.nombre,
    };

    this.pdfSrv.generar(data)
      .then((doc) => doc.open(undefined, ventana))
      .catch(() => alert('No se pudo generar el PDF de la solicitud.'));
  }
}
