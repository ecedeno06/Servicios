import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { interval } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { PoliticaPasswordService } from '../../core/services/politicaPassword.service';
import { ThemeService } from '../../core/services/theme.service';
import { InactividadService } from '../../core/services/inactividad.service';
import { SelectorFotoComponent } from '../../core/components/selector-foto/selector-foto.component';
import { PasswordChecklistComponent } from '../../core/components/password-checklist/password-checklist.component';
import { AvisoInactividadComponent } from '../../core/components/aviso-inactividad/aviso-inactividad.component';
import { passwordsCoincidenValidator, construirValidadorPolitica, construirValidadorPista, generarPasswordSegunPolitica } from '../../core/utils/password.util';
import { NotificacionComentario, PoliticaPassword } from '../../core/models/models';

const SIDEBAR_STORAGE_KEY = 'hs_sidebar_colapsado';
const SESSION_START_KEY = 'hs_session_start_time';
const INTERVALO_NOTIFICACIONES_MS = 60000;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive, SelectorFotoComponent, PasswordChecklistComponent, AvisoInactividadComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit, OnDestroy {
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

  // Cronometro de sesion activa (cuenta hacia arriba desde el login, no
  // desde que se abrio esta pestana -- persiste en localStorage para
  // sobrevivir a un F5). Se pinta en rojo/parpadeando cuando el aviso de
  // inactividad esta visible (ver template).
  tiempoSesionTexto = signal('00:00:00');
  private tiempoSesionInterval: ReturnType<typeof setInterval> | null = null;

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
    public menu: MenuService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private horasSrv: RegistroHorasService,
    private politicaPasswordSrv: PoliticaPasswordService,
    private router: Router,
    public theme: ThemeService,
    public inactividad: InactividadService
  ) {}

  get noLeidos() { return this.horasSrv.noLeidos; }

  // El rol/empresa activa no cambia durante la sesion (un super-admin que
  // quiere otra empresa vuelve a pasar por el selector de login), asi que
  // basta con cargar el menu/permisos una vez al entrar al shell.
  private readonly iconos: Record<string, string> = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    contratos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>',
    horas: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    reportes: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
    clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tipos_servicio: '<path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.82 0L2 12V2h10z"/><circle cx="7" cy="7" r="1.3" fill="currentColor" stroke="none"/>',
    usuarios: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    equipos_asignados: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    servicios_proveedores: '<path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12"/>',
    auditoria_sesiones: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><circle cx="12" cy="11" r="2.5"/>',

    empresas: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>',
    politica_password: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    equipos: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    roles_permisos: '<path d="M9 12l2 2 4-4"/><path d="M12 3a9 9 0 0 0-9 9v3a9 9 0 0 0 18 0v-3a9 9 0 0 0-9-9z"/>',
  };

  iconoSvg(codigo: string | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.iconos[codigo || ''] || '');
  }

  ngOnInit(): void {
    // El menu/mapa de permisos ya quedo cargado por authGuard antes de que
    // esta ruta (hija de layout) se activara -- ver su comentario.
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

    this.inactividad.init();
    this.iniciarCronometroSesion();
  }

  ngOnDestroy(): void {
    this.inactividad.cleanup();
    if (this.tiempoSesionInterval) clearInterval(this.tiempoSesionInterval);
  }

  private iniciarCronometroSesion(): void {
    let inicio = Number(localStorage.getItem(SESSION_START_KEY));
    if (!inicio || isNaN(inicio)) {
      inicio = Date.now();
      localStorage.setItem(SESSION_START_KEY, String(inicio));
    }
    const actualizar = () => {
      const totalSegundos = Math.floor((Date.now() - inicio) / 1000);
      const horas = Math.floor(totalSegundos / 3600);
      const minutos = Math.floor((totalSegundos % 3600) / 60);
      const segundos = totalSegundos % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      this.tiempoSesionTexto.set(`${pad(horas)}:${pad(minutos)}:${pad(segundos)}`);
    };
    actualizar();
    this.tiempoSesionInterval = setInterval(actualizar, 1000);
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
