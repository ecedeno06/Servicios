import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PoliticaPasswordService } from '../../core/services/politicaPassword.service';

@Component({
  selector: 'app-politica-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './politica-password.component.html',
  styleUrl: './politica-password.component.css',
})
export class PoliticaPasswordComponent implements OnInit {
  cargando = signal(false);
  guardando = signal(false);

  form = this.fb.group({
    longitud_minima: [8, [Validators.required, Validators.min(1)]],
    mayuscula_minima: [2, [Validators.required, Validators.min(0)]],
    minuscula_minima: [2, [Validators.required, Validators.min(0)]],
    requiere_numero: [true],
    requiere_caracter_especial: [true],
    caracteres_numericos: ['1234567890', Validators.required],
    caracteres_especiales: ['!@#$%^&*-_+=.,', Validators.required],
    pista_longitud_minima: [4, [Validators.required, Validators.min(1)]],
    pista_similitud_maxima_porcentaje: [70, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  constructor(private fb: FormBuilder, private srv: PoliticaPasswordService) {}

  ngOnInit(): void {
    this.cargando.set(true);
    this.srv.obtener().subscribe({
      next: (p) => {
        this.form.reset({
          longitud_minima: p.longitud_minima,
          mayuscula_minima: p.mayuscula_minima,
          minuscula_minima: p.minuscula_minima,
          requiere_numero: p.requiere_numero,
          requiere_caracter_especial: p.requiere_caracter_especial,
          caracteres_numericos: p.caracteres_numericos,
          caracteres_especiales: p.caracteres_especiales,
          pista_longitud_minima: p.pista_longitud_minima,
          pista_similitud_maxima_porcentaje: p.pista_similitud_maxima_porcentaje,
        });
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  guardar(): void {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.srv.actualizar(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.guardando.set(false);
        alert('Politica de password actualizada correctamente.');
      },
      error: (err) => {
        this.guardando.set(false);
        alert(err?.error?.mensaje || 'No se pudo guardar la politica de password');
      },
    });
  }
}
