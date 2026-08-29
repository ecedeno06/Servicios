import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TiposServicioService } from '../../core/services/tipos-servicio.service';
import { AuthService } from '../../core/services/auth.service';
import { TipoServicio } from '../../core/models/models';

@Component({
  selector: 'app-tipos-servicio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tipos-servicio.component.html',
  styleUrl: './tipos-servicio.component.css',
})
export class TiposServicioComponent implements OnInit {
  tipos = signal<TipoServicio[]>([]);
  panelAbierto = signal(false);
  editando = signal<TipoServicio | null>(null);

  form = this.fb.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    activo: [true],
  });

  constructor(private fb: FormBuilder, private srv: TiposServicioService, public auth: AuthService) {}

  ngOnInit(): void { this.cargar(); }
  cargar(): void { this.srv.listar().subscribe((data) => this.tipos.set(data)); }

  abrirNuevo(): void { this.editando.set(null); this.form.reset({ activo: true }); this.panelAbierto.set(true); }
  abrirEditar(t: TipoServicio): void { this.editando.set(t); this.form.reset({ ...t }); this.panelAbierto.set(true); }
  cerrarPanel(): void { this.panelAbierto.set(false); }

  guardar(): void {
    if (this.form.invalid) return;
    const data = this.form.getRawValue();
    const actual = this.editando();
    const req = actual ? this.srv.actualizar(actual.id, data) : this.srv.crear(data);
    req.subscribe(() => { this.cerrarPanel(); this.cargar(); });
  }

  eliminar(t: TipoServicio): void {
    if (!confirm(`Eliminar el tipo de servicio "${t.nombre}"?`)) return;
    this.srv.eliminar(t.id).subscribe(() => this.cargar());
  }
}
