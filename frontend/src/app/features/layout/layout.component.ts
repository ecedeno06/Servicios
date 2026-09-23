import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { interval } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { PoliticaPasswordService } from '../../core/services/politicaPassword.service';
import { SelectorFotoComponent } from '../../core/components/selector-foto/selector-foto.component';
import { PasswordChecklistComponent } from '../../core/components/password-checklist/password-checklist.component';
import { passwordsCoincidenValidator, construirValidadorPolitica, construirValidadorPista, generarPasswordSegunPolitica } from '../../core/utils/password.util';
import { NotificacionComentario, PoliticaPassword } from '../../core/models/models';

const SIDEBAR_STORAGE_KEY = 'hs_sidebar_colapsado';
const INTERVALO_NOTIFICACIONES_MS = 60000;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive, SelectorFotoComponent, PasswordChecklistComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit {
  anioActual = new Date().getFullYear();
  menuAbierto = signal(false);
  panelPasswordAbierto = signal(false);
  verPasswordNueva = signal(false);
  verPasswordConfirmar = signal(false);
  passwordGenerada = signal(false);
  // Un admin marco esta cuenta con debe_cambiar_password (al crearla o al
  // resetearle la contrasena) -- se fuerza el formulario, sin poder
  // cancelarlo, hasta que el usuario ponga una contrasena propia.
  cambioPasswordObligatorio = computed(() => !!this.auth.usuario()?.debe_cambiar_password);
  sidebarColapsado = signal(localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1');

  notifAbiertas = signal(false);
  notificaciones = signal<NotificacionComentario[]>([]);

  // Se completa en ngOnInit (GET publico) -- hasta entonces el formulario
  // solo valida "required"/coincidencia, sin la politica todavia.
  politica = signal<PoliticaPassword | null>(null);

  passwordForm = this.fb.group(
    {
      password_actual: ['', Validators.required],
      password_nueva: ['', [Validators.required]],
      password_confirmar: ['', Validators.required],
      pista: [''],
    },
    { validators: passwordsCoincidenValidator }
  );

  constructor(
    public auth: AuthService,
    private fb: FormBuilder,
    private horasSrv: RegistroHorasService,
    private politicaPasswordSrv: PoliticaPasswordService,
    private router: Router
  ) {}

  get noLeidos() { return this.horasSrv.noLeidos; }

  ngOnInit(): void {
    this.horasSrv.refrescarNoLeidos();
    // Sondeo simple -- este proyecto no tiene websockets/SSE.
    interval(INTERVALO_NOTIFICACIONES_MS).subscribe(() => this.horasSrv.refrescarNoLeidos());

    this.politicaPasswordSrv.obtener().subscribe({
      next: (p) => {
        this.politica.set(p);
        this.passwordForm.get('password_nueva')?.addValidators(construirValidadorPolitica(p));
        this.passwordForm.addValidators(construirValidadorPista(p));
        this.passwordForm.get('password_nueva')?.updateValueAndValidity();
        this.passwordForm.updateValueAndValidity();
      },
      error: () => {}, // sin la politica, el formulario sigue funcionando con las reglas base (required/coincidencia)
    });
  }

  toggleNotificaciones(): void {
    const abrir = !this.notifAbiertas();
    this.notifAbiertas.set(abrir);
    if (abrir) this.horasSrv.listarNotificaciones().subscribe((data) => this.notificaciones.set(data));
  }

  irAComentario(n: NotificacionComentario): void {
    this.notifAbiertas.set(false);
    this.horasSrv.marcarComentariosVistos(n.registro_horas_id).subscribe();
    this.router.navigate(['/horas'], { queryParams: { registro_id: n.registro_horas_id } });
  }

  toggleSidebar(): void {
    const nuevo = !this.sidebarColapsado();
    this.sidebarColapsado.set(nuevo);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, nuevo ? '1' : '0');
  }

  iniciales(): string {
    const nombre = this.auth.usuario()?.nombre || '';
    return nombre
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }

  onFotoPerfilCambiada(base64: string): void {
    this.auth.actualizarAvatar(base64).subscribe({
      next: () => {},
      error: (err) => alert(err?.error?.mensaje || 'No se pudo actualizar la foto de perfil'),
    });
  }

  eliminarFotoPerfil(): void {
    this.menuAbierto.set(false);
    if (!confirm('Eliminar tu foto de perfil?')) return;
    this.auth.actualizarAvatar(null).subscribe({
      next: () => {},
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar la foto de perfil'),
    });
  }

  // El selector de foto ya pregunta su propia confirmacion antes de emitir
  // esto -- no se vuelve a confirmar aqui (a diferencia de
  // eliminarFotoPerfil(), llamado directo desde el item de menu).
  onFotoPerfilEliminada(): void {
    this.auth.actualizarAvatar(null).subscribe({
      next: () => {},
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar la foto de perfil'),
    });
  }

  abrirCambioPassword(): void {
    this.menuAbierto.set(false);
    this.passwordForm.reset();
    this.verPasswordNueva.set(false);
    this.verPasswordConfirmar.set(false);
    this.passwordGenerada.set(false);
    this.panelPasswordAbierto.set(true);
  }

  generarPassword(): void {
    const pol = this.politica();
    if (!pol) return;
    const nueva = generarPasswordSegunPolitica(pol);
    this.passwordForm.patchValue({ password_nueva: nueva, password_confirmar: nueva });
    this.passwordForm.get('password_nueva')?.markAsTouched();
    this.passwordForm.get('password_confirmar')?.markAsTouched();
    this.verPasswordNueva.set(true);
    this.verPasswordConfirmar.set(true);
    this.passwordGenerada.set(true);
    navigator.clipboard?.writeText(nueva).catch(() => {});
  }

  cerrarCambioPassword(): void {
    if (this.cambioPasswordObligatorio()) return;
    this.panelPasswordAbierto.set(false);
  }

  guardarPassword(): void {
    if (this.passwordForm.invalid) return;
    const { password_actual, password_nueva, pista } = this.passwordForm.getRawValue();
    // Si se deja en blanco, no se toca la pista ya guardada (undefined).
    const pistaTexto = pista?.trim() ? pista.trim() : undefined;
    this.auth.cambiarPassword(password_actual!, password_nueva!, pistaTexto).subscribe({
      next: () => {
        this.cerrarCambioPassword();
        alert('Contrasena actualizada correctamente.');
      },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo cambiar la contrasena'),
    });
  }
}
