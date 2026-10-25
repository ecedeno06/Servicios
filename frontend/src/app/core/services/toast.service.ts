import { Injectable, signal } from '@angular/core';

// Reemplaza alert() en toda la app por una notificacion "toast" propia,
// apilable y auto-descartable -- mas profesional que el dialogo nativo
// del navegador (que ademas bloquea la pestana y muestra la URL del
// sitio). Montado una sola vez en LayoutComponent via <app-toast-container>.
export type TipoToast = 'exito' | 'error' | 'advertencia' | 'info';

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

const DURACION_MS: Record<TipoToast, number> = {
  exito: 4000,
  info: 5000,
  advertencia: 6000,
  // Los errores quedan mas tiempo -- suelen requerir leer con calma que
  // paso y decidir que hacer, no solo confirmar que algo funciono.
  error: 8000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private contador = 0;
  toasts = signal<Toast[]>([]);

  private mostrar(tipo: TipoToast, mensaje: string): void {
    const id = ++this.contador;
    this.toasts.update((arr) => [...arr, { id, tipo, mensaje }]);
    setTimeout(() => this.cerrar(id), DURACION_MS[tipo]);
  }

  exito(mensaje: string): void { this.mostrar('exito', mensaje); }
  error(mensaje: string): void { this.mostrar('error', mensaje); }
  advertencia(mensaje: string): void { this.mostrar('advertencia', mensaje); }
  info(mensaje: string): void { this.mostrar('info', mensaje); }

  cerrar(id: number): void {
    this.toasts.update((arr) => arr.filter((t) => t.id !== id));
  }
}
