import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Carrito, CarritoCotizacion, CarritoDetalle, EstadoCarrito, HistoricoMovimientoCarrito, ReporteCarritoResponse } from '../models/models';

export interface CotizacionFormData {
  proveedor_id: string;
  fecha?: string | null;
  numero_cotizacion?: string | null;
  costo_unitario: number;
  url?: string | null;
  contacto_nombre?: string | null;
  contacto_correo?: string | null;
  contacto_telefono?: string | null;
  observacion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CarritosService {
  private base = `${environment.apiUrl}/carritos`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Carrito[]> { return this.http.get<Carrito[]>(this.base); }
  obtener(id: string): Observable<Carrito> { return this.http.get<Carrito>(`${this.base}/${id}`); }
  crear(data: { titulo: string; fecha_solicitud?: string; observacion?: string | null }): Observable<Carrito> { return this.http.post<Carrito>(this.base, data); }
  actualizar(id: string, data: { titulo: string; fecha_solicitud?: string; observacion?: string | null }): Observable<Carrito> {
    return this.http.put<Carrito>(`${this.base}/${id}`, data);
  }
  eliminar(id: string, password: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}`, { body: { password } });
  }
  avanzarEstado(id: string, estado: EstadoCarrito): Observable<Carrito> {
    return this.http.post<Carrito>(`${this.base}/${id}/avanzar`, { estado });
  }
  retrocederEstado(id: string, estado: EstadoCarrito): Observable<Carrito> {
    return this.http.post<Carrito>(`${this.base}/${id}/retroceder`, { estado });
  }
  listarHistorico(id: string): Observable<HistoricoMovimientoCarrito[]> {
    return this.http.get<HistoricoMovimientoCarrito[]>(`${this.base}/${id}/historico`);
  }
  enviarPorCorreo(id: string, destinatarios: string[], asunto?: string, observacion?: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.post<{ ok: boolean; mensaje: string }>(`${this.base}/${id}/enviar-correo`, { destinatarios, asunto, observacion });
  }
  listarDestinatarios(): Observable<{ id: string; nombre: string; email: string }[]> {
    return this.http.get<{ id: string; nombre: string; email: string }[]>(`${this.base}/destinatarios`);
  }

  reporte(desde?: string, hasta?: string, estado?: string): Observable<ReporteCarritoResponse> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    if (estado) params = params.set('estado', estado);
    return this.http.get<ReporteCarritoResponse>(`${this.base}/reporte`, { params });
  }

  // DETALLES (lineas de equipos a comprar)
  listarDetalles(carritoId: string): Observable<CarritoDetalle[]> {
    return this.http.get<CarritoDetalle[]>(`${this.base}/${carritoId}/detalles`);
  }

  crearDetalle(carritoId: string, data: Partial<CarritoDetalle>): Observable<CarritoDetalle> {
    return this.http.post<CarritoDetalle>(`${this.base}/${carritoId}/detalles`, data);
  }

  actualizarDetalle(carritoId: string, detalleId: string, data: Partial<CarritoDetalle>): Observable<CarritoDetalle> {
    return this.http.put<CarritoDetalle>(`${this.base}/${carritoId}/detalles/${detalleId}`, data);
  }

  eliminarDetalle(carritoId: string, detalleId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${carritoId}/detalles/${detalleId}`);
  }

  // COTIZACIONES (propuestas de precio de una linea, una o mas, cada una de un proveedor)
  listarCotizaciones(carritoId: string, detalleId: string): Observable<CarritoCotizacion[]> {
    return this.http.get<CarritoCotizacion[]>(`${this.base}/${carritoId}/detalles/${detalleId}/cotizaciones`);
  }

  crearCotizacion(carritoId: string, detalleId: string, data: CotizacionFormData): Observable<CarritoCotizacion> {
    return this.http.post<CarritoCotizacion>(`${this.base}/${carritoId}/detalles/${detalleId}/cotizaciones`, data);
  }

  actualizarCotizacion(carritoId: string, detalleId: string, cotizacionId: string, data: CotizacionFormData): Observable<CarritoCotizacion> {
    return this.http.put<CarritoCotizacion>(`${this.base}/${carritoId}/detalles/${detalleId}/cotizaciones/${cotizacionId}`, data);
  }

  eliminarCotizacion(carritoId: string, detalleId: string, cotizacionId: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${carritoId}/detalles/${detalleId}/cotizaciones/${cotizacionId}`);
  }
}
