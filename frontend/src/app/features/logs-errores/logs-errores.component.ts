import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogsService } from '../../core/services/logs.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { LogError, NivelLog } from '../../core/models/models';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function haceDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-logs-errores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs-errores.component.html',
  styleUrl: './logs-errores.component.css',
})
export class LogsErroresComponent implements OnInit {
  logs = signal<LogError[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);
  buscado = signal(false);

  desde = signal(haceDiasISO(7));
  hasta = signal(hoyISO());
  nivelTexto = signal('');
  rutaTexto = signal('');
  mensajeTexto = signal('');

  logDetalle = signal<LogError | null>(null);

  seleccionados = signal<Set<string>>(new Set());
  eliminando = signal(false);
  totalSeleccionados = computed(() => this.seleccionados().size);

  // Filtros por columna (coincidencia parcial, sin distinguir mayusculas),
  // aplicados en el cliente sobre lo ya cargado del servidor -- mismo
  // patron que auditoria-sesiones.
  filtroFecha = signal('');
  filtroMetodoRuta = signal('');
  filtroMensaje = signal('');
  filtroUsuario = signal('');
  filtroEmpresa = signal('');
  filtroStatus = signal('');

  hayFiltrosColumna = computed(() =>
    !!(this.filtroFecha() || this.filtroMetodoRuta() || this.filtroMensaje() || this.filtroUsuario() || this.filtroEmpresa() || this.filtroStatus())
  );

  logsFiltrados = computed(() => {
    const contiene = (valor: string, filtro: string) => valor.toLowerCase().includes(filtro.toLowerCase().trim());

    const fFecha = this.filtroFecha();
    const fMetodoRuta = this.filtroMetodoRuta();
    const fMensaje = this.filtroMensaje();
    const fUsuario = this.filtroUsuario();
    const fEmpresa = this.filtroEmpresa();
    const fStatus = this.filtroStatus();

    return this.logs().filter((l) => {
      if (fFecha && !contiene(this.formatoFecha(l.created_at), fFecha)) return false;
      if (fMetodoRuta && !contiene(`${l.metodo_http || ''} ${l.ruta || ''}`, fMetodoRuta)) return false;
      if (fMensaje && !contiene(l.mensaje, fMensaje)) return false;
      if (fUsuario && !contiene(`${l.usuario_nombre || ''} ${l.usuario_email || ''}`, fUsuario)) return false;
      if (fEmpresa && !contiene(l.empresa_nombre || '', fEmpresa)) return false;
      if (fStatus && !contiene(String(l.status_http ?? ''), fStatus)) return false;
      return true;
    });
  });

  // Orden por columna (click en el encabezado alterna asc/desc).
  columnaOrden = signal<string | null>('fecha');
  direccionOrden = signal<'asc' | 'desc'>('desc');

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

  private valorOrden(l: LogError, columna: string): string | number {
    switch (columna) {
      case 'fecha': return new Date(l.created_at).getTime();
      case 'metodoRuta': return `${l.metodo_http || ''} ${l.ruta || ''}`.toLowerCase();
      case 'mensaje': return l.mensaje.toLowerCase();
      case 'usuario': return (l.usuario_nombre || '').toLowerCase();
      case 'empresa': return (l.empresa_nombre || '').toLowerCase();
      case 'status': return l.status_http ?? -1;
      default: return '';
    }
  }

  logsOrdenados = computed(() => {
    const columna = this.columnaOrden();
    const filtrados = this.logsFiltrados();
    if (!columna) return filtrados;
    const signo = this.direccionOrden() === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = this.valorOrden(a, columna);
      const vb = this.valorOrden(b, columna);
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return 0;
    });
  });

  constructor(private srv: LogsService, private toast: ToastService, private confirmSrv: ConfirmService) {}

  ngOnInit(): void {
    this.buscar();
  }

  limpiarFiltrosColumna(): void {
    this.filtroFecha.set('');
    this.filtroMetodoRuta.set('');
    this.filtroMensaje.set('');
    this.filtroUsuario.set('');
    this.filtroEmpresa.set('');
    this.filtroStatus.set('');
  }

  formatoFecha(iso: string): string {
    return formatDate(iso, 'dd/MM/yyyy HH:mm:ss', 'en-US');
  }

  // Desde/Hasta vacios -> el backend no aplica limite de fecha (ver
  // LogsService.listar/logs.controller.js listar), asi que esto trae todo
  // el historico (hasta el tope de 500 filas por busqueda).
  verTodoElHistorico(): void {
    this.desde.set('');
    this.hasta.set('');
    this.buscar();
  }

  buscar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.limpiarFiltrosColumna();
    this.seleccionados.set(new Set());

    this.srv
      .listar({
        desde: this.desde(),
        hasta: this.hasta(),
        nivel: this.nivelTexto().trim(),
        ruta: this.rutaTexto().trim(),
        mensaje: this.mensajeTexto().trim(),
      })
      .subscribe({
        next: (data) => {
          this.logs.set(data);
          this.buscado.set(true);
          this.cargando.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.mensaje || 'No se pudo cargar el log de errores.');
          this.logs.set([]);
          this.cargando.set(false);
        },
      });
  }

  estaSeleccionado(id: string): boolean {
    return this.seleccionados().has(id);
  }

  todosVisiblesSeleccionados(): boolean {
    const ids = this.logsOrdenados().map((l) => l.id);
    return ids.length > 0 && ids.every((id) => this.estaSeleccionado(id));
  }

  toggleSeleccion(id: string): void {
    const actuales = new Set(this.seleccionados());
    if (actuales.has(id)) actuales.delete(id);
    else actuales.add(id);
    this.seleccionados.set(actuales);
  }

  toggleSeleccionarTodos(): void {
    const idsVisibles = this.logsOrdenados().map((l) => l.id);
    const todosSeleccionados = idsVisibles.length > 0 && idsVisibles.every((id) => this.seleccionados().has(id));
    this.seleccionados.set(todosSeleccionados ? new Set() : new Set(idsVisibles));
  }

  async eliminarSeleccionados(): Promise<void> {
    const ids = Array.from(this.seleccionados());
    if (ids.length === 0) return;
    const ok = await this.confirmSrv.confirmar(`Eliminar ${ids.length} log(s) seleccionado(s)? Esta accion no se puede deshacer.`, { titulo: 'Eliminar logs' });
    if (!ok) return;

    this.eliminando.set(true);
    this.srv.eliminar(ids).subscribe({
      next: (res) => {
        this.eliminando.set(false);
        this.toast.exito(`Se eliminaron ${res.eliminados} log(s).`);
        this.buscar();
      },
      error: (err) => {
        this.eliminando.set(false);
        this.toast.error(err?.error?.mensaje || 'No se pudieron eliminar los logs seleccionados.');
      },
    });
  }

  claseNivel(nivel: NivelLog): string {
    switch (nivel) {
      case 'exito': return 'badge-green';
      case 'advertencia': return 'badge-amber';
      case 'info': return 'badge-slate';
      default: return 'badge-red';
    }
  }

  claseStatus(status: number | null): string {
    if (status == null) return 'badge-slate';
    if (status >= 500) return 'badge-red';
    if (status >= 400) return 'badge-amber';
    return 'badge-slate';
  }

  abrirDetalle(l: LogError): void {
    this.logDetalle.set(l);
  }

  cerrarDetalle(): void {
    this.logDetalle.set(null);
  }

  bodyFormateado(l: LogError): string {
    if (!l.body) return '-';
    try {
      return JSON.stringify(l.body, null, 2);
    } catch {
      return String(l.body);
    }
  }
}
