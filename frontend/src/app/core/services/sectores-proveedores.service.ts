import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SectorProveedorItem } from '../models/models';

@Injectable({ providedIn: 'root' })
export class SectoresProveedoresService {
  private base = `${environment.apiUrl}/sectores-proveedores`;
  constructor(private http: HttpClient) {}

  listar(): Observable<SectorProveedorItem[]> {
    return this.http.get<SectorProveedorItem[]>(this.base);
  }

  obtener(id: string): Observable<SectorProveedorItem> {
    return this.http.get<SectorProveedorItem>(`${this.base}/${id}`);
  }

  crear(data: Partial<SectorProveedorItem>): Observable<SectorProveedorItem> {
    return this.http.post<SectorProveedorItem>(this.base, data);
  }

  actualizar(id: string, data: Partial<SectorProveedorItem>): Observable<SectorProveedorItem> {
    return this.http.put<SectorProveedorItem>(`${this.base}/${id}`, data);
  }

  eliminar(id: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}`);
  }
}
