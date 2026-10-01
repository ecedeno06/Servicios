import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MapaPermisos, MenuItem } from '../models/models';

// Fuente de verdad del sidebar y de los guards de ruta: se carga una vez
// al entrar al shell autenticado (el rol/empresa activa ya no cambia
// durante la sesion, ver layout.component.ts) y se consulta en memoria
// desde ahi -- nada de roles hardcodeados en el template.
@Injectable({ providedIn: 'root' })
export class MenuService {
  menu = signal<MenuItem[]>([]);
  private permisos = signal<MapaPermisos>({});

  constructor(private http: HttpClient) {}

  cargar(): void {
    this.http.get<MenuItem[]>(`${environment.apiUrl}/menu`).subscribe((data) => this.menu.set(data));
    this.http.get<MapaPermisos>(`${environment.apiUrl}/mis-permisos`).subscribe((data) => this.permisos.set(data));
  }

  limpiar(): void {
    this.menu.set([]);
    this.permisos.set({});
  }

  tienePermiso(menuCodigo: string, permisoCodigo: string = 'ver'): boolean {
    return !!this.permisos()[menuCodigo]?.includes(permisoCodigo);
  }
}
