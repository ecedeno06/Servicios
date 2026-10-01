import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Permiso } from '../models/models';

// Catalogo fijo de acciones (ver/crear/editar/eliminar), de solo lectura.
@Injectable({ providedIn: 'root' })
export class PermisosCatalogoService {
  private base = `${environment.apiUrl}/permisos`;
  constructor(private http: HttpClient) {}

  listar(): Observable<Permiso[]> { return this.http.get<Permiso[]>(this.base); }
}
