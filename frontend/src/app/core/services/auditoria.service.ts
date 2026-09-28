import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SesionAuditoria } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private base = `${environment.apiUrl}/auditoria`;
  constructor(private http: HttpClient) {}

  listarSesiones(filtros: { desde?: string; hasta?: string; usuario?: string }): Observable<SesionAuditoria[]> {
    const params: Record<string, string> = {};
    if (filtros.desde) params['desde'] = filtros.desde;
    if (filtros.hasta) params['hasta'] = filtros.hasta;
    if (filtros.usuario) params['usuario'] = filtros.usuario;
    return this.http.get<SesionAuditoria[]>(`${this.base}/sesiones`, { params });
  }

  cerrarSesiones(ids: string[]): Observable<{ cerradas: number }> {
    return this.http.post<{ cerradas: number }>(`${this.base}/sesiones/cerrar`, { ids });
  }

  bloquearUsuario(usuarioId: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/usuarios/${usuarioId}/bloquear`, {});
  }
}
