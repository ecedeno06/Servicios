import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario, EmpresaSeleccionable } from '../models/models';

interface LoginResponse {
  token: string;
  usuario: Usuario;
}

interface LoginRequiereSeleccion {
  requiereSeleccionEmpresa: true;
  tokenParcial: string;
  empresas: EmpresaSeleccionable[];
}

const STORAGE_KEY = 'hs_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _usuario = signal<Usuario | null>(this.leerUsuarioGuardado());
  usuario = computed(() => this._usuario());
  estaAutenticado = computed(() => !!this._usuario());
  esSuperAdmin = computed(() => !!this._usuario()?.es_super_admin);
  esCliente = computed(() => this._usuario()?.rol === 'cliente');
  empresaActiva = computed(() => {
    const u = this._usuario();
    return u?.empresa_id
      ? { empresa_id: u.empresa_id, empresa_nombre: u.empresa_nombre, empresa_logo: u.empresa_logo }
      : null;
  });

  // Empresas para elegir cuando el login detecta que el usuario pertenece
  // a mas de una (login queda "a medias" hasta llamar a seleccionarEmpresa).
  private _seleccionPendiente = signal<EmpresaSeleccionable[] | null>(null);
  seleccionPendiente = computed(() => this._seleccionPendiente());

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse | LoginRequiereSeleccion> {
    return this.http
      .post<LoginResponse | LoginRequiereSeleccion>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          if ('requiereSeleccionEmpresa' in res) {
            // Se guarda el token parcial para que el interceptor lo use en
            // la llamada a seleccionar-empresa (requireAuth acepta tokens
            // parciales, solo requireEmpresa los rechaza).
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: res.tokenParcial, usuario: null }));
            this._seleccionPendiente.set(res.empresas);
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
            this._usuario.set(res.usuario);
            this._seleccionPendiente.set(null);
          }
        })
      );
  }

  // Completa el login cuando hay mas de una empresa, o cambia la empresa
  // activa con la sesion ya iniciada.
  seleccionarEmpresa(empresaId: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/seleccionar-empresa`, { empresa_id: empresaId })
      .pipe(
        tap((res) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
          this._usuario.set(res.usuario);
          this._seleccionPendiente.set(null);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._usuario.set(null);
    this._seleccionPendiente.set(null);
    this.router.navigate(['/login']);
  }

  puedeEditar(): boolean {
    const rol = this.usuario()?.rol;
    return rol === 'admin' || rol === 'supervisor';
  }

  puedeEliminar(): boolean {
    return this.usuario()?.rol === 'admin';
  }

  actualizarAvatar(avatar: string | null): Observable<Usuario> {
    return this.http.put<Usuario>(`${environment.apiUrl}/auth/me`, { avatar }).pipe(
      tap((usuario) => this.guardarUsuarioActualizado(usuario))
    );
  }

  // pista es opcional: si se omite, el backend no toca la pista ya
  // guardada; si se envia vacia o con texto, la reemplaza. El backend
  // reemite un token (debe_cambiar_password=false) para desbloquear de
  // inmediato si el cambio era obligatorio, sin esperar a volver a entrar.
  cambiarPassword(passwordActual: string, passwordNueva: string, pista?: string): Observable<{ mensaje: string; token?: string }> {
    const body: Record<string, string> = { password_actual: passwordActual, password_nueva: passwordNueva };
    if (pista !== undefined) body['pista'] = pista;
    return this.http.put<{ mensaje: string; token?: string }>(`${environment.apiUrl}/auth/password`, body).pipe(
      tap((res) => {
        if (res.token) this.actualizarTrasCambioPassword(res.token);
      })
    );
  }

  // Publico (sin token) -- ver GET /auth/pista en el backend, con rate-limit
  // por IP+email para que no se pueda usar para adivinar en bucle.
  obtenerPista(email: string): Observable<{ pista: string }> {
    return this.http.get<{ pista: string }>(`${environment.apiUrl}/auth/pista`, { params: { email } });
  }

  // Publico (sin token) -- el mensaje de respuesta es siempre generico
  // (nunca revela si el correo existe) tanto en exito como en error de
  // formato; solo un fallo real de red muestra algo distinto.
  olvidarPassword(email: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  // Publico (sin token) -- token viene del enlace que llega por correo.
  restablecerPassword(token: string, passwordNueva: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/auth/reset-password`, { token, password_nueva: passwordNueva });
  }

  private actualizarTrasCambioPassword(token: string): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    const actual = raw ? JSON.parse(raw) : {};
    const usuarioActualizado = actual.usuario ? { ...actual.usuario, debe_cambiar_password: false } : actual.usuario;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...actual, token, usuario: usuarioActualizado }));
    if (usuarioActualizado) this._usuario.set(usuarioActualizado);
  }

  // Llamado por el interceptor cuando el backend rechaza una peticion con
  // requiereCambioPassword: true -- fuerza el formulario obligatorio sin
  // esperar a que el usuario recargue la pagina.
  marcarCambioPasswordObligatorio(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const actual = JSON.parse(raw);
    if (!actual.usuario) return;
    const usuarioActualizado = { ...actual.usuario, debe_cambiar_password: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...actual, usuario: usuarioActualizado }));
    this._usuario.set(usuarioActualizado);
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
