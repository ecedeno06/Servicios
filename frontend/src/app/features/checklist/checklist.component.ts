import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChecklistsService } from '../../core/services/checklists.service';
import { ChecklistItem } from '../../core/models/models';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmPasswordService } from '../../core/services/confirm-password.service';

@Component({
  selector: 'app-checklist',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './checklist.component.html',
  styleUrl: './checklist.component.css',
})
export class ChecklistComponent implements OnInit {
  items = signal<ChecklistItem[]>([]);
  itemSeleccionado = signal<ChecklistItem | null>(null);
  filtroDescripcion = signal('');
  filtroResponsable = signal('');
  guardando = signal(false);

  form = this.fb.group({
    descripcion: ['', [Validators.required]],
    url: ['', Validators.pattern(/^https?:\/\/.+/)],
    observacion: [''],
    responsable: [''],
    activo: [true],
  });

  itemsFiltrados = computed(() => {
    const fDesc = this.filtroDescripcion().trim().toLowerCase();
    const fResp = this.filtroResponsable().trim().toLowerCase();
    return this.items().filter((i) => {
      if (fDesc && !i.descripcion.toLowerCase().includes(fDesc)) return false;
      if (fResp && !(i.responsable || '').toLowerCase().includes(fResp)) return false;
      return true;
    });
  });

  constructor(
    private fb: FormBuilder,
    private checklistsSrv: ChecklistsService,
    private toast: ToastService,
    private confirmPasswordSrv: ConfirmPasswordService
  ) {}

  ngOnInit(): void {
    this.cargarItems();
  }

  cargarItems(): void {
    this.checklistsSrv.listar().subscribe((data) => this.items.set(data));
  }

  seleccionarItem(i: ChecklistItem): void {
    const yaSeleccionado = this.itemSeleccionado()?.id === i.id;
    if (yaSeleccionado) { this.nuevoItem(); return; }
    this.itemSeleccionado.set(i);
    this.form.reset({ descripcion: i.descripcion, url: i.url || '', observacion: i.observacion || '', responsable: i.responsable || '', activo: i.activo });
  }

  nuevoItem(): void {
    this.itemSeleccionado.set(null);
    this.form.reset({ descripcion: '', url: '', observacion: '', responsable: '', activo: true });
  }

  guardarItem(): void {
    if (this.form.invalid || this.guardando()) return;
    const data = this.form.getRawValue() as { descripcion: string; url: string; observacion: string; responsable: string; activo: boolean };
    const actual = this.itemSeleccionado();
    const req = actual ? this.checklistsSrv.actualizar(actual.id, data) : this.checklistsSrv.crear(data);
    this.guardando.set(true);
    req.subscribe({
      next: () => { this.guardando.set(false); this.nuevoItem(); this.cargarItems(); },
      error: (err) => { this.guardando.set(false); this.toast.error(err?.error?.mensaje || 'No se pudo guardar el checklist'); },
    });
  }

  async eliminarItem(): Promise<void> {
    const actual = this.itemSeleccionado();
    if (!actual) return;
    const ok = await this.confirmPasswordSrv.confirmar(
      `¿Eliminar "${actual.descripcion}"?`,
      (password) => this.checklistsSrv.eliminar(actual.id, password)
    );
    if (!ok) return;

    this.toast.exito(`Item "${actual.descripcion}" eliminado correctamente.`);
    this.nuevoItem();
    this.cargarItems();
  }
}
