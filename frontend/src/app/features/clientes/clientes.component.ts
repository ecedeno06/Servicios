import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientesService } from '../../core/services/clientes.service';
import { AuthService } from '../../core/services/auth.service';
import { Cliente } from '../../core/models/models';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.css',
})
export class ClientesComponent implements OnInit {
  clientes = signal<Cliente[]>([]);
  panelAbierto = signal(false);
  editando = signal<Cliente | null>(null);

  // Filtro por columna (uno por cada encabezado de la tabla)
  filtroNombre = signal('');
  filtroIdentificacion = signal('');
  filtroEmail = signal('');
  filtroTelefono = signal('');
  filtroEstado = signal('');

  hayFiltros = computed(() =>
    !!(this.filtroNombre() || this.filtroIdentificacion() || this.filtroEmail() || this.filtroTelefono() || this.filtroEstado())
  );

  limpiarFiltros(): void {
    this.filtroNombre.set('');
    this.filtroIdentificacion.set('');
    this.filtroEmail.set('');
    this.filtroTelefono.set('');
    this.filtroEstado.set('');
  }

  clientesFiltrados = computed(() => {
    const nombre = this.filtroNombre().trim().toLowerCase();
    const identificacion = this.filtroIdentificacion().trim().toLowerCase();
    const email = this.filtroEmail().trim().toLowerCase();
    const telefono = this.filtroTelefono().trim().toLowerCase();
    const estado = this.filtroEstado().trim().toLowerCase();

    return this.clientes().filter((c) => {
      if (nombre && !(c.nombre ?? '').toLowerCase().includes(nombre)) return false;
      if (identificacion && !(c.identificacion ?? '').toLowerCase().includes(identificacion)) return false;
      if (email && !(c.email ?? '').toLowerCase().includes(email)) return false;
      if (telefono && !(c.telefono ?? '').toLowerCase().includes(telefono)) return false;
      if (estado && !(c.activo ? 'activo' : 'inactivo').includes(estado)) return false;
      return true;
    });
  });

  columnaOrden = signal<keyof Cliente | null>(null);
  direccionOrden = signal<'asc' | 'desc'>('asc');

  clientesOrdenados = computed(() => {
    const columna = this.columnaOrden();
    const filas = [...this.clientesFiltrados()];
    if (!columna) return filas;
    const direccion = this.direccionOrden() === 'asc' ? 1 : -1;
    return filas.sort((a, b) => {
      const valorA = a[columna];
      const valorB = b[columna];
      if (valorA == null && valorB == null) return 0;
      if (valorA == null) return -1 * direccion;
      if (valorB == null) return 1 * direccion;
      if (typeof valorA === 'boolean' && typeof valorB === 'boolean') return (Number(valorA) - Number(valorB)) * direccion;
      return String(valorA).localeCompare(String(valorB)) * direccion;
    });
  });

  ordenarPor(columna: keyof Cliente): void {
    if (this.columnaOrden() === columna) {
      this.direccionOrden.set(this.direccionOrden() === 'asc' ? 'desc' : 'asc');
    } else {
      this.columnaOrden.set(columna);
      this.direccionOrden.set('asc');
    }
  }

  indicadorOrden(columna: keyof Cliente): string {
    if (this.columnaOrden() !== columna) return '';
    return this.direccionOrden() === 'asc' ? ' ▲' : ' ▼';
  }

  form = this.fb.group({
    nombre: ['', Validators.required],
    identificacion: [''],
    email: [''],
    telefono: [''],
    direccion: [''],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: ClientesService, public auth: AuthService) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void { this.srv.listar().subscribe((data) => this.clientes.set(data)); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ activo: true });
    this.panelAbierto.set(true);
  }

  abrirEditar(c: Cliente): void {
    this.editando.set(c);
    this.form.reset({ ...c });
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const data = this.form.getRawValue();
    const actual = this.editando();

    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data);
    req.subscribe(() => { this.cerrarPanel(); this.cargar(); });
  }

  eliminar(c: Cliente): void {
    if (!confirm(`Eliminar al cliente "${c.nombre}"? Esta accion no se puede deshacer.`)) return;
    this.srv.eliminar(c.id).subscribe(() => this.cargar());
  }
}
