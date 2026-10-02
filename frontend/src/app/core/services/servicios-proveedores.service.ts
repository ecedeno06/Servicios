import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServicioProveedor, FacturaServicioProveedor } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ServiciosProveedoresService {
  private base = `${environment.apiUrl}/servicios-proveedores`;
  constructor(private http: HttpClient) {}

  listar(): Observable<ServicioProveedor[]> {
    return this.http.get<ServicioProveedor[]>(this.base);
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
}
