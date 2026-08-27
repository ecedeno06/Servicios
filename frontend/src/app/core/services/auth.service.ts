import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario } from '../models/models';

interface LoginResponse {
  token: string;
  usuario: Usuario;
}

const STORAGE_KEY = 'hs_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _usuario = signal<Usuario | null>(this.leerUsuarioGuardado());
  usuario = computed(() => this._usuario());
  estaAutenticado = computed(() => !!this._usuario());

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
        this._usuario.set(res.usuario);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  actualizarAvatar(avatar: string | null): Observable<Usuario> {
    return this.http.put<Usuario>(`${environment.apiUrl}/auth/me`, { avatar }).pipe(
      tap((usuario) => this.guardarUsuarioActualizado(usuario))
    );
  }

  cambiarPassword(passwordActual: string, passwordNueva: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${environment.apiUrl}/auth/password`, {
      password_actual: passwordActual,
      password_nueva: passwordNueva,
    });
  }

  private guardarUsuarioActualizado(usuario: Usuario): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    const actual = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...actual, usuario: { ...actual.usuario, ...usuario } }));
    this._usuario.set({ ...this._usuario(), ...usuario } as Usuario);
  }

  get token(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw).token ?? null;
    } catch {
      return null;
    }
  }

  private leerUsuarioGuardado(): Usuario | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw).usuario ?? null;
    } catch {
      return null;
    }
  }
}
