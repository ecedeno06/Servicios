import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AuthService } from '../../core/services/auth.service';
import { Usuario, Cliente, Rol } from '../../core/models/models';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit {
  usuarios = signal<Usuario[]>([]);
  clientes = signal<Cliente[]>([]);
  panelAbierto = signal(false);
  editando = signal<Usuario | null>(null);
  usuarioExistente = signal<{ nombre: string } | null>(null);

  form = this.fb.group({
    nombre: [''],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    rol: ['tecnico' as Rol],
    cliente_id: [''],
    activo: [true],
  });

  constructor(
    private fb: FormBuilder,
    private srv: UsuariosService,
    private clientesSrv: ClientesService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.clientesSrv.listar().subscribe((data) => this.clientes.set(data));
  }
  cargar(): void { this.srv.listar().subscribe((data) => this.usuarios.set(data)); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.usuarioExistente.set(null);
    this.form.reset({ rol: 'tecnico', cliente_id: '', activo: true });
    // nombre/password no son obligatorios aqui: si el email ya existe en el
    // sistema (otra empresa), el backend solo lo asocia a esta empresa (como
    // tecnico por defecto; el rol se ajusta despues editando o desde Empresas).
    this.panelAbierto.set(true);
  }

  abrirEditar(u: Usuario): void {
    this.editando.set(u);
    this.usuarioExistente.set(null);
    this.form.reset({ ...u, password: '', cliente_id: u.cliente_id ?? '' });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  onEmailBlur(): void {
    if (this.editando()) return;
    const email = this.form.get('email')?.value;
    if (!email || this.form.get('email')?.invalid) {
      this.usuarioExistente.set(null);
      return;
    }
    this.srv.buscarPorEmail(email).subscribe({
      next: (res) => this.usuarioExistente.set(res.existe ? { nombre: res.nombre! } : null),
      error: () => this.usuarioExistente.set(null),
    });
  }

  guardar(): void {
    if (this.form.invalid) return;
    const data: any = { ...this.form.getRawValue() };
    if (!data.password) delete data.password;
    if (this.usuarioExistente()) { delete data.nombre; delete data.password; }

    const actual = this.editando();
    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data);
    req.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el usuario'),
    });
  }

  eliminar(u: Usuario): void {
    if (!confirm(`Quitar a "${u.nombre}" de esta empresa?`)) return;
    this.srv.eliminar(u.id).subscribe({
      next: () => this.cargar(),
      error: (err) => alert(err?.error?.mensaje || 'No se pudo quitar al usuario'),
    });
  }
}
