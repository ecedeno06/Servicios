import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EquipoAsignado, EquipoChecklistEjecucion, EquipoChecklistEjecucionDetalle, EquipoChecklistItem, EstadoEquipo, ImagenServicioProveedor, MovimientoEquipo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EquiposAsignadosService {
  private base = `${environment.apiUrl}/equipos-asignados`;
  constructor(private http: HttpClient) {}

  listar(): Observable<EquipoAsignado[]> { return this.http.get<EquipoAsignado[]>(this.base); }
  crear(data: any): Observable<EquipoAsignado> { return this.http.post<EquipoAsignado>(this.base, data); }
  actualizar(id: string, data: any): Observable<EquipoAsignado> { return this.http.put<EquipoAsignado>(`${this.base}/${id}`, data); }
  eliminar(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
  historial(id: string): Observable<MovimientoEquipo[]> { return this.http.get<MovimientoEquipo[]>(`${this.base}/${id}/historial`); }
  eliminarHistorial(id: string, historialId: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}/historial/${historialId}`, { body: { password } });
  }

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

  // CHECKLIST (ejecuciones -- se puede repetir mas de una vez por equipo,
  // cada una asociada al usuario al que se le asigno el equipo + fecha)
  listarChecklistEjecuciones(equipoId: string): Observable<EquipoChecklistEjecucion[]> {
    return this.http.get<EquipoChecklistEjecucion[]>(`${this.base}/${equipoId}/checklist`);
  }

  crearChecklistEjecucion(equipoId: string, data: { asignado_a?: string; fecha?: string }): Observable<EquipoChecklistEjecucion> {
    return this.http.post<EquipoChecklistEjecucion>(`${this.base}/${equipoId}/checklist`, data);
  }

  obtenerChecklistEjecucion(equipoId: string, ejecucionId: string): Observable<EquipoChecklistEjecucionDetalle> {
    return this.http.get<EquipoChecklistEjecucionDetalle>(`${this.base}/${equipoId}/checklist/${ejecucionId}`);
  }

  actualizarChecklistEjecucion(equipoId: string, ejecucionId: string, data: { asignado_a?: string; fecha?: string }): Observable<EquipoChecklistEjecucion> {
    return this.http.put<EquipoChecklistEjecucion>(`${this.base}/${equipoId}/checklist/${ejecucionId}`, data);
  }

  eliminarChecklistEjecucion(equipoId: string, ejecucionId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${equipoId}/checklist/${ejecucionId}`);
  }

  actualizarChecklistEjecucionItem(equipoId: string, ejecucionId: string, checklistId: string, data: { completado: boolean }): Observable<EquipoChecklistItem> {
    return this.http.put<EquipoChecklistItem>(`${this.base}/${equipoId}/checklist/${ejecucionId}/items/${checklistId}`, data);
  }

  // El PDF ya viene armado (pdfmake, base64) del lado del frontend -- el
  // backend solo lo adjunta y lo manda por correo.
  enviarChecklistPdfPorCorreo(equipoId: string, ejecucionId: string, data: { destinatario: string; pdfBase64: string }): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.post<{ ok: boolean; mensaje: string }>(`${this.base}/${equipoId}/checklist/${ejecucionId}/enviar-pdf`, data);
  }
}
