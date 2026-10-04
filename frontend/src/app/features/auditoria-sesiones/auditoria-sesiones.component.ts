import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { AuthService } from '../../core/services/auth.service';
import { MotivoSalida, SesionAuditoria } from '../../core/models/models';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function haceDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-auditoria-sesiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auditoria-sesiones.component.html',
  styleUrl: './auditoria-sesiones.component.css',
})
export class AuditoriaSesionesComponent implements OnInit {
  private mapaPopup: L.Map | null = null;
  sesionMapaAbierta = signal<SesionAuditoria | null>(null);

  sesiones = signal<SesionAuditoria[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);
  buscado = signal(false);

  usuarioTexto = signal('');
  desde = signal(haceDiasISO(7));
  hasta = signal(hoyISO());

  seleccionadas = signal<Set<string>>(new Set());
  cerrandoSesiones = signal(false);
  bloqueandoAcceso = signal(false);
  mensajeExito = signal<string | null>(null);

  // Filtros por columna (coincidencia parcial, sin distinguir mayusculas),
  // aplicados en el cliente sobre lo ya cargado del servidor.
  filtroUsuario = signal('');
  filtroRol = signal('');
  filtroIpUbicacion = signal('');
  filtroPais = signal('');
  filtroInicio = signal('');
  filtroCierre = signal('');
  filtroDuracion = signal('');
  filtroMotivo = signal('');

  hayFiltrosColumna = computed(() =>
    !!(this.filtroUsuario() || this.filtroRol() || this.filtroIpUbicacion() || this.filtroPais() ||
       this.filtroInicio() || this.filtroCierre() || this.filtroDuracion() || this.filtroMotivo())
  );

  sesionesFiltradas = computed(() => {
    const contiene = (valor: string, filtro: string) => valor.toLowerCase().includes(filtro.toLowerCase().trim());

    const fUsuario = this.filtroUsuario();
    const fRol = this.filtroRol();
    const fIp = this.filtroIpUbicacion();
    const fPais = this.filtroPais();
    const fInicio = this.filtroInicio();
    const fCierre = this.filtroCierre();
    const fDuracion = this.filtroDuracion();
    const fMotivo = this.filtroMotivo();

    return this.sesiones().filter((s) => {
      if (fUsuario && !contiene(`${s.usuario_nombre} ${s.usuario_email}`, fUsuario)) return false;
      if (fRol && !contiene(s.rol || '', fRol)) return false;
      if (fIp && !contiene(`${s.ip_address || ''} ${this.ubicacionTexto(s)}`, fIp)) return false;
      if (fPais && !contiene(s.geo_pais || '', fPais)) return false;
      if (fInicio && !contiene(this.formatoFecha(s.login_en), fInicio)) return false;
      if (fCierre && !contiene(s.logout_en ? this.formatoFecha(s.logout_en) : '-', fCierre)) return false;
      if (fDuracion && !contiene(this.formatoDuracion(s.duracion_segundos), fDuracion)) return false;
      if (fMotivo && !contiene(this.etiquetaMotivo(s.motivo_salida), fMotivo)) return false;
      return true;
    });
  });

  // Orden por columna (click en el encabezado alterna asc/desc).
  columnaOrden = signal<string | null>(null);
  direccionOrden = signal<'asc' | 'desc'>('asc');

  ordenarPor(columna: string): void {
    if (this.columnaOrden() === columna) {
      this.direccionOrden.set(this.direccionOrden() === 'asc' ? 'desc' : 'asc');
    } else {
      this.columnaOrden.set(columna);
      this.direccionOrden.set('asc');
    }
  }

  iconoOrden(columna: string): string {
    if (this.columnaOrden() !== columna) return '';
    return this.direccionOrden() === 'asc' ? '▲' : '▼';
  }

