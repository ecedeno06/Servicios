import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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
  private cargadoFlag = false;

  constructor(private http: HttpClient) {}

  estaCargado(): boolean {
    return this.cargadoFlag;
  }

  // authGuard espera a que esto termine antes de dejar pasar a cualquier
  // ruta hija (ver authGuard) -- si se disparara sin esperar (como antes,
  // de un ngOnInit que corre despues de que el guard del hijo ya
  // resolvio), permisoGuard evaluaria con el mapa de permisos todavia
  // vacio y, para cualquier usuario que no sea super-admin, denegaria y
  // redirigiria de vuelta a si mismo en un bucle infinito.
  cargar(): Observable<void> {
    return forkJoin([
      this.http.get<MenuItem[]>(`${environment.apiUrl}/menu`),
      this.http.get<MapaPermisos>(`${environment.apiUrl}/mis-permisos`),
    ]).pipe(
      tap(([menuData, permisosData]) => {
        this.menu.set(menuData);
        this.permisos.set(permisosData);
        this.cargadoFlag = true;
      }),
      map(() => void 0)
    );
  }

  limpiar(): void {
    this.menu.set([]);
    this.permisos.set({});
    this.cargadoFlag = false;
  }

  tienePermiso(menuCodigo: string, permisoCodigo: string = 'ver'): boolean {
    return !!this.permisos()[menuCodigo]?.includes(permisoCodigo);
  }
}
