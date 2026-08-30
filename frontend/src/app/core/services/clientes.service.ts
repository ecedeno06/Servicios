import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cliente } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private base = `${environment.apiUrl}/clientes`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Cliente[]> { return this.http.get<Cliente[]>(this.base); }
  obtener(id: string): Observable<Cliente> { return this.http.get<Cliente>(`${this.base}/${id}`); }
  crear(data: any): Observable<Cliente> { return this.http.post<Cliente>(this.base, data); }
  actualizar(id: string, data: any): Observable<Cliente> { return this.http.put<Cliente>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
