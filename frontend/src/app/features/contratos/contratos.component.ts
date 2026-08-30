import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ContratosService } from '../../core/services/contratos.service';
import { ClientesService } from '../../core/services/clientes.service';
import { AuthService } from '../../core/services/auth.service';
import { Contrato, Cliente, EstadoContrato } from '../../core/models/models';

@Component({
  selector: 'app-contratos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './contratos.component.html',
  styleUrl: './contratos.component.css',
})
export class ContratosComponent implements OnInit {
  contratos = signal<Contrato[]>([]);
  clientes = signal<Cliente[]>([]);
  panelAbierto = signal(false);
  contratoEditando = signal<Contrato | null>(null);

  // Filtro por columna (uno por cada encabezado de la tabla)
  filtroNumero = signal('');
  filtroCliente = signal('');
  filtroInicio = signal('');
  filtroFin = signal('');
  filtroEstado = signal('');

  hayFiltros = computed(() =>
    !!(this.filtroNumero() || this.filtroCliente() || this.filtroInicio() || this.filtroFin() || this.filtroEstado())
  );

  limpiarFiltros(): void {
    this.filtroNumero.set('');
    this.filtroCliente.set('');
    this.filtroInicio.set('');
    this.filtroFin.set('');
    this.filtroEstado.set('');
  }

  contratosFiltrados = computed(() => {
    const numero = this.filtroNumero().trim().toLowerCase();
    const cliente = this.filtroCliente().trim().toLowerCase();
    const inicio = this.filtroInicio().trim().toLowerCase();
    const fin = this.filtroFin().trim().toLowerCase();
    const estado = this.filtroEstado().trim().toLowerCase();

    return this.contratos().filter((c) => {
      if (numero && !(c.numero_contrato ?? '').toLowerCase().includes(numero)) return false;
      if (cliente && !(c.cliente_nombre ?? '').toLowerCase().includes(cliente)) return false;
      if (inicio && !formatearFecha(c.fecha_inicio).includes(inicio)) return false;
      if (fin && !(c.fecha_fin ? formatearFecha(c.fecha_fin) : '-').includes(fin)) return false;
      if (estado && !this.vigencia(c).texto.toLowerCase().includes(estado)) return false;
      return true;
    });
  });

  columnaOrden = signal<keyof Contrato | null>(null);
  direccionOrden = signal<'asc' | 'desc'>('asc');

  contratosOrdenados = computed(() => {
    const columna = this.columnaOrden();
    const filas = [...this.contratosFiltrados()];
    if (!columna) return filas;
    const direccion = this.direccionOrden() === 'asc' ? 1 : -1;
    return filas.sort((a, b) => {
      const valorA = a[columna];
      const valorB = b[columna];
      if (valorA == null && valorB == null) return 0;
      if (valorA == null) return -1 * direccion;
      if (valorB == null) return 1 * direccion;
      return String(valorA).localeCompare(String(valorB)) * direccion;
    });
  });

  ordenarPor(columna: keyof Contrato): void {
    if (this.columnaOrden() === columna) {
      this.direccionOrden.set(this.direccionOrden() === 'asc' ? 'desc' : 'asc');
    } else {
      this.columnaOrden.set(columna);
      this.direccionOrden.set('asc');
    }
  }

  indicadorOrden(columna: keyof Contrato): string {
    if (this.columnaOrden() !== columna) return '';
    return this.direccionOrden() === 'asc' ? ' ▲' : ' ▼';
  }

  form = this.fb.group(
    {
      cliente_id: ['', Validators.required],
      numero_contrato: ['', Validators.required],
      fecha_inicio: ['', Validators.required],
      fecha_fin: [''],
      estado: ['activo' as EstadoContrato],
      observaciones: [''],
    },
    { validators: fechaFinNoAnteriorValidator }
  );

  constructor(
    private fb: FormBuilder,
    private srv: ContratosService,
    private clientesSrv: ClientesService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.clientesSrv.listar().subscribe((data) => this.clientes.set(data));
  }

  cargar(): void { this.srv.listar().subscribe((data) => this.contratos.set(data)); }

  abrirNuevo(): void {
    this.contratoEditando.set(null);
    this.form.reset({ estado: 'activo' });
    this.panelAbierto.set(true);
  }

  abrirEditar(c: Contrato): void {
    this.contratoEditando.set(c);
    this.form.reset({
      cliente_id: c.cliente_id,
      numero_contrato: c.numero_contrato,
      fecha_inicio: c.fecha_inicio?.substring(0, 10),
      fecha_fin: c.fecha_fin?.substring(0, 10) ?? '',
      estado: c.estado,
      observaciones: c.observaciones ?? '',
    });
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const editando = this.contratoEditando();
    const peticion = editando
      ? this.srv.actualizar(editando.id, this.form.getRawValue())
      : this.srv.crear(this.form.getRawValue());
    peticion.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el contrato'),
    });
  }

  eliminar(c: Contrato): void {
    if (!confirm(`Eliminar el contrato "${c.numero_contrato}"? Se eliminaran tambien sus horas y registros.`)) return;
    this.srv.eliminar(c.id).subscribe(() => this.cargar());
  }

  vigencia(c: Contrato): { texto: string; clase: string } {
    if (c.estado === 'cancelado') return { texto: 'Cancelado', clase: 'badge-slate' };
    if (c.estado === 'finalizado') return { texto: 'Finalizado', clase: 'badge-slate' };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaInicio = new Date(c.fecha_inicio);
    fechaInicio.setHours(0, 0, 0, 0);
    if (fechaInicio > hoy) return { texto: 'No iniciado', clase: 'badge-slate' };

    if (c.estado === 'vencido') return { texto: 'Vencido', clase: 'badge-red' };

    if (!c.fecha_fin) return { texto: 'Vigente', clase: 'badge-green' };

    const fechaFin = new Date(c.fecha_fin);
    fechaFin.setHours(0, 0, 0, 0);
    const diasRestantes = Math.round((fechaFin.getTime() - hoy.getTime()) / 86400000);

    if (diasRestantes < 0) return { texto: 'Vencido', clase: 'badge-red' };
    if (diasRestantes <= 30) return { texto: `Por vencer (${diasRestantes} d)`, clase: 'badge-amber' };
    return { texto: 'Vigente', clase: 'badge-green' };
  }
}

function fechaFinNoAnteriorValidator(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('fecha_inicio')?.value;
  const fin = group.get('fecha_fin')?.value;
  if (!inicio || !fin) return null;
  return fin < inicio ? { fechaFinAnterior: true } : null;
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}
