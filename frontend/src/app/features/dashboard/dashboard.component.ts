import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ClientesService } from '../../core/services/clientes.service';
import { ContratosService } from '../../core/services/contratos.service';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { ConsumoHoras, Contrato, Cliente } from '../../core/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Resumen general</h1>
        <div class="desc">Estado actual de clientes, contratos y consumo de horas</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Clientes activos</div>
        <div class="value">{{ clientesActivos() }}</div>
      </div>
      <div class="stat-card">
        <div class="label">Contratos activos</div>
        <div class="value">{{ contratosActivos() }}</div>
      </div>
      <div class="stat-card">
        <div class="label">Horas contratadas</div>
        <div class="value">{{ totalContratadas() | number:'1.0-1' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">Horas ejecutadas</div>
        <div class="value">{{ totalEjecutadas() | number:'1.0-1' }}</div>
      </div>
    </div>

    <h2>Consumo de horas por contrato y servicio</h2>
    <p class="desc mt-16" style="margin-bottom:10px;">Bolsas de horas cerca de agotarse aparecen en amarillo o rojo</p>

    <div class="filter-bar">
      <input
        class="input"
        type="text"
        placeholder="Buscar por cliente, contrato o servicio..."
        [ngModel]="filtroTexto()"
        (ngModelChange)="filtroTexto.set($event)"
        (keyup.enter)="aplicarFiltro()"
      />
      <button class="btn btn-primary" (click)="aplicarFiltro()">Filtrar</button>
      @if (filtro()) {
        <button class="btn btn-outline" (click)="limpiarFiltro()">Limpiar</button>
      }
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Contrato</th>
            <th>Servicio</th>
            <th>Contratadas</th>
            <th>Ejecutadas</th>
            <th>Disponibilidad</th>
            <th>Vigencia</th>
          </tr>
        </thead>
        <tbody>
          @for (fila of consumoFiltrado(); track fila.contrato_servicio_id) {
            <tr>
              <td>{{ fila.cliente_nombre }}</td>
              <td><a [routerLink]="['/contratos', fila.contrato_id]">{{ fila.numero_contrato }}</a></td>
              <td>{{ fila.tipo_servicio_nombre }}</td>
              <td>{{ fila.horas_contratadas | number:'1.0-1' }}</td>
              <td>{{ fila.horas_ejecutadas | number:'1.0-1' }}</td>
              <td>
                <div class="hour-gauge" [class.warn]="nivel(fila) === 'warn'" [class.danger]="nivel(fila) === 'danger'">
                  <div class="track"><div class="fill" [style.width.%]="porcentaje(fila)"></div></div>
                  <div class="meta">
                    <span>{{ fila.horas_disponibles | number:'1.0-1' }} h libres</span>
                    <span>{{ porcentaje(fila) }}%</span>
                  </div>
                </div>
              </td>
              <td><span class="badge" [ngClass]="vigencia(fila.contrato_id).clase">{{ vigencia(fila.contrato_id).texto }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="7"><div class="empty-state">{{ filtro() ? 'Ningun resultado coincide con la busqueda.' : 'Aun no hay horas establecidas en ningun contrato.' }}</div></td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  clientes = signal<Cliente[]>([]);
  contratos = signal<Contrato[]>([]);
  consumo = signal<ConsumoHoras[]>([]);

  filtroTexto = signal('');
  filtro = signal('');

  clientesActivos = computed(() => this.clientes().filter((c) => c.activo).length);
  contratosActivos = computed(() => this.contratos().filter((c) => c.estado === 'activo').length);
  totalContratadas = computed(() => this.consumo().reduce((acc, f) => acc + Number(f.horas_contratadas), 0));
  totalEjecutadas = computed(() => this.consumo().reduce((acc, f) => acc + Number(f.horas_ejecutadas), 0));

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
    private horasSrv: RegistroHorasService
  ) {}

  ngOnInit(): void {
    forkJoin({
      clientes: this.clientesSrv.listar(),
      contratos: this.contratosSrv.listar(),
      consumo: this.horasSrv.consumoGeneral(),
    }).subscribe(({ clientes, contratos, consumo }) => {
      this.clientes.set(clientes);
      this.contratos.set(contratos);
      this.consumo.set(consumo);
    });
  }

  aplicarFiltro(): void { this.filtro.set(this.filtroTexto()); }
  limpiarFiltro(): void { this.filtroTexto.set(''); this.filtro.set(''); }

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

  vigencia(contratoId: string): { texto: string; clase: string } {
    const contrato = this.contratos().find((c) => c.id === contratoId);
    if (!contrato) return { texto: '-', clase: 'badge-slate' };

    if (contrato.estado === 'cancelado') return { texto: 'Cancelado', clase: 'badge-slate' };
    if (contrato.estado === 'finalizado') return { texto: 'Finalizado', clase: 'badge-slate' };
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
}
