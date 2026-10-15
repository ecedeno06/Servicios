import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChecklistItem } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ChecklistsService {
  private base = `${environment.apiUrl}/checklists`;
  constructor(private http: HttpClient) {}

  listar(): Observable<ChecklistItem[]> {
    return this.http.get<ChecklistItem[]>(this.base);
  }

  obtener(id: string): Observable<ChecklistItem> {
    return this.http.get<ChecklistItem>(`${this.base}/${id}`);
  }

  crear(data: Partial<ChecklistItem>): Observable<ChecklistItem> {
    return this.http.post<ChecklistItem>(this.base, data);
  }

  actualizar(id: string, data: Partial<ChecklistItem>): Observable<ChecklistItem> {
    return this.http.put<ChecklistItem>(`${this.base}/${id}`, data);
  }

  eliminar(id: string): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.delete<{ ok: boolean; mensaje: string }>(`${this.base}/${id}`);
  }
}
