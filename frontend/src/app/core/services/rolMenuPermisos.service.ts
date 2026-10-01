import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConcesionMatriz } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RolMenuPermisosService {
  private base = `${environment.apiUrl}/rol-menu-permisos`;
  constructor(private http: HttpClient) {}

  obtenerDeRol(rolId: number): Observable<ConcesionMatriz[]> { return this.http.get<ConcesionMatriz[]>(`${this.base}/${rolId}`); }
  guardarDeRol(rolId: number, concesiones: { menuId: number; permisoId: number }[]): Observable<{ mensaje: string; total: number }> {
    return this.http.post<{ mensaje: string; total: number }>(this.base, { rolId, concesiones });
  }
}
