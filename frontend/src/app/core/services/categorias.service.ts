import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Categoria } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CategoriasService {
  private base = `${environment.apiUrl}/categorias`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Categoria[]> { return this.http.get<Categoria[]>(this.base); }
  crear(data: { nombre: string }): Observable<Categoria> { return this.http.post<Categoria>(this.base, data); }
  actualizar(id: number, data: { nombre: string }): Observable<Categoria> { return this.http.put<Categoria>(`${this.base}/${id}`, data); }
  eliminar(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
