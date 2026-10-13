import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EstadoServicioProveedorItem } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EstadosServiciosProveedoresService {
  private base = `${environment.apiUrl}/estados-servicios-proveedores`;
  constructor(private http: HttpClient) {}

  listar(): Observable<EstadoServicioProveedorItem[]> {
    return this.http.get<EstadoServicioProveedorItem[]>(this.base);
  }

  obtener(id: string): Observable<EstadoServicioProveedorItem> {
    return this.http.get<EstadoServicioProveedorItem>(`${this.base}/${id}`);
  }

  crear(data: Partial<EstadoServicioProveedorItem>): Observable<EstadoServicioProveedorItem> {
    return this.http.post<EstadoServicioProveedorItem>(this.base, data);
  }

  actualizar(id: string, data: Partial<EstadoServicioProveedorItem>): Observable<EstadoServicioProveedorItem> {
    return this.http.put<EstadoServicioProveedorItem>(`${this.base}/${id}`, data);
  }

  eliminar(id: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}`);
  }
}
