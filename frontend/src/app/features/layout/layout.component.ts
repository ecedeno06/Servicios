import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { interval } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { NotificacionComentario } from '../../core/models/models';

const SIDEBAR_STORAGE_KEY = 'hs_sidebar_colapsado';
const INTERVALO_NOTIFICACIONES_MS = 60000;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit {
  anioActual = new Date().getFullYear();
  menuAbierto = signal(false);
  panelPasswordAbierto = signal(false);
  sidebarColapsado = signal(localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1');

  noLeidos = signal(0);
  notifAbiertas = signal(false);
  notificaciones = signal<NotificacionComentario[]>([]);

  passwordForm = this.fb.group(
    {
      password_actual: ['', Validators.required],
      password_nueva: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmar: ['', Validators.required],
    },
    { validators: passwordsCoincidenValidator }
  );

  constructor(
    public auth: AuthService,
    private fb: FormBuilder,
    private horasSrv: RegistroHorasService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarNoLeidos();
    // Sondeo simple -- este proyecto no tiene websockets/SSE.
    interval(INTERVALO_NOTIFICACIONES_MS).subscribe(() => this.cargarNoLeidos());
  }

  private cargarNoLeidos(): void {
    this.horasSrv.notificacionesNoLeidas().subscribe((r) => this.noLeidos.set(r.no_leidos));
  }

  toggleNotificaciones(): void {
    const abrir = !this.notifAbiertas();
    this.notifAbiertas.set(abrir);
    if (abrir) this.horasSrv.listarNotificaciones().subscribe((data) => this.notificaciones.set(data));
  }

  irAComentario(n: NotificacionComentario): void {
    this.notifAbiertas.set(false);
    this.horasSrv.marcarComentariosVistos(n.registro_horas_id).subscribe(() => this.cargarNoLeidos());
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

  onArchivoSeleccionado(event: Event): void {
    this.menuAbierto.set(false);
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen valido.');
      return;
    }

    redimensionarImagen(archivo, 200).then((base64) => {
      this.auth.actualizarAvatar(base64).subscribe({
        next: () => {},
        error: (err) => alert(err?.error?.mensaje || 'No se pudo actualizar la foto de perfil'),
      });
    });

    input.value = '';
  }

  abrirCambioPassword(): void {
    this.menuAbierto.set(false);
    this.passwordForm.reset();
    this.panelPasswordAbierto.set(true);
  }

  cerrarCambioPassword(): void { this.panelPasswordAbierto.set(false); }

  guardarPassword(): void {
    if (this.passwordForm.invalid) return;
    const { password_actual, password_nueva } = this.passwordForm.getRawValue();
    this.auth.cambiarPassword(password_actual!, password_nueva!).subscribe({
      next: () => {
        this.cerrarCambioPassword();
        alert('Contrasena actualizada correctamente.');
      },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo cambiar la contrasena'),
    });
  }
}

function passwordsCoincidenValidator(group: AbstractControl): ValidationErrors | null {
  const nueva = group.get('password_nueva')?.value;
  const confirmar = group.get('password_confirmar')?.value;
  if (!nueva || !confirmar) return null;
  return nueva === confirmar ? null : { noCoincide: true };
}

function redimensionarImagen(archivo: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error);
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        const escala = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}
