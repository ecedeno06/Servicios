import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TipoServicio } from '../models/models';

@Injectable({ providedIn: 'root' })
export class TiposServicioService {
  private base = `${environment.apiUrl}/tipos-servicio`;
  constructor(private http: HttpClient) {}

  listar(): Observable<TipoServicio[]> { return this.http.get<TipoServicio[]>(this.base); }
  obtener(id: string): Observable<TipoServicio> { return this.http.get<TipoServicio>(`${this.base}/${id}`); }
  crear(data: any): Observable<TipoServicio> { return this.http.post<TipoServicio>(this.base, data); }
  actualizar(id: string, data: any): Observable<TipoServicio> { return this.http.put<TipoServicio>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
