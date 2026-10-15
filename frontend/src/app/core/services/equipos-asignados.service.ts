import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EquipoAsignado, EstadoEquipo, ImagenServicioProveedor, MovimientoEquipo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EquiposAsignadosService {
  private base = `${environment.apiUrl}/equipos-asignados`;
  constructor(private http: HttpClient) {}

  listar(): Observable<EquipoAsignado[]> { return this.http.get<EquipoAsignado[]>(this.base); }
  crear(data: any): Observable<EquipoAsignado> { return this.http.post<EquipoAsignado>(this.base, data); }
  actualizar(id: string, data: any): Observable<EquipoAsignado> { return this.http.put<EquipoAsignado>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
  historial(id: string): Observable<MovimientoEquipo[]> { return this.http.get<MovimientoEquipo[]>(`${this.base}/${id}/historial`); }

  // Cambio rapido de estado desde el boton-icono de la fila (sin abrir el
  // formulario completo de mantenimiento).
  cambiarEstado(id: string, data: { estado: EstadoEquipo; asignada_a?: string; observacion?: string; checklist_ids?: string[] }): Observable<EquipoAsignado> {
    return this.http.post<EquipoAsignado>(`${this.base}/${id}/movimiento`, data);
  }

  // ADJUNTOS (imagenes/documentos)
  listarAdjuntos(equipoId: string): Observable<ImagenServicioProveedor[]> {
    return this.http.get<ImagenServicioProveedor[]>(`${this.base}/${equipoId}/adjuntos`);
  }

  crearAdjunto(equipoId: string, data: { descripcion?: string; imagen_base64: string }): Observable<ImagenServicioProveedor> {
    return this.http.post<ImagenServicioProveedor>(`${this.base}/${equipoId}/adjuntos`, data);
  }

  actualizarAdjunto(equipoId: string, adjuntoId: string, data: { descripcion?: string }): Observable<ImagenServicioProveedor> {
    return this.http.put<ImagenServicioProveedor>(`${this.base}/${equipoId}/adjuntos/${adjuntoId}`, data);
  }

  eliminarAdjunto(equipoId: string, adjuntoId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${equipoId}/adjuntos/${adjuntoId}`);
  }
}
