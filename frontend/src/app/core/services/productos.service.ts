import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Producto } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private base = `${environment.apiUrl}/productos`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Producto[]> { return this.http.get<Producto[]>(this.base); }
  crear(data: { categoria_id: number; nombre: string }): Observable<Producto> { return this.http.post<Producto>(this.base, data); }
  actualizar(id: number, data: { categoria_id?: number; nombre?: string }): Observable<Producto> { return this.http.put<Producto>(`${this.base}/${id}`, data); }
  eliminar(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
