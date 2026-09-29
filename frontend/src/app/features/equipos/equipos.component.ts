import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriasService } from '../../core/services/categorias.service';
import { ProductosService } from '../../core/services/productos.service';
import { Categoria, Producto } from '../../core/models/models';

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './equipos.component.html',
  styleUrl: './equipos.component.css',
})
export class EquiposComponent implements OnInit {
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);

  // ---------- Categorias ----------
  panelCategoriaAbierto = signal(false);
  editandoCategoria = signal<Categoria | null>(null);
  filtroCategoria = signal('');

  formCategoria = this.fb.group({ nombre: ['', Validators.required] });

  categoriasFiltradas = computed(() => {
    const f = this.filtroCategoria().trim().toLowerCase();
    if (!f) return this.categorias();
    return this.categorias().filter((c) => c.nombre.toLowerCase().includes(f));
  });

  // ---------- Productos ----------
  panelProductoAbierto = signal(false);
  editandoProducto = signal<Producto | null>(null);
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

  constructor(
    private fb: FormBuilder,
    private categoriasSrv: CategoriasService,
    private productosSrv: ProductosService
  ) {}

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarProductos();
  }

  cargarCategorias(): void { this.categoriasSrv.listar().subscribe((data) => this.categorias.set(data)); }
  cargarProductos(): void { this.productosSrv.listar().subscribe((data) => this.productos.set(data)); }

  limpiarFiltrosProducto(): void {
    this.filtroProductoCategoria.set('');
    this.filtroProductoNombre.set('');
  }

  // ---------- Categorias: acciones ----------
  abrirNuevaCategoria(): void {
    this.editandoCategoria.set(null);
    this.formCategoria.reset();
    this.panelCategoriaAbierto.set(true);
  }

  abrirEditarCategoria(c: Categoria): void {
    this.editandoCategoria.set(c);
    this.formCategoria.reset({ nombre: c.nombre });
    this.panelCategoriaAbierto.set(true);
  }

  cerrarPanelCategoria(): void { this.panelCategoriaAbierto.set(false); }

  guardarCategoria(): void {
    if (this.formCategoria.invalid) return;
    const data = this.formCategoria.getRawValue() as { nombre: string };
    const actual = this.editandoCategoria();
    const req = actual ? this.categoriasSrv.actualizar(actual.id, data) : this.categoriasSrv.crear(data);
    req.subscribe({
      next: () => { this.cerrarPanelCategoria(); this.cargarCategorias(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar la categoria'),
    });
  }

  eliminarCategoria(c: Categoria): void {
    if (!confirm(`Eliminar la categoria "${c.nombre}"? Esto falla si todavia tiene productos asociados.`)) return;
    this.categoriasSrv.eliminar(c.id).subscribe({
      next: () => this.cargarCategorias(),
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar la categoria'),
    });
  }

  // ---------- Productos: acciones ----------
  abrirNuevoProducto(): void {
    this.editandoProducto.set(null);
    this.formProducto.reset({ categoria_id: '', nombre: '' });
    this.panelProductoAbierto.set(true);
  }

  abrirEditarProducto(p: Producto): void {
    this.editandoProducto.set(p);
    this.formProducto.reset({ categoria_id: String(p.categoria_id), nombre: p.nombre });
    this.panelProductoAbierto.set(true);
  }

  cerrarPanelProducto(): void { this.panelProductoAbierto.set(false); }

  guardarProducto(): void {
    if (this.formProducto.invalid) return;
    const raw = this.formProducto.getRawValue();
    const data = { categoria_id: Number(raw.categoria_id), nombre: raw.nombre! };
    const actual = this.editandoProducto();
    const req = actual ? this.productosSrv.actualizar(actual.id, data) : this.productosSrv.crear(data);
    req.subscribe({
      next: () => { this.cerrarPanelProducto(); this.cargarProductos(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el producto'),
    });
  }

  eliminarProducto(p: Producto): void {
    if (!confirm(`Eliminar el producto "${p.nombre}"?`)) return;
    this.productosSrv.eliminar(p.id).subscribe({
      next: () => this.cargarProductos(),
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar el producto'),
    });
  }
}
