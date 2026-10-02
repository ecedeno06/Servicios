import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Proveedor } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ProveedoresService {
  private base = `${environment.apiUrl}/proveedores`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Proveedor[]> { return this.http.get<Proveedor[]>(this.base); }
  obtener(id: string): Observable<Proveedor> { return this.http.get<Proveedor>(`${this.base}/${id}`); }
  crear(data: Partial<Proveedor>): Observable<Proveedor> { return this.http.post<Proveedor>(this.base, data); }
  actualizar(id: string, data: Partial<Proveedor>): Observable<Proveedor> { return this.http.put<Proveedor>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<{ ok: boolean; mensaje: string }> { return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}`); }
}
