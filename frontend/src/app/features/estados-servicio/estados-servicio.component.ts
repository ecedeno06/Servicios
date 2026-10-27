import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EstadosServiciosProveedoresService } from '../../core/services/estados-servicios-proveedores.service';
import { EstadoServicioProveedorItem } from '../../core/models/models';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmPasswordService } from '../../core/services/confirm-password.service';

const CLASES_BADGE: { valor: string; etiqueta: string }[] = [
  { valor: 'badge-green', etiqueta: 'Verde' },
  { valor: 'badge-amber', etiqueta: 'Ambar' },
  { valor: 'badge-red', etiqueta: 'Rojo' },
  { valor: 'badge-red-solid', etiqueta: 'Rojo solido' },
  { valor: 'badge-slate', etiqueta: 'Gris' },
];

@Component({
  selector: 'app-estados-servicio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './estados-servicio.component.html',
  styleUrl: './estados-servicio.component.css',
})
export class EstadosServicioComponent implements OnInit {
  clasesBadge = CLASES_BADGE;

  estados = signal<EstadoServicioProveedorItem[]>([]);
  estadoSeleccionado = signal<EstadoServicioProveedorItem | null>(null);
  filtroNombre = signal('');
  guardando = signal(false);

  form = this.fb.group({
    nombre: ['', [Validators.required]],
    clase_badge: ['badge-slate', [Validators.required]],
    activo: [true],
  });

  estadosFiltrados = computed(() => {
    const f = this.filtroNombre().trim().toLowerCase();
    if (!f) return this.estados();
    return this.estados().filter((e) => e.nombre.toLowerCase().includes(f));
  });

  constructor(
    private fb: FormBuilder,
    private estadosSrv: EstadosServiciosProveedoresService,
    private toast: ToastService,
    private confirmPasswordSrv: ConfirmPasswordService
  ) {}

  ngOnInit(): void {
    this.cargarEstados();
  }

  cargarEstados(): void {
    this.estadosSrv.listar().subscribe((data) => this.estados.set(data));
  }

  seleccionarEstado(e: EstadoServicioProveedorItem): void {
    const yaSeleccionado = this.estadoSeleccionado()?.id === e.id;
    if (yaSeleccionado) { this.nuevoEstado(); return; }
    this.estadoSeleccionado.set(e);
    this.form.reset({ nombre: e.nombre, clase_badge: e.clase_badge, activo: e.activo });
  }

  nuevoEstado(): void {
    this.estadoSeleccionado.set(null);
    this.form.reset({ nombre: '', clase_badge: 'badge-slate', activo: true });
  }

  guardarEstado(): void {
    if (this.form.invalid || this.guardando()) return;
    const data = this.form.getRawValue() as { nombre: string; clase_badge: string; activo: boolean };
    const actual = this.estadoSeleccionado();
    const req = actual ? this.estadosSrv.actualizar(actual.id, data) : this.estadosSrv.crear(data);
    this.guardando.set(true);
    req.subscribe({
      next: () => { this.guardando.set(false); this.nuevoEstado(); this.cargarEstados(); },
      error: (err) => { this.guardando.set(false); this.toast.error(err?.error?.mensaje || 'No se pudo guardar el estado'); },
    });
  }

  async eliminarEstado(): Promise<void> {
    const actual = this.estadoSeleccionado();
    if (!actual) return;
    const ok = await this.confirmPasswordSrv.confirmar(
      `¿Eliminar el estado "${actual.nombre}"? Esto falla si todavia hay servicios con este estado.`,
      (password) => this.estadosSrv.eliminar(actual.id, password)
    );
    if (!ok) return;

    this.toast.exito(`Estado "${actual.nombre}" eliminado correctamente.`);
    this.nuevoEstado();
    this.cargarEstados();
  }
}
