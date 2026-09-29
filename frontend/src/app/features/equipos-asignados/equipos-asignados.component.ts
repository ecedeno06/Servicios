import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EquiposAsignadosService } from '../../core/services/equipos-asignados.service';
import { CategoriasService } from '../../core/services/categorias.service';
import { ProductosService } from '../../core/services/productos.service';
import { Categoria, EquipoAsignado, EstadoEquipo, MovimientoEquipo, Producto } from '../../core/models/models';

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
  templateUrl: './equipos-asignados.component.html',
  styleUrl: './equipos-asignados.component.css',
})
export class EquiposAsignadosComponent implements OnInit {
  estados = ESTADOS;

  equipos = signal<EquipoAsignado[]>([]);
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);

  seleccionado = signal<EquipoAsignado | null>(null);
  historial = signal<MovimientoEquipo[]>([]);

  // Filtros por columna
  filtroCategoria = signal('');
  filtroMarcaModelo = signal('');
  filtroEstado = signal('');
  filtroAsignadaA = signal('');

  hayFiltros = computed(() => !!(this.filtroCategoria() || this.filtroMarcaModelo() || this.filtroEstado() || this.filtroAsignadaA()));

  equiposFiltrados = computed(() => {
    const fCat = this.filtroCategoria().trim().toLowerCase();
    const fMarcaModelo = this.filtroMarcaModelo().trim().toLowerCase();
    const fEstado = this.filtroEstado().trim().toLowerCase();
    const fAsignada = this.filtroAsignadaA().trim().toLowerCase();
    return this.equipos().filter((e) => {
      if (fCat && !e.categoria_nombre.toLowerCase().includes(fCat)) return false;
      if (fMarcaModelo && !`${e.marca} ${e.modelo}`.toLowerCase().includes(fMarcaModelo)) return false;
      if (fEstado && !this.etiquetaEstado(e.estado).toLowerCase().includes(fEstado)) return false;
      if (fAsignada && !(e.asignada_a ?? '').toLowerCase().includes(fAsignada)) return false;
      return true;
    });
  });

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
    private productosSrv: ProductosService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.categoriasSrv.listar().subscribe((data) => this.categorias.set(data));
    this.productosSrv.listar().subscribe((data) => this.productos.set(data));
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
    this.form.reset({ categoria_id: '', producto_id: '', marca: '', modelo: '', fecha_entrada: this.hoyISO(), vida_util_meses: '', estado: 'stock', asignada_a: '', observacion: '' });
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
}
