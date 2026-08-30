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

  filtroTexto = signal('');
  filtro = signal('');

  clientesFiltrados = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return this.clientes();
    return this.clientes().filter((c) =>
      [c.nombre, c.identificacion, c.email, c.telefono]
        .some((campo) => (campo ?? '').toLowerCase().includes(texto))
    );
  });

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

  aplicarFiltro(): void { this.filtro.set(this.filtroTexto()); }
  limpiarFiltro(): void { this.filtroTexto.set(''); this.filtro.set(''); }

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
