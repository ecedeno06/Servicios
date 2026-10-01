import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItem } from '../models/models';

// CRUD de administracion de "menus" (lista plana, sin arbol) -- no
// confundir con MenuService, que expone el arbol+permisos del usuario
// actual para el sidebar.
@Injectable({ providedIn: 'root' })
export class MenusAdminService {
  private base = `${environment.apiUrl}/menus`;
  constructor(private http: HttpClient) {}

  listar(): Observable<MenuItem[]> { return this.http.get<MenuItem[]>(this.base); }
  actualizar(id: number, data: { nombre?: string; icono?: string; orden?: number; activo?: boolean }): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.base}/${id}`, data);
  }
}
