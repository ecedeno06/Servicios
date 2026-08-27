import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContratosService } from '../../core/services/contratos.service';
import { TiposServicioService } from '../../core/services/tipos-servicio.service';
import { Contrato, Documento, TipoServicio } from '../../core/models/models';

@Component({
  selector: 'app-contrato-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    @if (contrato(); as c) {
      <div class="page-header">
        <div>
          <h1>Contrato {{ c.numero_contrato }}</h1>
          <div class="desc">{{ c.cliente_nombre }} &middot; {{ c.fecha_inicio | date:'dd/MM/yyyy' }} - {{ c.fecha_fin ? (c.fecha_fin | date:'dd/MM/yyyy') : 'sin fecha de fin' }}</div>
        </div>
        <a routerLink="/contratos" class="btn btn-outline">&larr; Volver a contratos</a>
      </div>

      <div class="card">
        <h2 style="margin:0;">Observaciones</h2>
        <p class="mt-16" style="margin-bottom:0; white-space: pre-wrap;">{{ c.observaciones || 'Sin observaciones registradas.' }}</p>
      </div>

      <div class="card mt-16">
        <div class="flex items-center gap-12" style="justify-content: space-between;">
          <h2 style="margin:0;">Horas establecidas por tipo de servicio</h2>
          <button class="btn btn-accent btn-sm" (click)="panelAbierto.set(true)">+ Asignar servicio</button>
        </div>

        <div class="table-wrap mt-16">
          <table class="data-table">
            <thead>
              <tr><th>Servicio</th><th>Contratadas</th><th>Ejecutadas</th><th>Disponibilidad</th><th></th></tr>
            </thead>
            <tbody>
              @for (s of c.servicios; track s.contrato_servicio_id) {
                <tr>
                  <td>{{ s.tipo_servicio_nombre }}</td>
                  <td>{{ s.horas_contratadas | number:'1.0-1' }}</td>
                  <td>{{ s.horas_ejecutadas | number:'1.0-1' }}</td>
                  <td>
                    <div class="hour-gauge" [class.warn]="pct(s) >= 80 && pct(s) < 100" [class.danger]="pct(s) >= 100">
                      <div class="track"><div class="fill" [style.width.%]="pct(s)"></div></div>
                      <div class="meta"><span>{{ s.horas_disponibles | number:'1.0-1' }} h libres</span><span>{{ pct(s) }}%</span></div>
                    </div>
                  </td>
                  <td class="table-actions">
                    <button class="btn btn-outline btn-sm" (click)="editarHoras(s)">Editar</button>
                    <button class="btn btn-danger btn-sm" (click)="eliminarServicio(s.contrato_servicio_id)">Quitar</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5"><div class="empty-state">Este contrato aun no tiene horas asignadas por servicio.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mt-16">
        <div class="flex items-center gap-12" style="justify-content: space-between;">
          <h2 style="margin:0;">Documentos</h2>
          <button class="btn btn-accent btn-sm" (click)="panelDocAbierto.set(true)">+ Agregar documento</button>
        </div>

        <div class="table-wrap mt-16">
          <table class="data-table">
            <thead>
              <tr><th>Nombre</th><th>URL</th><th></th></tr>
            </thead>
            <tbody>
              @for (d of c.documentos; track d.url) {
                <tr>
                  <td>{{ d.nombre }}</td>
                  <td><a [href]="d.url" target="_blank" rel="noopener">Abrir</a></td>
                  <td class="table-actions">
                    <button class="btn btn-danger btn-sm" (click)="quitarDocumento(d)">Quitar</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="3"><div class="empty-state">Este contrato aun no tiene documentos asociados.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (panelAbierto()) {
      <div class="overlay" (click)="panelAbierto.set(false)">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>Asignar tipo de servicio</h2>
            <button class="close" (click)="panelAbierto.set(false)">&times;</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="guardarServicio()">
            <div class="form-group">
              <label>Tipo de servicio *</label>
              <select class="input" formControlName="tipo_servicio_id">
                <option value="" disabled>Selecciona un servicio</option>
                @for (t of tiposServicio(); track t.id) { <option [value]="t.id">{{ t.nombre }}</option> }
              </select>
            </div>
            <div class="form-group mt-16">
              <label>Horas contratadas *</label>
              <input class="input" type="number" min="0" step="0.5" formControlName="horas_contratadas" />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="form.invalid">Guardar</button>
              <button type="button" class="btn btn-outline" (click)="panelAbierto.set(false)">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (editandoServicio(); as s) {
      <div class="overlay" (click)="cancelarEdicion()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>Editar horas contratadas</h2>
            <button class="close" (click)="cancelarEdicion()">&times;</button>
          </div>
          <form (ngSubmit)="guardarHoras(s.contrato_servicio_id)">
            <div class="form-group">
              <label>Tipo de servicio</label>
              <input class="input" type="text" [value]="s.tipo_servicio_nombre" disabled />
            </div>
            <div class="form-group mt-16">
              <label>Horas contratadas *</label>
              <input class="input" type="number" min="0" step="0.5" [(ngModel)]="horasEdit" name="horasEdit" required />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="horasEdit < 0">Guardar</button>
              <button type="button" class="btn btn-outline" (click)="cancelarEdicion()">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (panelDocAbierto()) {
      <div class="overlay" (click)="panelDocAbierto.set(false)">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h2>Agregar documento</h2>
            <button class="close" (click)="panelDocAbierto.set(false)">&times;</button>
          </div>
          <form [formGroup]="docForm" (ngSubmit)="guardarDocumento()">
            <div class="form-group">
              <label>Nombre *</label>
              <input class="input" formControlName="nombre" placeholder="Contrato firmado.pdf" />
            </div>
            <div class="form-group mt-16">
              <label>URL (OneDrive u otro origen) *</label>
              <input class="input" type="url" formControlName="url" placeholder="https://onedrive.live.com/..." />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="docForm.invalid">Guardar</button>
              <button type="button" class="btn btn-outline" (click)="panelDocAbierto.set(false)">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
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
    private tiposSrv: TiposServicioService
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
