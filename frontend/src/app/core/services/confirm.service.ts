import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  titulo?: string;
  textoAceptar?: string;
  textoCancelar?: string;
  // true (default) = estilo rojo/destructivo -- la gran mayoria de los
  // confirm() de la app guardan una eliminacion o una accion irreversible.
  peligroso?: boolean;
}

interface ConfirmState {
  mensaje: string;
  titulo: string;
  textoAceptar: string;
  textoCancelar: string;
  peligroso: boolean;
  resolver: (valor: boolean) => void;
}

// Reemplazo del confirm() nativo del navegador por un modal propio,
// consistente con el resto de popups de la app (mismas clases
// .modal-overlay/.modal-card) -- ver ConfirmDialogComponent, montado una
// sola vez en el layout igual que ToastContainerComponent.
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  estado = signal<ConfirmState | null>(null);

  confirmar(mensaje: string, opciones: ConfirmOptions = {}): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.estado.set({
        mensaje,
        titulo: opciones.titulo ?? 'Confirmar accion',
        textoAceptar: opciones.textoAceptar ?? 'Aceptar',
        textoCancelar: opciones.textoCancelar ?? 'Cancelar',
        peligroso: opciones.peligroso ?? true,
        resolver: resolve,
      });
    });
  }

  responder(valor: boolean): void {
    this.estado()?.resolver(valor);
    this.estado.set(null);
  }
}
