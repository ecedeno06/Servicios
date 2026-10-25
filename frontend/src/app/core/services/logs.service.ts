import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LogError } from '../models/models';

@Injectable({ providedIn: 'root' })
export class LogsService {
  private base = `${environment.apiUrl}/logs`;
  constructor(private http: HttpClient) {}

  listar(filtros: { desde?: string; hasta?: string; nivel?: string; ruta?: string; mensaje?: string }): Observable<LogError[]> {
    const params: Record<string, string> = {};
    if (filtros.desde) params['desde'] = filtros.desde;
    if (filtros.hasta) params['hasta'] = filtros.hasta;
    if (filtros.nivel) params['nivel'] = filtros.nivel;
    if (filtros.ruta) params['ruta'] = filtros.ruta;
    if (filtros.mensaje) params['mensaje'] = filtros.mensaje;
    return this.http.get<LogError[]>(this.base, { params });
  }

  eliminar(ids: string[]): Observable<{ eliminados: number }> {
    return this.http.post<{ eliminados: number }>(`${this.base}/eliminar`, { ids });
  }
}
