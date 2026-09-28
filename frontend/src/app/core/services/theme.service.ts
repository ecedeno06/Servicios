import { Injectable, effect, signal } from '@angular/core';

export type Tema = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'hs_tema';

// 'auto' (por defecto) no fija data-theme -- deja que decida
// prefers-color-scheme (ver styles.css). Al tocar el boton, queda fijo en
// 'light'/'dark' segun lo que se vea en ese momento, sin importar el
// sistema operativo de ahi en adelante.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  tema = signal<Tema>(this.leerGuardado());

  constructor() {
    effect(() => {
      const valor = this.tema();
      const root = document.documentElement;
      if (valor === 'auto') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', valor);
      }
      try {
        localStorage.setItem(STORAGE_KEY, valor);
      } catch {
        // localStorage puede fallar (navegacion privada, cuota) -- el tema
        // se sigue aplicando en esta sesion, solo no persiste.
      }
    });
  }

  alternar(): void {
    this.tema.set(this.esOscuroActivo() ? 'light' : 'dark');
  }

  esOscuroActivo(): boolean {
    const valor = this.tema();
    if (valor !== 'auto') return valor === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private leerGuardado(): Tema {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado === 'light' || guardado === 'dark') return guardado;
    } catch {
      // ignorado -- se usa 'auto' por defecto
    }
    return 'auto';
  }
}
