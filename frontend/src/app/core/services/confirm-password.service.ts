import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface ConfirmPasswordOptions {
  titulo?: string;
  textoAceptar?: string;
  textoCancelar?: string;
}

interface ConfirmPasswordState {
  mensaje: string;
  titulo: string;
  textoAceptar: string;
  textoCancelar: string;
  password: string;
  error: string | null;
  enviando: boolean;
}

// Reemplazo de ConfirmService para eliminar registros: pedido explicito de
// que TODO delete pida la contrasena de la sesion actual, no solo un
// si/no. En vez de que cada componente arme su propio FormGroup + signals
// de "pendiente de eliminar" (como hacian carritos/equipos-asignados antes
// de esto, cada uno por su lado), este servicio centraliza el modal: recibe
// la "accion" real (la llamada http que borra, ya con la contrasena
// adentro) y la reintenta sin cerrar el popup si falla -- igual que el
// patron original, pero una sola vez en vez de duplicado por feature.
@Injectable({ providedIn: 'root' })
export class ConfirmPasswordService {
  estado = signal<ConfirmPasswordState | null>(null);
  private accion: ((password: string) => Observable<unknown>) | null = null;
  private resolver: ((ok: boolean) => void) | null = null;

  confirmar(mensaje: string, accion: (password: string) => Observable<unknown>, opciones: ConfirmPasswordOptions = {}): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.accion = accion;
      this.resolver = resolve;
      this.estado.set({
        mensaje,
        titulo: opciones.titulo ?? 'Confirmar eliminacion',
        textoAceptar: opciones.textoAceptar ?? 'Eliminar',
        textoCancelar: opciones.textoCancelar ?? 'Cancelar',
        password: '',
        error: null,
        enviando: false,
      });
    });
  }

  actualizarPassword(password: string): void {
    this.estado.update((s) => (s ? { ...s, password, error: null } : s));
  }

  cancelar(): void {
    if (this.estado()?.enviando) return;
    this.resolver?.(false);
    this.limpiar();
  }

  enviar(): void {
    const s = this.estado();
    if (!s || !s.password || s.enviando || !this.accion) return;
    this.estado.set({ ...s, enviando: true, error: null });
    this.accion(s.password).subscribe({
      next: () => {
        this.resolver?.(true);
        this.limpiar();
      },
      error: (err) => {
        this.estado.update((st) =>
          st ? { ...st, enviando: false, error: err?.error?.mensaje || 'No se pudo completar la accion' } : st
        );
      },
    });
  }

  private limpiar(): void {
    this.estado.set(null);
    this.accion = null;
    this.resolver = null;
  }
}
