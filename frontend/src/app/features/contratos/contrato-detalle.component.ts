import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContratosService } from '../../core/services/contratos.service';
import { TiposServicioService } from '../../core/services/tipos-servicio.service';
import { AuthService } from '../../core/services/auth.service';
import { Contacto, ConsumoHoras, Contrato, Documento, TipoServicio } from '../../core/models/models';

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
  editandoServicio = signal<ConsumoHoras | null>(null);
  horasEdit = 0;
  panelDocAbierto = signal(false);
  private contratoId = '';

  form = this.fb.group({
    tipo_servicio_id: ['', Validators.required],
    horas_contratadas: [0, [Validators.required, Validators.min(0.5)]],
    contactos: this.fb.array([this.crearContactoGroup()]),
  });

  contactosEditForm = this.fb.group({
    contactos: this.fb.array([this.crearContactoGroup()]),
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

  nombresContactos(s: ConsumoHoras): string {
    return (s.contactos ?? []).map((c) => c.nombre).filter(Boolean).join(', ');
  }

  detalleContactos(s: ConsumoHoras): string {
    return (s.contactos ?? [])
      .map((c) => [c.nombre, c.correo, c.telefono].filter(Boolean).join(' - '))
      .join('\n');
  }

  private crearContactoGroup(c?: Contacto): FormGroup {
    return this.fb.group({
      nombre: [c?.nombre ?? ''],
      correo: [c?.correo ?? '', Validators.email],
      telefono: [c?.telefono ?? ''],
    });
  }

  get contactosArray(): FormArray {
    return this.form.get('contactos') as FormArray;
  }

  get contactosEditArray(): FormArray {
    return this.contactosEditForm.get('contactos') as FormArray;
  }

  agregarContactoForm(): void {
    this.contactosArray.push(this.crearContactoGroup());
  }

  quitarContactoForm(i: number): void {
    this.contactosArray.removeAt(i);
  }

  agregarContactoEdit(): void {
    this.contactosEditArray.push(this.crearContactoGroup());
  }

  quitarContactoEdit(i: number): void {
    this.contactosEditArray.removeAt(i);
  }

  guardarServicio(): void {
    if (this.form.invalid) return;
    const { tipo_servicio_id, horas_contratadas, contactos } = this.form.getRawValue();
    this.srv.agregarServicio(this.contratoId, { tipo_servicio_id, horas_contratadas, contactos: limpiarContactos(contactos) }).subscribe({
      next: () => {
        this.panelAbierto.set(false);
        this.form.reset({ horas_contratadas: 0 });
        this.contactosArray.clear();
        this.contactosArray.push(this.crearContactoGroup());
        this.cargar();
      },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo asignar el servicio'),
    });
  }

  eliminarServicio(contratoServicioId: string): void {
    if (!confirm('Quitar este servicio del contrato? Se perdera el historial de horas asociado.')) return;
    this.srv.eliminarServicio(this.contratoId, contratoServicioId).subscribe(() => this.cargar());
  }

  editarHoras(s: ConsumoHoras): void {
    this.editandoServicio.set(s);
    this.horasEdit = s.horas_contratadas;
    this.contactosEditArray.clear();
    const contactos = s.contactos?.length ? s.contactos : [undefined];
    contactos.forEach((c) => this.contactosEditArray.push(this.crearContactoGroup(c)));
  }

  cancelarEdicion(): void { this.editandoServicio.set(null); }

  guardarHoras(contratoServicioId: string): void {
    if (this.horasEdit < 0) return;
    const { contactos } = this.contactosEditForm.getRawValue();
    this.srv.actualizarServicio(this.contratoId, contratoServicioId, { horas_contratadas: this.horasEdit, contactos: limpiarContactos(contactos) }).subscribe({
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

  quitarDocumento(index: number): void {
    const actuales = this.contrato()?.documentos ?? [];
    const doc = actuales[index];
    if (!doc || !confirm(`Quitar el documento "${doc.nombre}"?`)) return;
    const documentos = actuales.filter((_, i) => i !== index);
    this.srv.actualizar(this.contratoId, { documentos }).subscribe(() => this.cargar());
  }
}

type ContactoParcial = { nombre?: string | null; correo?: string | null; telefono?: string | null } | null | undefined;

// Descarta las filas de contacto que el usuario dejo completamente vacias.
function limpiarContactos(lista: ContactoParcial[] | null | undefined): Contacto[] {
  return (lista ?? [])
    .map((c) => ({
      nombre: (c?.nombre ?? '').trim(),
      correo: (c?.correo ?? '').trim(),
      telefono: (c?.telefono ?? '').trim(),
    }))
    .filter((c) => c.nombre || c.correo || c.telefono);
}
