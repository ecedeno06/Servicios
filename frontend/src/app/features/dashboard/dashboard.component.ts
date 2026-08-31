import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ClientesService } from '../../core/services/clientes.service';
import { ContratosService } from '../../core/services/contratos.service';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { AuthService } from '../../core/services/auth.service';
import { ConsumoHoras, Contrato, Cliente } from '../../core/models/models';

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
    private horasSrv: RegistroHorasService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    // El rol cliente no tiene acceso a /clientes ni /contratos (ver
    // PORTAL-CLIENTE.md) -- no se piden para no romper el resto del
    // resumen con un 403.
    const esCliente = this.auth.esCliente();
    forkJoin({
      clientes: esCliente ? of([]) : this.clientesSrv.listar(),
      contratos: esCliente ? of([]) : this.contratosSrv.listar(),
      consumo: this.horasSrv.consumoGeneral(),
    }).subscribe(({ clientes, contratos, consumo }) => {
      this.clientes.set(clientes);
      this.contratos.set(contratos);
      this.consumo.set(consumo);
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
}
