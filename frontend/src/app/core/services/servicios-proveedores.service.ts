import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServicioProveedor, FacturaServicioProveedor, ReporteServicioPagos, ImagenServicioProveedor, IncidenteAdjunto, ServicioIncidente, IncidenteNota } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ServiciosProveedoresService {
  private base = `${environment.apiUrl}/servicios-proveedores`;
  constructor(private http: HttpClient) {}

  listar(): Observable<ServicioProveedor[]> {
    return this.http.get<ServicioProveedor[]>(this.base);
  }

  // Una fila por servicio con los pagos sumados solo dentro del rango de
  // fechas pedido -- usado por el Reporte de Servicios.
  reportePagos(desde?: string, hasta?: string): Observable<ReporteServicioPagos[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<ReporteServicioPagos[]>(`${this.base}/reporte/pagos`, { params });
  }

  obtener(id: string): Observable<ServicioProveedor> {
    return this.http.get<ServicioProveedor>(`${this.base}/${id}`);
  }

  crear(data: Partial<ServicioProveedor>): Observable<ServicioProveedor> {
    return this.http.post<ServicioProveedor>(this.base, data);
  }

  actualizar(id: string, data: Partial<ServicioProveedor>): Observable<ServicioProveedor> {
    return this.http.put<ServicioProveedor>(`${this.base}/${id}`, data);
  }

  eliminar(id: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}`, { body: { password } });
  }

  // FACTURAS / TRANSACCIONES
  // Version "todo en uno" (facturas + adjuntos de cada una) para el popup
  // de solo lectura "Facturas" -- una sola peticion en vez de pedir
  // adjuntos por separado por factura.
  listarFacturasConAdjuntos(servicioId: string): Observable<(FacturaServicioProveedor & { adjuntos: ImagenServicioProveedor[] })[]> {
    return this.http.get<(FacturaServicioProveedor & { adjuntos: ImagenServicioProveedor[] })[]>(`${this.base}/${servicioId}/facturas-info`);
  }

  listarFacturas(servicioId: string): Observable<FacturaServicioProveedor[]> {
    return this.http.get<FacturaServicioProveedor[]>(`${this.base}/${servicioId}/facturas`);
  }

  crearFactura(servicioId: string, data: Partial<FacturaServicioProveedor>): Observable<FacturaServicioProveedor> {
    return this.http.post<FacturaServicioProveedor>(`${this.base}/${servicioId}/facturas`, data);
  }

  actualizarFactura(servicioId: string, facturaId: string, data: Partial<FacturaServicioProveedor>): Observable<FacturaServicioProveedor> {
    return this.http.put<FacturaServicioProveedor>(`${this.base}/${servicioId}/facturas/${facturaId}`, data);
  }

  eliminarFactura(servicioId: string, facturaId: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/facturas/${facturaId}`, { body: { password } });
  }

  // ADJUNTOS (imagenes/documentos)
  listarAdjuntos(servicioId: string): Observable<ImagenServicioProveedor[]> {
    return this.http.get<ImagenServicioProveedor[]>(`${this.base}/${servicioId}/adjuntos`);
  }

  crearAdjunto(servicioId: string, data: { descripcion?: string; imagen_base64: string }): Observable<ImagenServicioProveedor> {
    return this.http.post<ImagenServicioProveedor>(`${this.base}/${servicioId}/adjuntos`, data);
  }

  actualizarAdjunto(servicioId: string, adjuntoId: string, data: { descripcion?: string }): Observable<ImagenServicioProveedor> {
    return this.http.put<ImagenServicioProveedor>(`${this.base}/${servicioId}/adjuntos/${adjuntoId}`, data);
  }

  eliminarAdjunto(servicioId: string, adjuntoId: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/adjuntos/${adjuntoId}`, { body: { password } });
  }

  // ADJUNTOS DE FACTURA (imagenes/documentos)
  listarAdjuntosFactura(servicioId: string, facturaId: string): Observable<ImagenServicioProveedor[]> {
    return this.http.get<ImagenServicioProveedor[]>(`${this.base}/${servicioId}/facturas/${facturaId}/adjuntos`);
  }

  crearAdjuntoFactura(servicioId: string, facturaId: string, data: { descripcion?: string; imagen_base64: string }): Observable<ImagenServicioProveedor> {
    return this.http.post<ImagenServicioProveedor>(`${this.base}/${servicioId}/facturas/${facturaId}/adjuntos`, data);
  }

  actualizarAdjuntoFactura(servicioId: string, facturaId: string, adjuntoId: string, data: { descripcion?: string }): Observable<ImagenServicioProveedor> {
    return this.http.put<ImagenServicioProveedor>(`${this.base}/${servicioId}/facturas/${facturaId}/adjuntos/${adjuntoId}`, data);
  }

  eliminarAdjuntoFactura(servicioId: string, facturaId: string, adjuntoId: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/facturas/${facturaId}/adjuntos/${adjuntoId}`, { body: { password } });
  }

  // INCIDENTES
  listarIncidentes(servicioId: string): Observable<ServicioIncidente[]> {
    return this.http.get<ServicioIncidente[]>(`${this.base}/${servicioId}/incidentes`);
  }

  // Version "todo en uno" (incidentes + notas + adjuntos de cada uno) para
  // el popup de solo lectura "Eventos, Notas y Adjuntos" -- una sola
  // peticion en vez de pedir notas/adjuntos por separado por incidente.
  listarIncidentesConDetalle(servicioId: string): Observable<(ServicioIncidente & { notas: IncidenteNota[]; adjuntos: IncidenteAdjunto[] })[]> {
    return this.http.get<(ServicioIncidente & { notas: IncidenteNota[]; adjuntos: IncidenteAdjunto[] })[]>(`${this.base}/${servicioId}/incidentes-info`);
  }

  crearIncidente(servicioId: string, data: Partial<ServicioIncidente>): Observable<ServicioIncidente> {
    return this.http.post<ServicioIncidente>(`${this.base}/${servicioId}/incidentes`, data);
  }

  actualizarIncidente(servicioId: string, incidenteId: string, data: Partial<ServicioIncidente>): Observable<ServicioIncidente> {
    return this.http.put<ServicioIncidente>(`${this.base}/${servicioId}/incidentes/${incidenteId}`, data);
  }

  eliminarIncidente(servicioId: string, incidenteId: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/incidentes/${incidenteId}`, { body: { password } });
  }

  // ADJUNTOS DE INCIDENTE (imagenes/documentos o enlaces)
  listarAdjuntosIncidente(servicioId: string, incidenteId: string): Observable<IncidenteAdjunto[]> {
    return this.http.get<IncidenteAdjunto[]>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos`);
  }

  crearAdjuntoIncidente(servicioId: string, incidenteId: string, data: { descripcion?: string; imagen_base64?: string; url?: string }): Observable<IncidenteAdjunto> {
    return this.http.post<IncidenteAdjunto>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos`, data);
  }

  actualizarAdjuntoIncidente(servicioId: string, incidenteId: string, adjuntoId: string, data: { descripcion?: string; url?: string }): Observable<IncidenteAdjunto> {
    return this.http.put<IncidenteAdjunto>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos/${adjuntoId}`, data);
  }

  eliminarAdjuntoIncidente(servicioId: string, incidenteId: string, adjuntoId: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos/${adjuntoId}`, { body: { password } });
  }

  // NOTAS/HISTORICO DE INCIDENTE
  listarNotasIncidente(servicioId: string, incidenteId: string): Observable<IncidenteNota[]> {
    return this.http.get<IncidenteNota[]>(`${this.base}/${servicioId}/incidentes/${incidenteId}/notas`);
  }

  crearNotaIncidente(
    servicioId: string,
    incidenteId: string,
    data: { nota?: string; estado_nuevo?: string; imagen_base64?: string; descripcion_adjunto?: string; url?: string }
  ): Observable<{ nota: IncidenteNota; incidente: ServicioIncidente }> {
    return this.http.post<{ nota: IncidenteNota; incidente: ServicioIncidente }>(`${this.base}/${servicioId}/incidentes/${incidenteId}/notas`, data);
  }

  eliminarNotaIncidente(servicioId: string, incidenteId: string, notaId: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/incidentes/${incidenteId}/notas/${notaId}`, { body: { password } });
  }
}
