import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EquiposAsignadosService } from '../../core/services/equipos-asignados.service';
import { CategoriasService } from '../../core/services/categorias.service';
import { ProductosService } from '../../core/services/productos.service';
import { ProcesadoresService } from '../../core/services/procesadores.service';
import { Categoria, EquipoAsignado, EstadoEquipo, MovimientoEquipo, Procesador, Producto } from '../../core/models/models';

const ESTADOS: { valor: EstadoEquipo; etiqueta: string }[] = [
  { valor: 'en_uso', etiqueta: 'En uso' },
  { valor: 'stock', etiqueta: 'Stock' },
  { valor: 'reparacion', etiqueta: 'Reparacion' },
  { valor: 'descarte', etiqueta: 'Descarte' },
  { valor: 'vendida', etiqueta: 'Vendida' },
];

@Component({
  selector: 'app-equipos-asignados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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
    this.posMenuAccion.set({ top: rect.bottom + 6, left: Math.max(8, rect.right - 220) });
    this.menuAccionEquipo.set(e);
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

  // Filtros por columna
  filtroCategoria = signal('');
  filtroMarcaModelo = signal('');
  filtroEstado = signal('');
  filtroAsignadaA = signal('');
  filtroEntrada = signal('');
  filtroVidaUtil = signal('');
  filtroCpu = signal('');
  filtroRam = signal('');
  filtroDisco = signal('');

  hayFiltros = computed(() => !!(
    this.filtroCategoria() || this.filtroMarcaModelo() || this.filtroEstado() || this.filtroAsignadaA() ||
    this.filtroEntrada() || this.filtroVidaUtil() || this.filtroCpu() || this.filtroRam() || this.filtroDisco()
  ));

  equiposFiltrados = computed(() => {
    const fCat = this.filtroCategoria().trim().toLowerCase();
    const fMarcaModelo = this.filtroMarcaModelo().trim().toLowerCase();
    const fEstado = this.filtroEstado().trim().toLowerCase();
    const fAsignada = this.filtroAsignadaA().trim().toLowerCase();
    const fEntrada = this.filtroEntrada().trim().toLowerCase();
    const fVidaUtil = this.filtroVidaUtil().trim().toLowerCase();
    const fCpu = this.filtroCpu().trim().toLowerCase();
    const fRam = this.filtroRam().trim().toLowerCase();
    const fDisco = this.filtroDisco().trim().toLowerCase();
    return this.equipos().filter((e) => {
      if (fCat && !e.categoria_nombre.toLowerCase().includes(fCat)) return false;
      if (fMarcaModelo && !`${e.marca} ${e.modelo}`.toLowerCase().includes(fMarcaModelo)) return false;
      if (fEstado && !this.etiquetaEstado(e.estado).toLowerCase().includes(fEstado)) return false;
      if (fAsignada && !(e.asignada_a ?? '').toLowerCase().includes(fAsignada)) return false;
      if (fEntrada && !(this.datePipe.transform(e.fecha_entrada, 'dd/MM/yyyy') ?? '').toLowerCase().includes(fEntrada)) return false;
      if (fVidaUtil && !this.textoVidaUtil(e).toLowerCase().includes(fVidaUtil)) return false;
      if (fCpu && !(e.procesador_nombre ?? '-').toLowerCase().includes(fCpu)) return false;
      if (fRam && !(e.memoria_ram ?? '-').toLowerCase().includes(fRam)) return false;
      if (fDisco && !(e.disco_duro ?? '-').toLowerCase().includes(fDisco)) return false;
      return true;
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
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.categoriasSrv.listar().subscribe((data) => this.categorias.set(data));
    this.productosSrv.listar().subscribe((data) => this.productos.set(data));
    this.procesadoresSrv.listar().subscribe((data) => this.procesadores.set(data));
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

  cargar(): void { this.srv.listar().subscribe((data) => this.equipos.set(data)); }

  limpiarFiltros(): void {
    this.filtroCategoria.set('');
    this.filtroMarcaModelo.set('');
    this.filtroEstado.set('');
    this.filtroAsignadaA.set('');
    this.filtroEntrada.set('');
    this.filtroVidaUtil.set('');
    this.filtroCpu.set('');
    this.filtroRam.set('');
    this.filtroDisco.set('');
  }

  etiquetaEstado(estado: EstadoEquipo): string {
    return this.estados.find((e) => e.valor === estado)?.etiqueta ?? estado;
  }

  claseEstado(estado: EstadoEquipo): string {
    switch (estado) {
      case 'en_uso': return 'badge-green';
      case 'reparacion': return 'badge-amber';
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
    });
    this.cargarHistorial(e.id);
  }

  cargarHistorial(id: string): void {
    this.srv.historial(id).subscribe((data) => this.historial.set(data));
  }

  nuevo(): void {
    this.seleccionado.set(null);
    this.categoriaIdForm.set(null);
    this.historial.set([]);
    this.form.reset({
      categoria_id: '', producto_id: '', marca: '', modelo: '', fecha_entrada: this.hoyISO(), vida_util_meses: '',
      estado: 'stock', asignada_a: '', observacion: '',
      procesador_id: '', memoria_ram: '', disco_duro: '', numero_serie: '', numero_puertos: '', numero_puertos_hdmi: '',
      precio_usd: '', locacion_pais: '',
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

    this.guardandoAccion.set(true);
    this.srv.cambiarEstado(pendiente.equipo.id, {
      estado: pendiente.estado,
      asignada_a: asignada_a?.trim() || undefined,
      observacion: observacion?.trim() || undefined,
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
}
