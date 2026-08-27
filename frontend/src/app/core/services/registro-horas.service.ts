import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConsumoHoras, RegistroHora } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RegistroHorasService {
  private base = `${environment.apiUrl}/horas`;
  constructor(private http: HttpClient) {}

  listar(filtros: Record<string, string> = {}): Observable<RegistroHora[]> {
    const params = new URLSearchParams(filtros).toString();
    return this.http.get<RegistroHora[]>(`${this.base}${params ? '?' + params : ''}`);
  }
  crear(data: any): Observable<RegistroHora> { return this.http.post<RegistroHora>(this.base, data); }
  actualizar(id: string, data: any): Observable<RegistroHora> { return this.http.put<RegistroHora>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
  consumoGeneral(): Observable<ConsumoHoras[]> { return this.http.get<ConsumoHoras[]>(`${this.base}/consumo`); }
  consumoPorContrato(contratoId: string): Observable<ConsumoHoras[]> {
    return this.http.get<ConsumoHoras[]>(`${this.base}/consumo/${contratoId}`);
  }
}
