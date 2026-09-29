import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriasService } from '../../core/services/categorias.service';
import { ProductosService } from '../../core/services/productos.service';
import { ProcesadoresService } from '../../core/services/procesadores.service';
import { Categoria, Procesador, Producto } from '../../core/models/models';

type Pestana = 'categorias' | 'productos' | 'procesadores';

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './equipos.component.html',
  styleUrl: './equipos.component.css',
})
export class EquiposComponent implements OnInit {
  pestanaActiva = signal<Pestana>('categorias');

  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  procesadores = signal<Procesador[]>([]);

  // ---------- Categorias ----------
  categoriaSeleccionada = signal<Categoria | null>(null);
  filtroCategoria = signal('');

  formCategoria = this.fb.group({ nombre: ['', Validators.required] });

  categoriasFiltradas = computed(() => {
    const f = this.filtroCategoria().trim().toLowerCase();
    if (!f) return this.categorias();
    return this.categorias().filter((c) => c.nombre.toLowerCase().includes(f));
  });

  // ---------- Productos ----------
  productoSeleccionado = signal<Producto | null>(null);
  filtroProductoCategoria = signal('');
  filtroProductoNombre = signal('');

  formProducto = this.fb.group({
    categoria_id: ['', Validators.required],
    nombre: ['', Validators.required],
  });

  hayFiltrosProducto = computed(() => !!(this.filtroProductoCategoria() || this.filtroProductoNombre()));

  productosFiltrados = computed(() => {
    const fCat = this.filtroProductoCategoria().trim().toLowerCase();
    const fNombre = this.filtroProductoNombre().trim().toLowerCase();
    return this.productos().filter((p) => {
      if (fCat && !(p.categoria_nombre ?? '').toLowerCase().includes(fCat)) return false;
      if (fNombre && !p.nombre.toLowerCase().includes(fNombre)) return false;
      return true;
    });
  });

  // ---------- Procesadores ----------
  procesadorSeleccionado = signal<Procesador | null>(null);
  filtroProcesador = signal('');

  formProcesador = this.fb.group({ nombre: ['', Validators.required] });

  procesadoresFiltrados = computed(() => {
    const f = this.filtroProcesador().trim().toLowerCase();
    if (!f) return this.procesadores();
    return this.procesadores().filter((p) => p.nombre.toLowerCase().includes(f));
  });

  constructor(
    private fb: FormBuilder,
    private categoriasSrv: CategoriasService,
    private productosSrv: ProductosService,
    private procesadoresSrv: ProcesadoresService
  ) {}

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarProductos();
    this.cargarProcesadores();
  }

  cargarCategorias(): void { this.categoriasSrv.listar().subscribe((data) => this.categorias.set(data)); }
  cargarProductos(): void { this.productosSrv.listar().subscribe((data) => this.productos.set(data)); }
  cargarProcesadores(): void { this.procesadoresSrv.listar().subscribe((data) => this.procesadores.set(data)); }

  limpiarFiltrosProducto(): void {
    this.filtroProductoCategoria.set('');
    this.filtroProductoNombre.set('');
  }

  // ---------- Categorias: mantenimiento ----------
  seleccionarCategoria(c: Categoria): void {
    const yaSeleccionada = this.categoriaSeleccionada()?.id === c.id;
    if (yaSeleccionada) { this.nuevaCategoria(); return; }
    this.categoriaSeleccionada.set(c);
    this.formCategoria.reset({ nombre: c.nombre });
  }

  nuevaCategoria(): void {
    this.categoriaSeleccionada.set(null);
    this.formCategoria.reset({ nombre: '' });
  }

  guardarCategoria(): void {
    if (this.formCategoria.invalid) return;
    const data = this.formCategoria.getRawValue() as { nombre: string };
    const actual = this.categoriaSeleccionada();
    const req = actual ? this.categoriasSrv.actualizar(actual.id, data) : this.categoriasSrv.crear(data);
    req.subscribe({
      next: () => { this.nuevaCategoria(); this.cargarCategorias(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar la categoria'),
    });
  }

  eliminarCategoria(): void {
    const actual = this.categoriaSeleccionada();
    if (!actual) return;
    if (!confirm(`Eliminar la categoria "${actual.nombre}"? Esto falla si todavia tiene productos asociados.`)) return;
    this.categoriasSrv.eliminar(actual.id).subscribe({
      next: () => { this.nuevaCategoria(); this.cargarCategorias(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar la categoria'),
    });
  }

  // ---------- Productos: mantenimiento ----------
  seleccionarProducto(p: Producto): void {
    const yaSeleccionado = this.productoSeleccionado()?.id === p.id;
    if (yaSeleccionado) { this.nuevoProducto(); return; }
    this.productoSeleccionado.set(p);
    this.formProducto.reset({ categoria_id: String(p.categoria_id), nombre: p.nombre });
  }

  nuevoProducto(): void {
    this.productoSeleccionado.set(null);
    this.formProducto.reset({ categoria_id: '', nombre: '' });
  }

  guardarProducto(): void {
    if (this.formProducto.invalid) return;
    const raw = this.formProducto.getRawValue();
    const data = { categoria_id: Number(raw.categoria_id), nombre: raw.nombre! };
    const actual = this.productoSeleccionado();
    const req = actual ? this.productosSrv.actualizar(actual.id, data) : this.productosSrv.crear(data);
    req.subscribe({
      next: () => { this.nuevoProducto(); this.cargarProductos(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el producto'),
    });
  }

  eliminarProducto(): void {
    const actual = this.productoSeleccionado();
    if (!actual) return;
    if (!confirm(`Eliminar el producto "${actual.nombre}"?`)) return;
    this.productosSrv.eliminar(actual.id).subscribe({
      next: () => { this.nuevoProducto(); this.cargarProductos(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar el producto'),
    });
  }

  // ---------- Procesadores: mantenimiento ----------
  seleccionarProcesador(p: Procesador): void {
    const yaSeleccionado = this.procesadorSeleccionado()?.id === p.id;
    if (yaSeleccionado) { this.nuevoProcesador(); return; }
    this.procesadorSeleccionado.set(p);
    this.formProcesador.reset({ nombre: p.nombre });
  }

  nuevoProcesador(): void {
    this.procesadorSeleccionado.set(null);
    this.formProcesador.reset({ nombre: '' });
  }

  guardarProcesador(): void {
    if (this.formProcesador.invalid) return;
    const data = this.formProcesador.getRawValue() as { nombre: string };
    const actual = this.procesadorSeleccionado();
    const req = actual ? this.procesadoresSrv.actualizar(actual.id, data) : this.procesadoresSrv.crear(data);
    req.subscribe({
      next: () => { this.nuevoProcesador(); this.cargarProcesadores(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el procesador'),
    });
  }

  eliminarProcesador(): void {
    const actual = this.procesadorSeleccionado();
    if (!actual) return;
    if (!confirm(`Eliminar el procesador "${actual.nombre}"?`)) return;
    this.procesadoresSrv.eliminar(actual.id).subscribe({
      next: () => { this.nuevoProcesador(); this.cargarProcesadores(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar el procesador'),
    });
  }
}
