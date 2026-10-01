import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RolCatalogo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private base = `${environment.apiUrl}/roles`;
  constructor(private http: HttpClient) {}

  listar(): Observable<RolCatalogo[]> { return this.http.get<RolCatalogo[]>(this.base); }
  crear(data: { codigo: string; nombre: string }): Observable<RolCatalogo> { return this.http.post<RolCatalogo>(this.base, data); }
  actualizar(id: number, data: { nombre?: string; activo?: boolean }): Observable<RolCatalogo> { return this.http.put<RolCatalogo>(`${this.base}/${id}`, data); }
  eliminar(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
