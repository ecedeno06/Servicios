import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';

// Por defecto igual a los valores del backend (session-config los puede
// sobreescribir): 15 minutos de inactividad, avisando los ultimos 2.
const DEFAULT_INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const DEFAULT_WARNING_BEFORE_MS = 2 * 60 * 1000;
const DEFAULT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const EVENTOS_ACTIVIDAD = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const;

// Cierra la sesion sola tras un periodo sin actividad del usuario (mouse,
// teclado, scroll, tacto) -- avisa unos minutos antes con la posibilidad
// de seguir trabajando. Aparte, renueva el JWT cada tanto (independiente
// de la inactividad) para que la sesion no expire "sola" mientras la
// pestana sigue abierta y en uso. Portado del mismo diseno en agro 1.1.
@Injectable({ providedIn: 'root' })
export class InactividadService {
  mostrarAviso = signal(false);
  countdownText = signal('00:00');

  private inactivityLimitMs = DEFAULT_INACTIVITY_LIMIT_MS;
  private warningBeforeMs = DEFAULT_WARNING_BEFORE_MS;
  private refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS;

  private inicializado = false;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private expireTimestamp = 0;
  private boundResetTimer = () => this.resetInactivityTimer();

  constructor(private auth: AuthService) {}

  init(): void {
    if (this.inicializado) return;
    this.inicializado = true;

    this.auth.obtenerConfigSesion().subscribe({
      next: (cfg) => {
        this.inactivityLimitMs = cfg.inactivityLimitMs || DEFAULT_INACTIVITY_LIMIT_MS;
        this.warningBeforeMs = cfg.warningBeforeMs || DEFAULT_WARNING_BEFORE_MS;
        this.refreshIntervalMs = cfg.refreshIntervalMs || DEFAULT_REFRESH_INTERVAL_MS;
        this.resetInactivityTimer();
      },
      // Sin config del backend, se sigue con los valores por defecto.
      error: () => this.resetInactivityTimer(),
    });

    EVENTOS_ACTIVIDAD.forEach((evento) => document.addEventListener(evento, this.boundResetTimer, { passive: true }));
    this.refreshTimer = setInterval(() => this.renovar(), this.refreshIntervalMs);
  }

  cleanup(): void {
    this.inicializado = false;
    EVENTOS_ACTIVIDAD.forEach((evento) => document.removeEventListener(evento, this.boundResetTimer));
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.mostrarAviso.set(false);
  }

  // Mientras el aviso esta visible, moverse/tipear ya no lo descarta en
  // silencio -- solo "Continuar trabajando" (extenderSesion) lo hace.
  private resetInactivityTimer(): void {
    if (this.mostrarAviso()) return;

    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

    const tiempoHastaAviso = this.inactivityLimitMs - this.warningBeforeMs;
    this.warningTimer = setTimeout(() => this.mostrarAdvertencia(), tiempoHastaAviso);
    this.inactivityTimer = setTimeout(() => this.auth.logout('inactividad'), this.inactivityLimitMs);
  }

  private mostrarAdvertencia(): void {
    this.mostrarAviso.set(true);
    this.expireTimestamp = Date.now() + this.warningBeforeMs;
    this.actualizarCountdown();
    this.countdownInterval = setInterval(() => this.actualizarCountdown(), 1000);
  }

  private actualizarCountdown(): void {
    const restanteMs = Math.max(0, this.expireTimestamp - Date.now());
    const totalSegundos = Math.floor(restanteMs / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    this.countdownText.set(`${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`);
    if (restanteMs <= 0 && this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  extenderSesion(): void {
    this.mostrarAviso.set(false);
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.resetInactivityTimer();
    this.renovar();
  }

  private renovar(): void {
    this.auth.renovarSesion().subscribe({
      next: () => {},
      // Un 401 aqui ya dispara auth.logout('token_invalido') desde el
      // interceptor -- no hace falta manejarlo de nuevo.
      error: () => {},
    });
  }
}
