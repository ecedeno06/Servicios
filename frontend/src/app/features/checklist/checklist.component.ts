import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChecklistsService } from '../../core/services/checklists.service';
import { ChecklistItem } from '../../core/models/models';

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
  guardando = signal(false);

  form = this.fb.group({
    descripcion: ['', [Validators.required]],
    observacion: [''],
    activo: [true],
  });

  itemsFiltrados = computed(() => {
    const f = this.filtroDescripcion().trim().toLowerCase();
    if (!f) return this.items();
    return this.items().filter((i) => i.descripcion.toLowerCase().includes(f));
  });

  constructor(
    private fb: FormBuilder,
    private checklistsSrv: ChecklistsService
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
    this.form.reset({ descripcion: i.descripcion, observacion: i.observacion || '', activo: i.activo });
  }

  nuevoItem(): void {
    this.itemSeleccionado.set(null);
    this.form.reset({ descripcion: '', observacion: '', activo: true });
  }

  guardarItem(): void {
    if (this.form.invalid || this.guardando()) return;
    const data = this.form.getRawValue() as { descripcion: string; observacion: string; activo: boolean };
    const actual = this.itemSeleccionado();
    const req = actual ? this.checklistsSrv.actualizar(actual.id, data) : this.checklistsSrv.crear(data);
    this.guardando.set(true);
    req.subscribe({
      next: () => { this.guardando.set(false); this.nuevoItem(); this.cargarItems(); },
      error: (err) => { this.guardando.set(false); alert(err?.error?.mensaje || 'No se pudo guardar el checklist'); },
    });
  }

  eliminarItem(): void {
    const actual = this.itemSeleccionado();
    if (!actual) return;
    if (!confirm(`¿Eliminar "${actual.descripcion}"?`)) return;
    this.checklistsSrv.eliminar(actual.id).subscribe({
      next: () => { this.nuevoItem(); this.cargarItems(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar el checklist'),
    });
  }
}
