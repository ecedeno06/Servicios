import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Empresa } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private base = `${environment.apiUrl}/empresas`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Empresa[]> { return this.http.get<Empresa[]>(this.base); }
  obtener(id: string): Observable<Empresa> { return this.http.get<Empresa>(`${this.base}/${id}`); }
  crear(data: any): Observable<Empresa> { return this.http.post<Empresa>(this.base, data); }
  actualizar(id: string, data: any): Observable<Empresa> { return this.http.put<Empresa>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
