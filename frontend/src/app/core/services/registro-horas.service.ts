import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Comentario, ConsumoHoras, NotificacionComentario, RegistroHora } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RegistroHorasService {
  private base = `${environment.apiUrl}/horas`;
  constructor(private http: HttpClient) {}

  // Contador de comentarios no leidos, compartido por toda la app (el
  // header y la pantalla de Registro de horas leen y refrescan el mismo
  // signal, para que marcar como visto desde cualquier lado actualice la
  // campanita al instante, sin esperar al sondeo de 60s).
  noLeidos = signal(0);

  refrescarNoLeidos(): void {
    this.notificacionesNoLeidas().subscribe((r) => this.noLeidos.set(r.no_leidos));
  }

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
  listarComentarios(id: string): Observable<Comentario[]> {
    return this.http.get<Comentario[]>(`${this.base}/${id}/comentarios`);
  }
  agregarComentario(id: string, nota: string): Observable<Comentario> {
    return this.http.post<Comentario>(`${this.base}/${id}/comentarios`, { nota });
  }
  marcarComentariosVistos(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/comentarios/marcar-visto`, {})
      .pipe(tap(() => this.refrescarNoLeidos()));
  }
  notificacionesNoLeidas(): Observable<{ no_leidos: number }> {
    return this.http.get<{ no_leidos: number }>(`${this.base}/notificaciones/no-leidos`);
  }
  listarNotificaciones(): Observable<NotificacionComentario[]> {
    return this.http.get<NotificacionComentario[]>(`${this.base}/notificaciones`);
  }
}
