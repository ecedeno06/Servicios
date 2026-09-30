import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AuthService } from '../../core/services/auth.service';
import { PoliticaPasswordService } from '../../core/services/politicaPassword.service';
import { Usuario, Cliente, Rol, PoliticaPassword } from '../../core/models/models';
import { generarPasswordSegunPolitica } from '../../core/utils/password.util';

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
  verPassword = signal(false);
  politica = signal<PoliticaPassword | null>(null);
  reseteandoId = signal<string | null>(null);

  form = this.fb.group({
    nombre: [''],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    rol: ['tecnico' as Rol],
    cliente_id: [''],
    activo: [true],
    es_super_admin: [false],
  });

  constructor(
    private fb: FormBuilder,
    private srv: UsuariosService,
    private clientesSrv: ClientesService,
    private politicaPasswordSrv: PoliticaPasswordService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.clientesSrv.listar().subscribe((data) => this.clientes.set(data));
    this.politicaPasswordSrv.obtener().subscribe({
      next: (p) => this.politica.set(p),
      error: () => {},
    });
  }
  cargar(): void { this.srv.listar().subscribe((data) => this.usuarios.set(data)); }

  abrirNuevo(): void {
    this.editando.set(null);
    this.usuarioExistente.set(null);
    this.verPassword.set(false);
    this.form.reset({ rol: 'tecnico', cliente_id: '', activo: true, es_super_admin: false });
    this.form.get('es_super_admin')?.enable();
    // nombre/password no son obligatorios aqui: si el email ya existe en el
    // sistema (otra empresa), el backend solo lo asocia a esta empresa (como
    // tecnico por defecto; el rol se ajusta despues editando o desde Empresas).
    this.panelAbierto.set(true);
  }

  abrirEditar(u: Usuario): void {
    this.editando.set(u);
    this.usuarioExistente.set(null);
    this.verPassword.set(false);
    this.form.reset({ ...u, password: '', cliente_id: u.cliente_id ?? '' });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    // Un super-admin no puede quitarse el permiso a si mismo (el backend
    // tambien lo bloquea) -- se deshabilita el FormControl, no solo el
    // atributo HTML, porque la directiva de reactive forms pisaria un
    // [attr.disabled] puesto directamente en el template.
    if (u.id === this.auth.usuario()?.id) {
      this.form.get('es_super_admin')?.disable();
    } else {
      this.form.get('es_super_admin')?.enable();
    }
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  generarPassword(): void {
    const pol = this.politica();
    const nueva = pol ? generarPasswordSegunPolitica(pol) : Math.random().toString(36).slice(-10);
    this.form.get('password')?.setValue(nueva);
    this.form.get('password')?.markAsTouched();
    this.verPassword.set(true);
    navigator.clipboard?.writeText(nueva).catch(() => {});
  }

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

  resetearPassword(u: Usuario): void {
    if (!confirm(`Enviar un enlace para restablecer la contrasena a ${u.nombre} (${u.email})? Debera definir una nueva contrasena antes de poder usar el sistema.`)) return;
    this.reseteandoId.set(u.id);
    this.srv.resetearPassword(u.id).subscribe({
      next: (res) => {
        this.reseteandoId.set(null);
        alert(res.mensaje);
      },
      error: (err) => {
        this.reseteandoId.set(null);
        alert(err?.error?.mensaje || 'No se pudo enviar el enlace de restablecimiento');
      },
    });
  }
}
