import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Contrato, ContratoServicio } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ContratosService {
  private base = `${environment.apiUrl}/contratos`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Contrato[]> { return this.http.get<Contrato[]>(this.base); }
  obtener(id: string): Observable<Contrato> { return this.http.get<Contrato>(`${this.base}/${id}`); }
  crear(data: any): Observable<Contrato> { return this.http.post<Contrato>(this.base, data); }
  actualizar(id: string, data: any): Observable<Contrato> { return this.http.put<Contrato>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }

  agregarServicio(contratoId: string, data: any): Observable<ContratoServicio> {
    return this.http.post<ContratoServicio>(`${this.base}/${contratoId}/servicios`, data);
  }
  actualizarServicio(contratoId: string, contratoServicioId: string, data: any): Observable<ContratoServicio> {
    return this.http.put<ContratoServicio>(`${this.base}/${contratoId}/servicios/${contratoServicioId}`, data);
  }
  eliminarServicio(contratoId: string, contratoServicioId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${contratoId}/servicios/${contratoServicioId}`);
  }
}
