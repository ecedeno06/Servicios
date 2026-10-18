import { Component, ElementRef, OnInit, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EquiposAsignadosService } from '../../core/services/equipos-asignados.service';
import { CategoriasService } from '../../core/services/categorias.service';
import { ProductosService } from '../../core/services/productos.service';
import { ProcesadoresService } from '../../core/services/procesadores.service';
import { ProveedoresService } from '../../core/services/proveedores.service';
import { ChecklistsService } from '../../core/services/checklists.service';
import { ChecklistEquipoPdfService, ChecklistPdfData } from '../../core/services/checklist-equipo-pdf.service';
import { AuthService } from '../../core/services/auth.service';
import { Categoria, ChecklistItem, EquipoAsignado, EquipoChecklistEjecucion, EquipoChecklistEjecucionDetalle, EquipoChecklistItem, EstadoEquipo, ImagenServicioProveedor, MovimientoEquipo, Procesador, Producto, Proveedor } from '../../core/models/models';
import { MultiSelectFilterComponent } from '../../core/components/multi-select-filter/multi-select-filter.component';
import { leerArchivoComoBase64 } from '../../core/utils/imagen.util';

const ESTADOS: { valor: EstadoEquipo; etiqueta: string }[] = [
  { valor: 'en_uso', etiqueta: 'En uso' },
  { valor: 'stock', etiqueta: 'Stock' },
  { valor: 'reparacion', etiqueta: 'Reparacion' },
  { valor: 'dano', etiqueta: 'Danado' },
  { valor: 'descarte', etiqueta: 'Descarte' },
  { valor: 'vendida', etiqueta: 'Vendida' },
];

@Component({
  selector: 'app-equipos-asignados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MultiSelectFilterComponent],
  providers: [DatePipe],
  templateUrl: './equipos-asignados.component.html',
  styleUrl: './equipos-asignados.component.css',
})
export class EquiposAsignadosComponent implements OnInit {
  estados = ESTADOS;

  equipos = signal<EquipoAsignado[]>([]);
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  procesadores = signal<Procesador[]>([]);
  proveedores = signal<Proveedor[]>([]);

  seleccionado = signal<EquipoAsignado | null>(null);
  historial = signal<MovimientoEquipo[]>([]);
  filtroHistorial = signal('');

  historialFiltrado = computed(() => {
    const f = this.filtroHistorial().trim().toLowerCase();
    if (!f) return this.historial();
    return this.historial().filter((m) =>
      this.etiquetaEstado(m.estado_nuevo).toLowerCase().includes(f) ||
      (m.estado_anterior && this.etiquetaEstado(m.estado_anterior).toLowerCase().includes(f)) ||
      (m.asignada_a ?? '').toLowerCase().includes(f) ||
      (m.asignada_a_anterior ?? '').toLowerCase().includes(f) ||
      (m.observacion ?? '').toLowerCase().includes(f) ||
      m.registrado_por_nombre.toLowerCase().includes(f)
    );
  });

  // Popup de Observacion + Historico de movimientos, abierto desde el
  // icono junto a Categoria -- usa senales propias (no "historial"/
  // "seleccionado") para no pisar el historico que ya se muestra debajo
  // del formulario cuando hay un equipo distinto abierto para editar.
  equipoInfoActual = signal<EquipoAsignado | null>(null);
  historialInfoEquipo = signal<MovimientoEquipo[]>([]);
  cargandoHistorialInfo = signal(false);
  adjuntosInfoEquipo = signal<ImagenServicioProveedor[]>([]);
  cargandoAdjuntosInfo = signal(false);

  abrirModalInfoEquipo(event: MouseEvent, e: EquipoAsignado): void {
    event.stopPropagation();
    this.equipoInfoActual.set(e);
    this.cargandoHistorialInfo.set(true);
    this.srv.historial(e.id).subscribe({
      next: (data) => {
        this.historialInfoEquipo.set(data);
        this.cargandoHistorialInfo.set(false);
      },
      error: () => this.cargandoHistorialInfo.set(false),
    });
    this.cargandoAdjuntosInfo.set(true);
    this.srv.listarAdjuntos(e.id).subscribe({
      next: (data) => {
        this.adjuntosInfoEquipo.set(data);
        this.cargandoAdjuntosInfo.set(false);
      },
      error: () => this.cargandoAdjuntosInfo.set(false),
    });
  }

  cerrarModalInfoEquipo(): void {
    this.equipoInfoActual.set(null);
    this.adjuntosInfoEquipo.set([]);
    this.historialInfoEquipo.set([]);
  }

  // Menu desplegable de acciones rapidas por fila (boton de elipsis). Se
  // posiciona con "position: fixed" a partir del boton que lo abrio, para
  // que no quede recortado por el scroll interno de la tabla compacta
  // (table-wrap-compact tiene overflow-y: auto).
  menuAccionEquipo = signal<EquipoAsignado | null>(null);
  posMenuAccion = signal<{ top: number; left: number } | null>(null);