  private valorOrden(s: SesionAuditoria, columna: string): string | number {
    switch (columna) {
      case 'usuario': return s.usuario_nombre.toLowerCase();
      case 'rol': return (s.rol || '').toLowerCase();
      case 'ip': return (s.ip_address || '').toLowerCase();
      case 'pais': return (s.geo_pais || '').toLowerCase();
      case 'inicio': return new Date(s.login_en).getTime();
      case 'cierre': return s.logout_en ? new Date(s.logout_en).getTime() : Number.POSITIVE_INFINITY;
      case 'duracion': return s.duracion_segundos ?? -1;
      case 'motivo': return this.etiquetaMotivo(s.motivo_salida).toLowerCase();
      default: return '';
    }
  }

  sesionesOrdenadas = computed(() => {
    const columna = this.columnaOrden();
    const filtradas = this.sesionesFiltradas();
    if (!columna) return filtradas;
    const signo = this.direccionOrden() === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      const va = this.valorOrden(a, columna);
      const vb = this.valorOrden(b, columna);
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return 0;
    });
  });

  hayEnCurso = computed(() => this.sesionesFiltradas().some((s) => s.motivo_salida === 'en_curso'));
  totalSeleccionadas = computed(() => this.seleccionadas().size);

  constructor(private srv: AuditoriaService, public auth: AuthService) {}

  ngOnInit(): void {
    this.buscar();
  }

  limpiarFiltrosColumna(): void {
    this.filtroUsuario.set('');
    this.filtroRol.set('');
    this.filtroIpUbicacion.set('');
    this.filtroPais.set('');
    this.filtroInicio.set('');
    this.filtroCierre.set('');
    this.filtroDuracion.set('');
    this.filtroMotivo.set('');
  }

  private formatoFecha(iso: string): string {
    return formatDate(iso, 'dd/MM/yyyy HH:mm', 'en-US');
  }

  buscar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.seleccionadas.set(new Set());
    this.limpiarFiltrosColumna();

    this.srv.listarSesiones({ desde: this.desde(), hasta: this.hasta(), usuario: this.usuarioTexto().trim() }).subscribe({
      next: (data) => {
        this.sesiones.set(data);
        this.buscado.set(true);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.mensaje || 'No se pudo cargar la auditoria de sesiones.');
        this.sesiones.set([]);
        this.cargando.set(false);
      },
    });
  }

  esSeleccionable(s: SesionAuditoria): boolean {
    // La propia sesion actual nunca se puede seleccionar ni terminar desde
    // aqui (cerrarla a mitad de uso deja la pantalla sin sesion valida).
    return s.motivo_salida === 'en_curso' && !s.es_sesion_actual;
  }

  estaSeleccionada(id: string): boolean {
    return this.seleccionadas().has(id);
  }

  toggleSeleccion(id: string): void {
    const actuales = new Set(this.seleccionadas());
    if (actuales.has(id)) actuales.delete(id);
    else actuales.add(id);
    this.seleccionadas.set(actuales);
  }

  toggleSeleccionarTodas(): void {
    const seleccionables = this.sesionesFiltradas().filter((s) => this.esSeleccionable(s)).map((s) => s.id);
    const todasSeleccionadas = seleccionables.length > 0 && seleccionables.every((id) => this.seleccionadas().has(id));
    this.seleccionadas.set(todasSeleccionadas ? new Set() : new Set(seleccionables));
  }

  cerrarSeleccionadas(): void {
    const ids = Array.from(this.seleccionadas());
    if (ids.length === 0) return;
    if (!confirm(`Cerrar ${ids.length} sesion(es) activa(s)? El usuario debera iniciar sesion nuevamente.`)) return;
    this.ejecutarCierre(ids);
  }

  cerrarSesionUnica(s: SesionAuditoria): void {
    if (!confirm(`Cerrar la sesion activa de ${s.usuario_nombre}?`)) return;
    this.ejecutarCierre([s.id]);
  }

  private ejecutarCierre(ids: string[]): void {
    this.cerrandoSesiones.set(true);
    this.error.set(null);
    this.srv.cerrarSesiones(ids).subscribe({
      next: () => {
        this.cerrandoSesiones.set(false);
        this.buscar();
      },
      error: (err) => {
        this.cerrandoSesiones.set(false);
        this.error.set(err?.error?.mensaje || 'No se pudieron cerrar las sesiones.');
      },
    });
  }

  ubicacionTexto(s: SesionAuditoria): string {
    const partes = [s.geo_ciudad, s.geo_region, s.geo_pais].filter((p) => !!p && p.trim().length > 0);
    return partes.length > 0 ? partes.join(', ') : '-';
  }

  tieneCoordenadas(s: SesionAuditoria): boolean {
    return s.geo_lat != null && s.geo_lon != null;
  }

  abrirMapa(s: SesionAuditoria): void {
    if (!this.tieneCoordenadas(s)) return;
    this.sesionMapaAbierta.set(s);

    setTimeout(() => {
      if (this.mapaPopup) {
        this.mapaPopup.remove();
        this.mapaPopup = null;
      }

      const lat = Number(s.geo_lat);
      const lon = Number(s.geo_lon);

      this.mapaPopup = L.map('auditoria-mapa-popup').setView([lat, lon], 9);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.mapaPopup);

      L.circleMarker([lat, lon], {
        radius: 10,
        color: '#0d9488',
        fillColor: '#0d9488',
        fillOpacity: 0.85,
      })
        .bindPopup(`<b>${this.ubicacionTexto(s)}</b><br>IP: ${s.ip_address || '-'}`)
        .addTo(this.mapaPopup)
        .openPopup();

      setTimeout(() => this.mapaPopup?.invalidateSize(), 150);
    }, 50);
  }

  cerrarMapa(): void {
    if (this.mapaPopup) {
      this.mapaPopup.remove();
      this.mapaPopup = null;
    }
    this.sesionMapaAbierta.set(null);
  }

  /** No tiene sentido ofrecer el boton sobre la propia cuenta del admin que esta viendo el mapa. */
  esPropiaCuenta(s: SesionAuditoria): boolean {
    return String(this.auth.usuario()?.id) === String(s.usuario_id);
  }

  bloquearAccesoUsuario(s: SesionAuditoria): void {
    if (this.esPropiaCuenta(s)) return;

    if (!confirm(`Bloquear el acceso de ${s.usuario_nombre}? No podra iniciar sesion hasta que lo reactives, y se cerraran todas sus sesiones activas ahora mismo.`)) {
      return;
    }

    this.bloqueandoAcceso.set(true);
    this.error.set(null);
    this.mensajeExito.set(null);
    this.srv.bloquearUsuario(s.usuario_id).subscribe({
      next: (res) => {
        this.bloqueandoAcceso.set(false);
        this.mensajeExito.set(res.mensaje);
        this.cerrarMapa();
        this.buscar();
      },
      error: (err) => {
        this.bloqueandoAcceso.set(false);
        this.error.set(err?.error?.mensaje || 'No se pudo bloquear el acceso del usuario.');
      },
    });
  }

  formatoDuracion(segundos: number | null): string {
    if (segundos == null) return '-';
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    if (horas > 0) return `${horas}h ${minutos}m`;
    if (minutos > 0) return `${minutos}m`;
    return '< 1m';
  }

  etiquetaMotivo(motivo: MotivoSalida): string {
    switch (motivo) {
      case 'en_curso': return 'En curso';
      case 'logout_usuario': return 'Cierre manual';
      case 'inactividad': return 'Inactividad';
      case 'token_invalido': return 'Token invalido';
      case 'expiracion_token': return 'Token expirado';
      case 'expiracion_automatica': return 'Expiracion automatica';
      case 'expirada_sin_cerrar': return 'Expirada sin cerrar';
      case 'cerrada_por_admin': return 'Cerrada por admin';
      default: return motivo;
    }
  }

  claseMotivo(motivo: MotivoSalida): string {
    switch (motivo) {
      case 'en_curso': return 'badge-green';
      case 'inactividad':
      case 'expirada_sin_cerrar':
      case 'expiracion_automatica': return 'badge-amber';
      case 'cerrada_por_admin': return 'badge-red';
      default: return 'badge-slate';
    }
  }
}
