import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientesService } from '../../core/services/clientes.service';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { AuthService } from '../../core/services/auth.service';
import { ReporteResumenHorasPdfService } from '../../core/services/reporte-resumen-horas-pdf.service';
import { Cliente, RegistroHora } from '../../core/models/models';

@Component({
  selector: 'app-reporte-horas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reporte-horas.component.html',
  styleUrl: './reporte-horas.component.css',
})
export class ReporteHorasComponent implements OnInit {
  clientes = signal<Cliente[]>([]);
  generando = signal(false);
  errorGenerar = signal<string | null>(null);

  filtroForm = this.fb.group({
    cliente: [''],
    fechaInicio: [primerDiaDelMes(), Validators.required],
    fechaFin: [hoyISO(), Validators.required],
  });

  constructor(
    private fb: FormBuilder,
    private clientesSrv: ClientesService,
    private horasSrv: RegistroHorasService,
    private pdfSrv: ReporteResumenHorasPdfService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.clientesSrv.listar().subscribe((data) => this.clientes.set(data));
  }

  generarReporte(): void {
    if (this.filtroForm.invalid) return;
    // La ventana se abre YA, sincronicamente dentro del click, para que el
    // navegador no la bloquee (mismo patron que en registro-horas).
    const ventana = window.open('', '_blank') ?? undefined;
    const { cliente, fechaInicio, fechaFin } = this.filtroForm.getRawValue();

    this.errorGenerar.set(null);
    this.generando.set(true);
    this.horasSrv.listar({ desde: fechaInicio!, hasta: fechaFin! }).subscribe({
      next: (registros: RegistroHora[]) => {
        const filtrados = cliente
          ? registros.filter((r) => r.cliente_nombre === cliente)
          : registros;

        const empresa = this.auth.empresaActiva();
        this.pdfSrv
          .generar(
            filtrados,
            { cliente: cliente ?? '', fechaInicio: fechaInicio!, fechaFin: fechaFin! },
            { nombre: empresa?.empresa_nombre, logo: empresa?.empresa_logo }
          )
          .then((doc) => doc.open(undefined, ventana))
          .catch(() => this.errorGenerar.set('No se pudo generar el reporte.'))
          .finally(() => this.generando.set(false));
      },
      error: () => {
        this.generando.set(false);
        this.errorGenerar.set('No se pudieron cargar los registros de horas.');
      },
    });
  }
}

function hoyISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
