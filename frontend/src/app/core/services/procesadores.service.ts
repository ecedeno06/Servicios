import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Procesador } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ProcesadoresService {
  private base = `${environment.apiUrl}/procesadores`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Procesador[]> { return this.http.get<Procesador[]>(this.base); }
  crear(data: { nombre: string }): Observable<Procesador> { return this.http.post<Procesador>(this.base, data); }
  actualizar(id: number, data: { nombre: string }): Observable<Procesador> { return this.http.put<Procesador>(`${this.base}/${id}`, data); }
  eliminar(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