  toggleMenuAccion(event: MouseEvent, e: EquipoAsignado): void {
    event.stopPropagation();
    if (this.menuAccionEquipo()?.id === e.id) { this.cerrarMenuAccion(); return; }
    const boton = event.currentTarget as HTMLElement;
    const rect = boton.getBoundingClientRect();
    // Posicion provisional debajo del boton; se corrige en ajustarPosicionMenu
    // una vez el menu esta en el DOM y se conoce su alto real (varia segun si
    // el equipo tiene o no la opcion Checklist habilitada).
    this.posMenuAccion.set({ top: rect.bottom + 6, left: Math.max(8, rect.right - 220) });
    this.menuAccionEquipo.set(e);
    setTimeout(() => this.ajustarPosicionMenu(rect));
  }

  // Si el menu no cabe completo debajo del boton (fila cerca del fondo de
  // la ventana), se abre hacia arriba en su lugar para que ningun item
  // quede recortado fuera de la pantalla.
  private ajustarPosicionMenu(rectBoton: DOMRect): void {
    const menuEl = document.querySelector('.dropdown-menu-fixed') as HTMLElement | null;
    if (!menuEl) return;
    const margen = 8;
    const alto = menuEl.offsetHeight;
    if (rectBoton.bottom + 6 + alto > window.innerHeight - margen) {
      this.posMenuAccion.set({ top: Math.max(margen, rectBoton.top - 6 - alto), left: Math.max(8, rectBoton.right - 220) });
    }
  }

  cerrarMenuAccion(): void {
    this.menuAccionEquipo.set(null);
    this.posMenuAccion.set(null);
  }

  // Popup de cambio rapido de estado desde el menu de acciones de una fila.
  accionPendiente = signal<{ equipo: EquipoAsignado; estado: EstadoEquipo } | null>(null);
  guardandoAccion = signal(false);
  formMovimiento = this.fb.group({
    asignada_a: [''],
    observacion: [''],
  });

  // Checklist (catalogo de Configuracion) que se puede ir marcando al
  // confirmar un cambio de estado -- se guarda como snapshot en el
  // historico de este movimiento, no modifica el catalogo.
  checklistItems = signal<ChecklistItem[]>([]);
  checklistActivos = computed(() => this.checklistItems().filter((c) => c.activo));
  checklistSeleccionado = signal<Set<string>>(new Set());

  toggleChecklistItem(id: string): void {
    this.checklistSeleccionado.update((set) => {
      const copia = new Set(set);
      if (copia.has(id)) copia.delete(id); else copia.add(id);
      return copia;
    });
  }

  // Buscador general: busca el texto en cualquier dato del registro (no
  // solo en las columnas visibles -- incluye numero de serie, puertos,
  // precio, locacion/pais, observacion, etc.). Solo se activa con el
  // boton de la lupa (no al tipear ni con Enter): busquedaGeneralInput
  // es lo que el usuario esta escribiendo, busquedaGeneral es lo
  // efectivamente aplicado a la tabla -- separarlos evita que la tabla
  // se refiltre (y le robe el foco al input) en cada tecla.
  busquedaGeneralInput = signal('');
  busquedaGeneral = signal('');

  buscarYAbrirPrimero(): void {
    this.busquedaGeneral.set(this.busquedaGeneralInput());
    const primero = this.equiposFiltrados()[0];
    if (!primero) return;
    if (this.seleccionado()?.id !== primero.id) {
      this.abrirParaEditar(primero);
    }
    this.enfocarFila(primero.id);
  }

  private enfocarFila(id: string): void {
    setTimeout(() => {
      const fila = this.elRef.nativeElement.querySelector<HTMLElement>(`tr[data-equipo-id="${id}"]`);
      fila?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      fila?.focus();
    });
  }

  // Filtros por columna -- seleccion multiple estilo Excel (Set vacio =
  // sin filtro / "Todos").
  filtroCategoria = signal<Set<string>>(new Set());
  filtroMarcaModelo = signal<Set<string>>(new Set());
  filtroEstado = signal<Set<string>>(new Set());
  filtroAsignadaA = signal<Set<string>>(new Set());
  filtroEntrada = signal<Set<string>>(new Set());
  filtroVidaUtil = signal<Set<string>>(new Set());
  filtroCpu = signal<Set<string>>(new Set());
  filtroRam = signal<Set<string>>(new Set());
  filtroDisco = signal<Set<string>>(new Set());
  filtroProveedor = signal<Set<string>>(new Set());
  filtroNoFactura = signal<Set<string>>(new Set());

  hayFiltros = computed(() => !!(
    this.busquedaGeneral() ||
    this.filtroCategoria().size || this.filtroMarcaModelo().size || this.filtroEstado().size || this.filtroAsignadaA().size ||
    this.filtroEntrada().size || this.filtroVidaUtil().size || this.filtroCpu().size || this.filtroRam().size || this.filtroDisco().size ||
    this.filtroProveedor().size || this.filtroNoFactura().size
  ));

  private coincideBusquedaGeneral(e: EquipoAsignado, texto: string): boolean {
    const campos: (string | number | null | undefined)[] = [
      e.categoria_nombre, e.producto_nombre, e.marca, e.modelo,
      this.etiquetaEstado(e.estado), e.asignada_a,
      this.datePipe.transform(e.fecha_entrada, 'dd/MM/yyyy', 'UTC'),
      this.textoVidaUtil(e), e.procesador_nombre, e.memoria_ram, e.disco_duro,
      e.numero_serie, e.numero_puertos, e.numero_puertos_hdmi, e.precio_usd, e.locacion_pais,
      e.observacion, e.creado_por_nombre, e.modificado_por_nombre, e.proveedor_nombre, e.no_factura,
    ];
    return campos.some((c) => c != null && String(c).toLowerCase().includes(texto));
  }

