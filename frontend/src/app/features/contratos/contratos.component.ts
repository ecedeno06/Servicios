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

  filtroTexto = signal('');
  filtro = signal('');

  contratosFiltrados = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return this.contratos();
    return this.contratos().filter((c) =>
      [c.numero_contrato, c.cliente_nombre].some((campo) => (campo ?? '').toLowerCase().includes(texto))
    );
  });

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

  aplicarFiltro(): void { this.filtro.set(this.filtroTexto()); }
  limpiarFiltro(): void { this.filtroTexto.set(''); this.filtro.set(''); }

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
