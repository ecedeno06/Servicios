import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ClientesService } from '../../core/services/clientes.service';
import { ContratosService } from '../../core/services/contratos.service';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { EquiposAsignadosService } from '../../core/services/equipos-asignados.service';
import { CarritosService } from '../../core/services/carritos.service';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { ConsumoHoras, Contrato, Cliente, EquipoAsignado, EstadoEquipo, Carrito, EstadoCarrito, MovimientoEquipoReciente, RegistroHora } from '../../core/models/models';

const ESTADO_EQUIPO_LABEL: Record<EstadoEquipo, string> = {
  en_uso: 'En uso',
  stock: 'En stock',
  reparacion: 'En reparación',
  dano: 'Dañado',
  descarte: 'Descartado',
  vendida: 'Vendido',
};

const ESTADO_CARRITO_LABEL: Record<EstadoCarrito, string> = {
  en_construccion: 'En construcción',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  clientes = signal<Cliente[]>([]);
  contratos = signal<Contrato[]>([]);
  consumo = signal<ConsumoHoras[]>([]);
  equipos = signal<EquipoAsignado[]>([]);
  carritos = signal<Carrito[]>([]);
  actividadReciente = signal<MovimientoEquipoReciente[]>([]);
  horasRecientes = signal<RegistroHora[]>([]);

  filtroTexto = signal('');
  filtro = signal('');

  clientesActivos = computed(() => this.clientes().filter((c) => c.activo).length);
  contratosActivos = computed(() => this.contratos().filter((c) => c.estado === 'activo').length);
  totalContratadas = computed(() => this.consumo().reduce((acc, f) => acc + Number(f.horas_contratadas), 0));
  totalEjecutadas = computed(() => this.consumo().reduce((acc, f) => acc + Number(f.horas_ejecutadas), 0));

  // Equipos Asignados por estado real (no se inventa un bucket "Asignados":
  // la asignacion a usuario es un campo aparte, ver equiposConAsignacion).
  equiposPorEstado = computed(() => {
    const total = this.equipos().length;
    const conteos = new Map<EstadoEquipo, number>();
    for (const e of this.equipos()) conteos.set(e.estado, (conteos.get(e.estado) ?? 0) + 1);
    return (Object.keys(ESTADO_EQUIPO_LABEL) as EstadoEquipo[])
      .map((estado) => ({
        estado,
        label: ESTADO_EQUIPO_LABEL[estado],
        count: conteos.get(estado) ?? 0,
        pct: total ? Math.round(((conteos.get(estado) ?? 0) / total) * 100) : 0,
      }))
      .filter((f) => f.count > 0);
  });
  totalEquipos = computed(() => this.equipos().length);
  equiposConAsignacion = computed(() => this.equipos().filter((e) => !!e.asignada_a).length);

  // Equipos Asignados por tipo (categoria del producto, ej. Laptop,
  // Monitor...) -- dimension aparte del estado, en pastillas.
  equiposPorTipo = computed(() => {
    const conteos = new Map<string, number>();
    for (const e of this.equipos()) conteos.set(e.categoria_nombre, (conteos.get(e.categoria_nombre) ?? 0) + 1);
    return [...conteos.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  });

  // Carrito de Compras activo (se omite "cerrada" para que la tarjeta
  // muestre solo lo que todavia esta en flujo de aprobacion).
  carritoPorEstado = computed(() => {
    const conteos = new Map<EstadoCarrito, number>();
    for (const c of this.carritos()) conteos.set(c.estado, (conteos.get(c.estado) ?? 0) + 1);
    return (['en_construccion', 'en_revision', 'aprobada'] as EstadoCarrito[]).map((estado) => ({
      estado,
      label: ESTADO_CARRITO_LABEL[estado],
      count: conteos.get(estado) ?? 0,
    }));
  });

  // Ultimas 6 semanas (incluye la actual), lunes a domingo.
  horasPorSemana = computed(() => {
    const semanas: { inicio: Date; horas: number }[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaSemana = (hoy.getDay() + 6) % 7; // 0 = lunes
    const lunesActual = new Date(hoy);
    lunesActual.setDate(hoy.getDate() - diaSemana);
    for (let i = 5; i >= 0; i--) {
      const inicio = new Date(lunesActual);
      inicio.setDate(lunesActual.getDate() - i * 7);
      semanas.push({ inicio, horas: 0 });
    }
    for (const r of this.horasRecientes()) {
      const fecha = new Date(r.fecha);
      fecha.setHours(0, 0, 0, 0);
      const semana = semanas.find((s) => {
        const fin = new Date(s.inicio);
        fin.setDate(s.inicio.getDate() + 7);
        return fecha >= s.inicio && fecha < fin;
      });
      if (semana) semana.horas += Number(r.horas) || 0;
    }
    const max = Math.max(1, ...semanas.map((s) => s.horas));
    return semanas.map((s) => ({
      label: s.inicio.toLocaleDateString('es', { day: '2-digit', month: '2-digit' }),
      horas: s.horas,
      pct: Math.round((s.horas / max) * 100),
    }));
  });

  consumoFiltrado = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return this.consumo();
    return this.consumo().filter((f) =>
      [f.cliente_nombre, f.numero_contrato, f.tipo_servicio_nombre]
        .some((campo) => (campo ?? '').toLowerCase().includes(texto))
    );
  });

  constructor(
    private clientesSrv: ClientesService,
    private contratosSrv: ContratosService,
    private horasSrv: RegistroHorasService,
    private equiposSrv: EquiposAsignadosService,
    private carritosSrv: CarritosService,
    private menuSrv: MenuService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    // El rol cliente no tiene acceso a /clientes ni /contratos (ver
    // PORTAL-CLIENTE.md) -- no se piden para no romper el resto del
    // resumen con un 403. Lo mismo para Equipos Asignados y Carrito de
    // Compras: se consultan solo si el rol tiene permiso de "ver" sobre
    // esos menus (puede no tenerlo aunque no sea cliente).
    const esCliente = this.auth.esCliente();
    const puedeEquipos = this.menuSrv.tienePermiso('equipos_asignados');
    const puedeCarrito = this.menuSrv.tienePermiso('carrito_compras');
    const hace6Semanas = new Date();
    hace6Semanas.setDate(hace6Semanas.getDate() - 41);

    forkJoin({
      clientes: esCliente ? of([]) : this.clientesSrv.listar(),
      contratos: esCliente ? of([]) : this.contratosSrv.listar(),
      consumo: this.horasSrv.consumoGeneral(),
      equipos: puedeEquipos ? this.equiposSrv.listar() : of([]),
      actividadReciente: puedeEquipos ? this.equiposSrv.historialReciente(8) : of([]),
      carritos: puedeCarrito ? this.carritosSrv.listar() : of([]),
      horasRecientes: this.horasSrv.listar({ desde: hace6Semanas.toISOString().slice(0, 10) }),
    }).subscribe(({ clientes, contratos, consumo, equipos, actividadReciente, carritos, horasRecientes }) => {
      this.clientes.set(clientes);
      this.contratos.set(contratos);
      this.consumo.set(consumo);
      this.equipos.set(equipos);
      this.actividadReciente.set(actividadReciente);
      this.carritos.set(carritos);
      this.horasRecientes.set(horasRecientes);
    });
  }

  aplicarFiltro(): void { this.filtro.set(this.filtroTexto()); }
  limpiarFiltro(): void { this.filtroTexto.set(''); this.filtro.set(''); }

  nombresContactos(fila: ConsumoHoras): string {
    return (fila.contactos ?? []).map((c) => c.nombre).filter(Boolean).join(', ');
  }

  detalleContactos(fila: ConsumoHoras): string {
    return (fila.contactos ?? [])
      .map((c) => [c.nombre, c.correo, c.telefono].filter(Boolean).join(' - '))
      .join('\n');
  }

  porcentaje(fila: ConsumoHoras): number {
    if (!fila.horas_contratadas) return 0;
    const pct = (fila.horas_ejecutadas / fila.horas_contratadas) * 100;
    return Math.min(100, Math.round(pct));
  }

  nivel(fila: ConsumoHoras): 'ok' | 'warn' | 'danger' {
    const pct = this.porcentaje(fila);
    if (pct >= 100) return 'danger';
    if (pct >= 80) return 'warn';
    return 'ok';
  }

  observaciones(contratoId: string): string {
    const contrato = this.contratos().find((c) => c.id === contratoId);
    return contrato?.observaciones || 'Sin observaciones registradas.';
  }

  vigencia(contratoId: string): { texto: string; clase: string } {
    const contrato = this.contratos().find((c) => c.id === contratoId);
    if (!contrato) return { texto: '-', clase: 'badge-slate' };

    if (contrato.estado === 'cancelado') return { texto: 'Cancelado', clase: 'badge-slate' };
    if (contrato.estado === 'finalizado') return { texto: 'Finalizado', clase: 'badge-slate' };

    const hoy0 = new Date();
    hoy0.setHours(0, 0, 0, 0);
    const fechaInicio = new Date(contrato.fecha_inicio);
    fechaInicio.setHours(0, 0, 0, 0);
    if (fechaInicio > hoy0) return { texto: 'No iniciado', clase: 'badge-slate' };

    if (contrato.estado === 'vencido') return { texto: 'Vencido', clase: 'badge-red' };

    if (!contrato.fecha_fin) return { texto: 'Vigente', clase: 'badge-green' };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaFin = new Date(contrato.fecha_fin);
    fechaFin.setHours(0, 0, 0, 0);
    const diasRestantes = Math.round((fechaFin.getTime() - hoy.getTime()) / 86400000);

    if (diasRestantes < 0) return { texto: 'Vencido', clase: 'badge-red' };
    if (diasRestantes <= 30) return { texto: `Por vencer (${diasRestantes} d)`, clase: 'badge-amber' };
    return { texto: 'Vigente', clase: 'badge-green' };
  }

  descripcionMovimiento(m: MovimientoEquipoReciente): string {
    const cambioEstado = m.estado_anterior && m.estado_anterior !== m.estado_nuevo;
    const cambioAsignacion = m.asignada_a !== m.asignada_a_anterior;
    if (cambioEstado && cambioAsignacion) {
      return `${ESTADO_EQUIPO_LABEL[m.estado_anterior!]} -> ${ESTADO_EQUIPO_LABEL[m.estado_nuevo]} - Asignado a ${m.asignada_a || 'sin asignar'}`;
    }
    if (cambioEstado) {
      return `${m.estado_anterior ? ESTADO_EQUIPO_LABEL[m.estado_anterior] + ' -> ' : ''}${ESTADO_EQUIPO_LABEL[m.estado_nuevo]}`;
    }
    if (cambioAsignacion) {
      return m.asignada_a ? `Asignado a ${m.asignada_a}` : 'Se quito la asignacion';
    }
    return ESTADO_EQUIPO_LABEL[m.estado_nuevo];
  }
}
