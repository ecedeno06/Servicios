import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContratosService } from '../../core/services/contratos.service';
import { TiposServicioService } from '../../core/services/tipos-servicio.service';
import { AuthService } from '../../core/services/auth.service';
import { Contrato, Documento, TipoServicio } from '../../core/models/models';

@Component({
  selector: 'app-contrato-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './contrato-detalle.component.html',
  styleUrl: './contrato-detalle.component.css',
})
export class ContratoDetalleComponent implements OnInit {
  contrato = signal<Contrato | null>(null);
  tiposServicio = signal<TipoServicio[]>([]);
  panelAbierto = signal(false);
  editandoServicio = signal<{ contrato_servicio_id: string; tipo_servicio_nombre: string; horas_contratadas: number } | null>(null);
  horasEdit = 0;
  panelDocAbierto = signal(false);
  private contratoId = '';

  form = this.fb.group({
    tipo_servicio_id: ['', Validators.required],
    horas_contratadas: [0, [Validators.required, Validators.min(0.5)]],
  });

  docForm = this.fb.group({
    nombre: ['', Validators.required],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private srv: ContratosService,
    private tiposSrv: TiposServicioService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.contratoId = this.route.snapshot.paramMap.get('id')!;
    this.tiposSrv.listar().subscribe((data) => this.tiposServicio.set(data));
    this.cargar();
  }

  cargar(): void { this.srv.obtener(this.contratoId).subscribe((data) => this.contrato.set(data)); }

  pct(s: { horas_contratadas: number; horas_ejecutadas: number }): number {
    if (!s.horas_contratadas) return 0;
    return Math.min(100, Math.round((s.horas_ejecutadas / s.horas_contratadas) * 100));
  }

  guardarServicio(): void {
    if (this.form.invalid) return;
    this.srv.agregarServicio(this.contratoId, this.form.getRawValue()).subscribe({
      next: () => { this.panelAbierto.set(false); this.form.reset({ horas_contratadas: 0 }); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo asignar el servicio'),
    });
  }

  eliminarServicio(contratoServicioId: string): void {
    if (!confirm('Quitar este servicio del contrato? Se perdera el historial de horas asociado.')) return;
    this.srv.eliminarServicio(this.contratoId, contratoServicioId).subscribe(() => this.cargar());
  }

  editarHoras(s: { contrato_servicio_id: string; tipo_servicio_nombre: string; horas_contratadas: number }): void {
    this.editandoServicio.set(s);
    this.horasEdit = s.horas_contratadas;
  }

  cancelarEdicion(): void { this.editandoServicio.set(null); }

  guardarHoras(contratoServicioId: string): void {
    if (this.horasEdit < 0) return;
    this.srv.actualizarServicio(this.contratoId, contratoServicioId, { horas_contratadas: this.horasEdit }).subscribe({
      next: () => { this.editandoServicio.set(null); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudieron actualizar las horas contratadas'),
    });
  }

  guardarDocumento(): void {
    if (this.docForm.invalid) return;
    const documentos = [...(this.contrato()?.documentos ?? []), this.docForm.getRawValue() as Documento];
    this.srv.actualizar(this.contratoId, { documentos }).subscribe({
      next: () => { this.panelDocAbierto.set(false); this.docForm.reset(); this.cargar(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo agregar el documento'),
    });
  }

  quitarDocumento(doc: Documento): void {
    if (!confirm(`Quitar el documento "${doc.nombre}"?`)) return;
    const documentos = (this.contrato()?.documentos ?? []).filter((d) => d.url !== doc.url);
    this.srv.actualizar(this.contratoId, { documentos }).subscribe(() => this.cargar());
  }
}