  // Valores unicos ya existentes en los datos, para poblar los <select>
  // de filtro por columna (en vez de texto libre).
  private valoresUnicos(valores: (string | null | undefined)[]): string[] {
    const set = new Set(valores.filter((v): v is string => !!v));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  valoresCategoria = computed(() => this.valoresUnicos(this.equipos().map((e) => e.categoria_nombre)));
  valoresMarcaModelo = computed(() => this.valoresUnicos(this.equipos().map((e) => `${e.marca} ${e.modelo}`)));
  valoresEstado = computed(() => this.valoresUnicos(this.equipos().map((e) => this.etiquetaEstado(e.estado))));
  valoresAsignadaA = computed(() => this.valoresUnicos(this.equipos().map((e) => e.asignada_a)));
  valoresEntrada = computed(() => this.valoresUnicos(this.equipos().map((e) => this.datePipe.transform(e.fecha_entrada, 'dd/MM/yyyy', 'UTC'))));
  valoresVidaUtil = computed(() => this.valoresUnicos(this.equipos().map((e) => this.textoVidaUtil(e))));
  valoresCpu = computed(() => this.valoresUnicos(this.equipos().map((e) => e.procesador_nombre)));
  valoresRam = computed(() => this.valoresUnicos(this.equipos().map((e) => e.memoria_ram)));
  valoresDisco = computed(() => this.valoresUnicos(this.equipos().map((e) => e.disco_duro)));
  valoresProveedor = computed(() => this.valoresUnicos(this.equipos().map((e) => e.proveedor_nombre)));
  valoresNoFactura = computed(() => this.valoresUnicos(this.equipos().map((e) => e.no_factura)));

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
      case 'estado': return this.etiquetaEstado(e.estado).toLowerCase();
      case 'asignadaA': return (e.asignada_a ?? '').toLowerCase();
      case 'entrada': return e.fecha_entrada;
      case 'vidaUtil': return this.mesesRestantesVidaUtil(e) ?? Number.NEGATIVE_INFINITY;
      case 'cpu': return (e.procesador_nombre ?? '').toLowerCase();
      case 'ram': return (e.memoria_ram ?? '').toLowerCase();
      case 'disco': return (e.disco_duro ?? '').toLowerCase();
      case 'proveedor': return (e.proveedor_nombre ?? '').toLowerCase();
      case 'noFactura': return (e.no_factura ?? '').toLowerCase();
      default: return '';
    }
  }

  equiposFiltrados = computed(() => {
    const fGeneral = this.busquedaGeneral().trim().toLowerCase();
    const fCat = this.filtroCategoria();
    const fMarcaModelo = this.filtroMarcaModelo();
    const fEstado = this.filtroEstado();
    const fAsignada = this.filtroAsignadaA();
    const fEntrada = this.filtroEntrada();
    const fVidaUtil = this.filtroVidaUtil();
    const fCpu = this.filtroCpu();
    const fRam = this.filtroRam();
    const fDisco = this.filtroDisco();
    const fProveedor = this.filtroProveedor();
    const fNoFactura = this.filtroNoFactura();
    const filtrados = this.equipos().filter((e) => {
      if (fGeneral && !this.coincideBusquedaGeneral(e, fGeneral)) return false;
      if (fCat.size && !fCat.has(e.categoria_nombre)) return false;
      if (fMarcaModelo.size && !fMarcaModelo.has(`${e.marca} ${e.modelo}`)) return false;
      if (fEstado.size && !fEstado.has(this.etiquetaEstado(e.estado))) return false;
      if (fAsignada.size && !fAsignada.has(e.asignada_a ?? '')) return false;
      if (fEntrada.size && !fEntrada.has(this.datePipe.transform(e.fecha_entrada, 'dd/MM/yyyy', 'UTC') ?? '')) return false;
      if (fVidaUtil.size && !fVidaUtil.has(this.textoVidaUtil(e))) return false;
      if (fCpu.size && !fCpu.has(e.procesador_nombre ?? '')) return false;
      if (fRam.size && !fRam.has(e.memoria_ram ?? '')) return false;
      if (fDisco.size && !fDisco.has(e.disco_duro ?? '')) return false;
      if (fProveedor.size && !fProveedor.has(e.proveedor_nombre ?? '')) return false;
      if (fNoFactura.size && !fNoFactura.has(e.no_factura ?? '')) return false;
      return true;
    });

    const columna = this.ordenColumna();
    if (!columna) return filtrados;
    const signo = this.ordenDireccion() === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = this.valorOrden(a, columna);
      const vb = this.valorOrden(b, columna);
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return 0;
    });
  });

  // Meses calendario desde fecha_entrada hasta hoy. fecha_entrada es un
  // "date" puro (medianoche UTC); se leen sus componentes en UTC (no
  // local) para no desfasarse un dia, igual que el fix de la columna
  // "Entrada".
  private mesesTranscurridos(fechaEntrada: string): number {
    const inicio = new Date(fechaEntrada);
    const hoy = new Date();
    let meses = (hoy.getFullYear() - inicio.getUTCFullYear()) * 12 + (hoy.getMonth() - inicio.getUTCMonth());
    if (hoy.getDate() < inicio.getUTCDate()) meses -= 1;
    return Math.max(0, meses);
  }

  // Meses de vida util que quedan (puede dar negativo si ya se paso del
  // estimado; textoVidaUtil() lo recorta a 0 para mostrar).
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

  form = this.fb.group({
    categoria_id: ['', Validators.required],
    producto_id: ['', Validators.required],
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    fecha_entrada: [this.hoyISO(), Validators.required],
    vida_util_meses: [''],
    estado: ['stock' as EstadoEquipo, Validators.required],
    asignada_a: [''],
    observacion: [''],
    procesador_id: [''],
    memoria_ram: [''],
    disco_duro: [''],
    numero_serie: [''],
    numero_puertos: [''],
    numero_puertos_hdmi: [''],
    precio_usd: [''],
    locacion_pais: [''],
    proveedor_id: [''],
    no_factura: [''],
  });

  // Senal propia (no el FormControl.value directo, que no es una senal y
  // no dispara un recalculo del computed) para poder filtrar productos
  // reactivamente segun la categoria elegida en el formulario.
  private categoriaIdForm = signal<number | null>(null);

  // Solo los productos de la categoria elegida en el formulario.
  productosDeCategoria = computed(() => {
    const catId = this.categoriaIdForm();
    return catId ? this.productos().filter((p) => p.categoria_id === catId) : [];
  });

  constructor(
    private fb: FormBuilder,
    private srv: EquiposAsignadosService,
    private categoriasSrv: CategoriasService,
    private productosSrv: ProductosService,
    private procesadoresSrv: ProcesadoresService,
    private proveedoresSrv: ProveedoresService,
    private datePipe: DatePipe,
    private elRef: ElementRef<HTMLElement>,
    private sanitizer: DomSanitizer,
    private checklistsSrv: ChecklistsService,
    private checklistPdfSrv: ChecklistEquipoPdfService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.categoriasSrv.listar().subscribe((data) => this.categorias.set(data));
    this.productosSrv.listar().subscribe((data) => this.productos.set(data));
    this.procesadoresSrv.listar().subscribe((data) => this.procesadores.set(data));
    this.proveedoresSrv.listar().subscribe((data) => this.proveedores.set(data));
    this.checklistsSrv.listar().subscribe((data) => this.checklistItems.set(data));
  }

  // Disparado solo por la interaccion real del usuario con el <select>
  // (no por form.reset() al abrir un registro existente para editar --
  // eso llamaria de nuevo el auto-completado y le borraria marca/modelo
  // ya guardados si el usuario los habia corregido a mano).
  onCategoriaChange(): void {
    const catId = Number(this.form.get('categoria_id')?.value) || null;
    this.categoriaIdForm.set(catId);
    this.form.patchValue({ producto_id: '', marca: '', modelo: '' });
  }

  // Marca/modelo se auto-completan a partir del producto elegido (el
  // nombre del catalogo es "Marca Modelo..."), pero quedan editables.
  onProductoChange(): void {
    const id = Number(this.form.get('producto_id')?.value);
    const producto = this.productos().find((p) => p.id === id);
    if (!producto) return;
    const espacio = producto.nombre.indexOf(' ');
    const marca = espacio === -1 ? producto.nombre : producto.nombre.slice(0, espacio);
    const modelo = espacio === -1 ? '' : producto.nombre.slice(espacio + 1);
    this.form.patchValue({ marca, modelo });
  }

  private hoyISO(): string { return new Date().toISOString().slice(0, 10); }

  // Mismo patron que fecha_incidente (servicios-proveedores.component.ts):
  // el input datetime-local no trae zona horaria (su valor se interpreta
  // como hora LOCAL del navegador), asi que hay que convertir a mano.
  private aFechaHoraLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  cargar(): void { this.srv.listar().subscribe((data) => this.equipos.set(data)); }

  limpiarFiltros(): void {
    this.busquedaGeneralInput.set('');
    this.busquedaGeneral.set('');
    this.filtroCategoria.set(new Set());
    this.filtroMarcaModelo.set(new Set());
    this.filtroEstado.set(new Set());
    this.filtroAsignadaA.set(new Set());
    this.filtroEntrada.set(new Set());
    this.filtroVidaUtil.set(new Set());
    this.filtroCpu.set(new Set());
    this.filtroRam.set(new Set());
    this.filtroDisco.set(new Set());
    this.filtroProveedor.set(new Set());
    this.filtroNoFactura.set(new Set());
  }

  etiquetaEstado(estado: EstadoEquipo): string {
    return this.estados.find((e) => e.valor === estado)?.etiqueta ?? estado;
  }

  idCorto(id: string): string {
    return id.slice(0, 8).toUpperCase();
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

  seleccionar(e: EquipoAsignado): void {
    const yaSeleccionado = this.seleccionado()?.id === e.id;
    if (yaSeleccionado) { this.nuevo(); return; }
    this.abrirParaEditar(e);
  }

  // Separado de seleccionar() para poder refrescar el formulario y el
  // historico de un equipo que YA esta abierto (ej. tras cambiarle el
  // estado desde el boton-icono) sin disparar el "toggle" que lo cerraria.
  private abrirParaEditar(e: EquipoAsignado): void {
    this.seleccionado.set(e);
    const catId = this.productos().find((p) => p.id === e.producto_id)?.categoria_id ?? null;
    this.categoriaIdForm.set(catId);
    this.form.reset({
      categoria_id: catId != null ? String(catId) : '',
      producto_id: String(e.producto_id),
      marca: e.marca,
      modelo: e.modelo,
      fecha_entrada: e.fecha_entrada?.slice(0, 10),
      vida_util_meses: e.vida_util_meses != null ? String(e.vida_util_meses) : '',
      estado: e.estado,
      asignada_a: e.asignada_a ?? '',
      observacion: e.observacion ?? '',
      procesador_id: e.procesador_id != null ? String(e.procesador_id) : '',
      memoria_ram: e.memoria_ram ?? '',
      disco_duro: e.disco_duro ?? '',
      numero_serie: e.numero_serie ?? '',
      numero_puertos: e.numero_puertos != null ? String(e.numero_puertos) : '',
      numero_puertos_hdmi: e.numero_puertos_hdmi != null ? String(e.numero_puertos_hdmi) : '',
      precio_usd: e.precio_usd != null ? String(e.precio_usd) : '',
      locacion_pais: e.locacion_pais ?? '',
      proveedor_id: e.proveedor_id ?? '',
      no_factura: e.no_factura ?? '',
    });
    this.cargarHistorial(e.id);
    this.errorArchivoImagen.set(null);
    this.cargarAdjuntos(e.id);
  }

  cargarHistorial(id: string): void {
    this.srv.historial(id).subscribe((data) => this.historial.set(data));
  }

  // ---------- Adjuntos (imagenes/documentos) ----------
  // Tabla propia (equipo_adjuntos), no un campo del formulario: cada
  // adjunto se guarda/borra al instante contra su propio endpoint (mismo
  // patron que servicio_adjuntos/incidente_adjuntos).
  imagenesEquipoActual = signal<ImagenServicioProveedor[]>([]);
  guardandoAdjunto = signal(false);
  errorArchivoImagen = signal<string | null>(null);
  private readonly TIPOS_ARCHIVO_PERMITIDOS = ['image/png', 'image/jpeg', 'application/pdf'];
  private readonly MAX_ARCHIVO_BYTES = 3 * 1024 * 1024; // 3MB, antes de inflarse a base64
  private readonly MAX_IMAGENES = 20;

  cargarAdjuntos(id: string): void {
    this.srv.listarAdjuntos(id).subscribe((data) => this.imagenesEquipoActual.set(data));
  }

  agregarImagenEntry(img: ImagenServicioProveedor): void {
    this.imagenesEquipoActual.update((arr) => [img, ...arr]);
  }

  eliminarImagen(adjuntoId: string): void {
    const equipo = this.seleccionado();
    if (!equipo) return;
    if (!confirm('Eliminar este adjunto?')) return;
    this.srv.eliminarAdjunto(equipo.id, adjuntoId).subscribe({
      next: () => this.imagenesEquipoActual.update((arr) => arr.filter((a) => a.id !== adjuntoId)),
      error: (err) => alert(err.error?.mensaje || 'No se pudo eliminar el adjunto'),
    });
  }

  actualizarDescripcionAdjunto(adjuntoId: string, descripcion: string): void {
    const equipo = this.seleccionado();
    if (!equipo) return;
    this.srv.actualizarAdjunto(equipo.id, adjuntoId, { descripcion }).subscribe({
      next: (actualizado) => this.imagenesEquipoActual.update((arr) => arr.map((a) => (a.id === adjuntoId ? actualizado : a))),
      error: (err) => alert(err.error?.mensaje || 'No se pudo actualizar la descripción'),
    });
  }

  // Un <a href="data:..."> no alcanza (ver nota identica en
  // servicios-proveedores.component.ts): Chrome/Edge bloquean la
  // navegacion a un data: URI, asi que se convierte a Blob primero.
  abrirAdjunto(base64: string): void {
    const [meta, datos] = base64.split(',');
    const tipo = meta.match(/data:(.*);base64/)?.[1] || 'application/octet-stream';
    const binario = atob(datos);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Convierte la descripcion de un adjunto en HTML seguro, detectando URLs
  // y volviendolas clicables -- mismo patron que las notas de incidente
  // (servicios-proveedores.component.ts#textoConEnlaces). Escapa el texto
  // primero (es contenido de usuario) y recien despues inserta los <a>.
  private readonly REGEX_URL = /(https?:\/\/[^\s<]+)/g;

  textoConEnlaces(texto: string): SafeHtml {
    const escapado = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const conEnlaces = escapado.replace(
      this.REGEX_URL,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
    return this.sanitizer.bypassSecurityTrustHtml(conEnlaces);
  }

  tipoArchivoLabel(base64: string): string {
    if (base64.startsWith('data:application/pdf')) return 'Documento PDF';
    if (base64.startsWith('data:image/png')) return 'Imagen PNG';
    if (base64.startsWith('data:image/jpeg')) return 'Imagen JPG';
    return 'Archivo';
  }

  tamanoArchivo(base64: string): string {
    const datos = base64.split(',')[1] || '';
    const padding = (datos.match(/=+$/) || [''])[0].length;
    const bytes = Math.max(0, (datos.length * 3) / 4 - padding);
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  onSeleccionArchivoImagen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (archivo) this.procesarArchivoImagen(archivo);
    input.value = '';
  }

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
    const equipo = this.seleccionado();
    if (!equipo) {
      this.errorArchivoImagen.set('Guarda el equipo antes de adjuntar archivos.');
    } else if (!this.TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) {
      this.errorArchivoImagen.set('Solo se permiten archivos PDF, PNG o JPG.');
    } else if (archivo.size > this.MAX_ARCHIVO_BYTES) {
      this.errorArchivoImagen.set('El archivo supera el tamaño máximo permitido (3MB).');
    } else if (this.imagenesEquipoActual().length >= this.MAX_IMAGENES) {
      this.errorArchivoImagen.set(`Se alcanzó el máximo de ${this.MAX_IMAGENES} archivos adjuntos.`);
    } else {
      this.guardandoAdjunto.set(true);
      leerArchivoComoBase64(archivo).then((base64) => {
        this.srv.crearAdjunto(equipo.id, { imagen_base64: base64 }).subscribe({
          next: (nuevo) => {
            this.guardandoAdjunto.set(false);
            this.agregarImagenEntry(nuevo);
          },
          error: (err) => {
            this.guardandoAdjunto.set(false);
            this.errorArchivoImagen.set(err.error?.mensaje || 'No se pudo guardar el adjunto.');
          },
        });
      }).catch(() => {
        this.guardandoAdjunto.set(false);
        this.errorArchivoImagen.set('No se pudo leer el archivo.');
      });
    }
  }

  nuevo(): void {
    this.seleccionado.set(null);
    this.categoriaIdForm.set(null);
    this.historial.set([]);
    this.imagenesEquipoActual.set([]);
    this.errorArchivoImagen.set(null);
    this.form.reset({
      categoria_id: '', producto_id: '', marca: '', modelo: '', fecha_entrada: this.hoyISO(), vida_util_meses: '',
      estado: 'stock', asignada_a: '', observacion: '',
      procesador_id: '', memoria_ram: '', disco_duro: '', numero_serie: '', numero_puertos: '', numero_puertos_hdmi: '',
      precio_usd: '', locacion_pais: '', proveedor_id: '', no_factura: '',
    });
  }

  guardar(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const data = {
      producto_id: Number(raw.producto_id),
      marca: raw.marca,
      modelo: raw.modelo,
      fecha_entrada: raw.fecha_entrada,
      vida_util_meses: raw.vida_util_meses ? Number(raw.vida_util_meses) : null,
      estado: raw.estado,
      asignada_a: raw.asignada_a?.trim() || null,
      observacion: raw.observacion?.trim() || null,
      procesador_id: raw.procesador_id ? Number(raw.procesador_id) : null,
      memoria_ram: raw.memoria_ram?.trim() || null,
      disco_duro: raw.disco_duro?.trim() || null,
      numero_serie: raw.numero_serie?.trim() || null,
      numero_puertos: raw.numero_puertos !== '' && raw.numero_puertos != null ? Number(raw.numero_puertos) : null,
      numero_puertos_hdmi: raw.numero_puertos_hdmi !== '' && raw.numero_puertos_hdmi != null ? Number(raw.numero_puertos_hdmi) : null,
      precio_usd: raw.precio_usd !== '' && raw.precio_usd != null ? Number(raw.precio_usd) : null,
      locacion_pais: raw.locacion_pais?.trim() || null,
      proveedor_id: raw.proveedor_id || null,
      no_factura: raw.no_factura?.trim() || null,
    };
    const actual = this.seleccionado();
    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data);
    req.subscribe({
      next: () => { this.nuevo(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el equipo'),
    });
  }

  eliminar(): void {
    const actual = this.seleccionado();
    if (!actual) return;
    if (!confirm(`Eliminar el equipo "${actual.marca} ${actual.modelo}" de esta empresa?`)) return;
    this.srv.eliminar(actual.id).subscribe({
      next: () => { this.nuevo(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar el equipo'),
    });
  }

  // ---------- Cambio rapido de estado (boton-icono por fila) ----------
  abrirAccion(e: EquipoAsignado, estado: EstadoEquipo): void {
    this.cerrarMenuAccion();
    this.accionPendiente.set({ equipo: e, estado });
    // Si ya estaba asignado (ej. reasignar sin cambiar de "En uso" a otra
    // cosa), se precarga el nombre actual para editarlo en vez de partir
    // de cero.
    this.formMovimiento.reset({ asignada_a: estado === 'en_uso' ? (e.asignada_a ?? '') : '', observacion: '' });
    this.checklistSeleccionado.set(new Set());
  }

  cerrarAccion(): void {
    if (this.guardandoAccion()) return;
    this.accionPendiente.set(null);
  }

  confirmarAccion(): void {
    const pendiente = this.accionPendiente();
    if (!pendiente) return;
    const { asignada_a, observacion } = this.formMovimiento.getRawValue();
    if (pendiente.estado === 'en_uso' && !asignada_a?.trim()) {
      alert('Debes indicar a quien se asigna el equipo.');
      return;
    }

    const checklistIds = Array.from(this.checklistSeleccionado());
    this.guardandoAccion.set(true);
    this.srv.cambiarEstado(pendiente.equipo.id, {
      estado: pendiente.estado,
      asignada_a: asignada_a?.trim() || undefined,
      observacion: observacion?.trim() || undefined,
      checklist_ids: checklistIds.length ? checklistIds : undefined,
    }).subscribe({
      next: (actualizado) => {
        this.guardandoAccion.set(false);
        this.accionPendiente.set(null);
        this.cargar();
        // Si el equipo afectado es el que esta abierto en el formulario de
        // mantenimiento, se refresca tambien (estado/asignada_a/historico).
        if (this.seleccionado()?.id === actualizado.id) this.abrirParaEditar(actualizado);
      },
      error: (err) => {
        this.guardandoAccion.set(false);
        alert(err?.error?.mensaje || 'No se pudo cambiar el estado');
      },
    });
  }

  // ---------- Checklist del equipo (ejecuciones) ----------
  // Se puede repetir el checklist mas de una vez por equipo (ej. cada vez
  // que cambia de responsable): cada "ejecucion" queda asociada al
  // usuario al que se le asigno el equipo en ese momento (por defecto el
  // "Asignado a" actual del equipo) + su propia fecha. Accesible desde el
  // menu de Acciones de la fila.
  checklistEquipoActual = signal<EquipoAsignado | null>(null);
  checklistEjecuciones = signal<EquipoChecklistEjecucion[]>([]);
  checklistEjecucionActual = signal<EquipoChecklistEjecucionDetalle | null>(null);
  cargandoChecklist = signal(false);
  guardandoChecklistItem = signal<string | null>(null);
  mostrandoNuevoChecklist = signal(false);
  guardandoNuevoChecklist = signal(false);

  nuevoChecklistForm = this.fb.group({
    asignado_a: [''],
    fecha: [''],
  });

  abrirChecklistEquipo(e: EquipoAsignado): void {
    this.cerrarMenuAccion();
    this.checklistEquipoActual.set(e);
    this.checklistEjecucionActual.set(null);
    this.mostrandoNuevoChecklist.set(false);
    this.cargarChecklistEjecuciones();
  }

  cargarChecklistEjecuciones(): void {
    const equipo = this.checklistEquipoActual();
    if (!equipo) return;
    this.cargandoChecklist.set(true);
    this.srv.listarChecklistEjecuciones(equipo.id).subscribe({
      next: (data) => {
        this.checklistEjecuciones.set(data);
        this.cargandoChecklist.set(false);
      },
      error: () => this.cargandoChecklist.set(false),
    });
  }

  cerrarChecklistEquipo(): void {
    this.checklistEquipoActual.set(null);
    this.checklistEjecuciones.set([]);
    this.checklistEjecucionActual.set(null);
    this.mostrandoNuevoChecklist.set(false);
    this.mostrandoFormCorreoChecklist.set(false);
  }

  mostrarNuevoChecklistForm(): void {
    const equipo = this.checklistEquipoActual();
    this.nuevoChecklistForm.reset({ asignado_a: equipo?.asignada_a || '', fecha: this.aFechaHoraLocal(new Date()) });
    this.mostrandoNuevoChecklist.set(true);
  }

  cancelarNuevoChecklist(): void {
    this.mostrandoNuevoChecklist.set(false);
  }

  crearChecklistEjecucion(): void {
    const equipo = this.checklistEquipoActual();
    if (!equipo || this.guardandoNuevoChecklist()) return;
    const { asignado_a, fecha } = this.nuevoChecklistForm.getRawValue();

    this.guardandoNuevoChecklist.set(true);
    this.srv.crearChecklistEjecucion(equipo.id, {
      asignado_a: asignado_a?.trim() || undefined,
      fecha: fecha ? new Date(fecha).toISOString() : undefined,
    }).subscribe({
      next: (nueva) => {
        this.guardandoNuevoChecklist.set(false);
        this.mostrandoNuevoChecklist.set(false);
        this.cargarChecklistEjecuciones();
        this.abrirChecklistEjecucion(nueva.id);
      },
      error: (err) => {
        this.guardandoNuevoChecklist.set(false);
        alert(err?.error?.mensaje || 'No se pudo crear el checklist');
      },
    });
  }

  abrirChecklistEjecucion(ejecucionId: string): void {
    const equipo = this.checklistEquipoActual();
    if (!equipo) return;
    this.cargandoChecklist.set(true);
    this.srv.obtenerChecklistEjecucion(equipo.id, ejecucionId).subscribe({
      next: (detalle) => {
        this.checklistEjecucionActual.set(detalle);
        this.cargandoChecklist.set(false);
      },
      error: () => this.cargandoChecklist.set(false),
    });
  }

  volverListaChecklist(): void {
    this.checklistEjecucionActual.set(null);
    this.mostrandoFormCorreoChecklist.set(false);
    this.cargarChecklistEjecuciones();
  }

  eliminarChecklistEjecucion(ejecucion: EquipoChecklistEjecucion, event: MouseEvent): void {
    event.stopPropagation();
    const equipo = this.checklistEquipoActual();
    if (!equipo) return;
    if (!confirm('¿Eliminar este checklist?')) return;
    this.srv.eliminarChecklistEjecucion(equipo.id, ejecucion.id).subscribe({
      next: () => this.cargarChecklistEjecuciones(),
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar el checklist'),
    });
  }

  toggleCompletadoChecklistItem(item: EquipoChecklistItem): void {
    const equipo = this.checklistEquipoActual();
    const ejecucion = this.checklistEjecucionActual();
    if (!equipo || !ejecucion) return;
    this.guardandoChecklistItem.set(item.checklist_id);
    this.srv.actualizarChecklistEjecucionItem(equipo.id, ejecucion.id, item.checklist_id, { completado: !item.completado }).subscribe({
      next: (actualizado) => {
        this.guardandoChecklistItem.set(null);
        this.checklistEjecucionActual.update((det) => det && {
          ...det,
          items: det.items.map((i) => (i.checklist_id === actualizado.checklist_id ? actualizado : i)),
        });
      },
      error: (err) => {
        this.guardandoChecklistItem.set(null);
        alert(err?.error?.mensaje || 'No se pudo guardar el checklist');
      },
    });
  }

  private construirDatosChecklistPdf(): ChecklistPdfData | null {
    const equipo = this.checklistEquipoActual();
    const ejecucion = this.checklistEjecucionActual();
    if (!equipo || !ejecucion) return null;

    const empresa = this.auth.empresaActiva();
    const formatearFecha = (f: string) => (this.datePipe.transform(f, 'd-MMM-y h:mm a') || '').toLowerCase();
    // Iniciales de "Asignado a" (inicial de Nombre + inicial de Apellido),
    // mismo criterio que el avatar del topbar (ver layout.component.ts#iniciales).
    const iniciales = (ejecucion.asignado_a || '')
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');

    return {
      empresaNombre: empresa?.empresa_nombre ?? '',
      empresaLogo: empresa?.empresa_logo ?? null,
      equipo: `${equipo.marca} ${equipo.modelo}` + (equipo.numero_serie ? ` (SN:${equipo.numero_serie})` : ''),
      categoria: equipo.categoria_nombre,
      asignadoA: ejecucion.asignado_a || undefined,
      fechaEjecucion: formatearFecha(ejecucion.fecha),
      fechaGeneracion: formatearFecha(new Date().toISOString()),
      generadoPor: this.auth.usuario()?.nombre,
      asignadoIniciales: iniciales || undefined,
      items: ejecucion.items.map((item) => ({
        descripcion: item.descripcion,
        completado: item.completado,
        fechaCompletado: item.fecha_completado ? formatearFecha(item.fecha_completado) : null,
        completadoPor: item.modificado_por_nombre,
      })),
    };
  }

  imprimirChecklistPdf(): void {
    const datos = this.construirDatosChecklistPdf();
    if (!datos) return;

    // La ventana se abre YA, dentro del click, para que el navegador no la
    // bloquee -- pdfmake se carga de forma diferida (import() dinamico) y
    // para cuando el PDF esta listo ya no estamos dentro del gesto de click.
    const ventana = window.open('', '_blank') ?? undefined;
    this.checklistPdfSrv.generar(datos)
      .then((doc) => doc.open(undefined, ventana))
      .catch(() => alert('No se pudo generar el PDF del checklist.'));
  }

  // mailto: no permite adjuntar un archivo -- por eso el envio real (con
  // el PDF ya adjunto) tiene que pasar por el backend (Microsoft Graph).
  // En vez de pedir el destinatario con un prompt() nativo, se muestra un
  // campo propio dentro del modal.
  mostrandoFormCorreoChecklist = signal(false);
  destinatarioChecklistForm = this.fb.group({ destinatario: ['', [Validators.required, Validators.email]] });
  enviandoChecklistPorCorreo = signal(false);

  abrirFormCorreoChecklist(): void {
    this.destinatarioChecklistForm.reset();
    this.mostrandoFormCorreoChecklist.set(true);
  }

  cancelarFormCorreoChecklist(): void {
    this.mostrandoFormCorreoChecklist.set(false);
  }

  enviarChecklistPorCorreo(): void {
    if (this.destinatarioChecklistForm.invalid) return;
    const equipo = this.checklistEquipoActual();
    const ejecucion = this.checklistEjecucionActual();
    const datos = this.construirDatosChecklistPdf();
    if (!equipo || !ejecucion || !datos) return;

    const destinatario = this.destinatarioChecklistForm.getRawValue().destinatario!.trim();

    this.enviandoChecklistPorCorreo.set(true);
    this.checklistPdfSrv.generar(datos)
      .then((doc) => new Promise<string>((resolve) => doc.getBase64((b64: string) => resolve(b64))))
      .then((pdfBase64) =>
        firstValueFrom(this.srv.enviarChecklistPdfPorCorreo(equipo.id, ejecucion.id, { destinatario, pdfBase64 }))
      )
      .then(() => {
        this.enviandoChecklistPorCorreo.set(false);
        this.mostrandoFormCorreoChecklist.set(false);
        alert('Checklist enviado por correo.');
      })
      .catch((err) => {
        this.enviandoChecklistPorCorreo.set(false);
        alert(err?.error?.mensaje || 'No se pudo enviar el checklist por correo.');
      });
  }
}
