import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServicioProveedor, FacturaServicioProveedor, ReporteServicioPagos, ImagenServicioProveedor, ServicioIncidente } from '../models/models';

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

  eliminar(id: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}`);
  }

  // FACTURAS / TRANSACCIONES
  listarFacturas(servicioId: string): Observable<FacturaServicioProveedor[]> {
    return this.http.get<FacturaServicioProveedor[]>(`${this.base}/${servicioId}/facturas`);
  }

  crearFactura(servicioId: string, data: Partial<FacturaServicioProveedor>): Observable<FacturaServicioProveedor> {
    return this.http.post<FacturaServicioProveedor>(`${this.base}/${servicioId}/facturas`, data);
  }

  actualizarFactura(servicioId: string, facturaId: string, data: Partial<FacturaServicioProveedor>): Observable<FacturaServicioProveedor> {
    return this.http.put<FacturaServicioProveedor>(`${this.base}/${servicioId}/facturas/${facturaId}`, data);
  }

  eliminarFactura(servicioId: string, facturaId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/facturas/${facturaId}`);
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

  eliminarAdjunto(servicioId: string, adjuntoId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/adjuntos/${adjuntoId}`);
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

  eliminarAdjuntoFactura(servicioId: string, facturaId: string, adjuntoId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/facturas/${facturaId}/adjuntos/${adjuntoId}`);
  }

  // INCIDENTES
  listarIncidentes(servicioId: string): Observable<ServicioIncidente[]> {
    return this.http.get<ServicioIncidente[]>(`${this.base}/${servicioId}/incidentes`);
  }

  crearIncidente(servicioId: string, data: Partial<ServicioIncidente>): Observable<ServicioIncidente> {
    return this.http.post<ServicioIncidente>(`${this.base}/${servicioId}/incidentes`, data);
  }

  actualizarIncidente(servicioId: string, incidenteId: string, data: Partial<ServicioIncidente>): Observable<ServicioIncidente> {
    return this.http.put<ServicioIncidente>(`${this.base}/${servicioId}/incidentes/${incidenteId}`, data);
  }

  eliminarIncidente(servicioId: string, incidenteId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/incidentes/${incidenteId}`);
  }

  // ADJUNTOS DE INCIDENTE (imagenes/documentos)
  listarAdjuntosIncidente(servicioId: string, incidenteId: string): Observable<ImagenServicioProveedor[]> {
    return this.http.get<ImagenServicioProveedor[]>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos`);
  }

  crearAdjuntoIncidente(servicioId: string, incidenteId: string, data: { descripcion?: string; imagen_base64: string }): Observable<ImagenServicioProveedor> {
    return this.http.post<ImagenServicioProveedor>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos`, data);
  }

  actualizarAdjuntoIncidente(servicioId: string, incidenteId: string, adjuntoId: string, data: { descripcion?: string }): Observable<ImagenServicioProveedor> {
    return this.http.put<ImagenServicioProveedor>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos/${adjuntoId}`, data);
  }

  eliminarAdjuntoIncidente(servicioId: string, incidenteId: string, adjuntoId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${servicioId}/incidentes/${incidenteId}/adjuntos/${adjuntoId}`);
  }
}
