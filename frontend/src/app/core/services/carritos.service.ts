import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Carrito, CarritoDetalle, EstadoCarrito, HistoricoMovimientoCarrito } from '../models/models';

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
}
