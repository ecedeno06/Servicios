import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EquipoAsignado } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EquiposAsignadosService {
  private base = `${environment.apiUrl}/equipos-asignados`;
  constructor(private http: HttpClient) {}

  listar(): Observable<EquipoAsignado[]> { return this.http.get<EquipoAsignado[]>(this.base); }
  crear(data: any): Observable<EquipoAsignado> { return this.http.post<EquipoAsignado>(this.base, data); }
  actualizar(id: string, data: any): Observable<EquipoAsignado> { return this.http.put<EquipoAsignado>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
