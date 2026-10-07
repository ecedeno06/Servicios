import { Component, ElementRef, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Filtro de columna estilo Excel: boton que muestra "Todos" o la cantidad
// de valores elegidos, y al hacer click abre un panel con buscador,
// "(Seleccionar todo)" y una lista de checkboxes -- los cambios solo se
// aplican al dar "Aceptar" (igual que el AutoFilter de Excel), "Cancelar"
// descarta lo marcado sin tocar el filtro activo.
@Component({
  selector: 'app-multi-select-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './multi-select-filter.component.html',
  styleUrl: './multi-select-filter.component.css',
})
export class MultiSelectFilterComponent {
  @Input() valores: string[] = [];
  // Set vacio = sin filtro ("Todos"). El consumidor es quien decide si
  // trata "todos marcados" como equivalente a "sin filtro" (ver aceptar()).
  @Input() seleccionados: Set<string> = new Set();
  @Input() etiquetaTodos = 'Todos';
  // Formatea un valor crudo para mostrarlo (ej. moneda) -- por defecto, tal cual.
  @Input() formatoValor: (v: string) => string = (v) => v;
  @Output() seleccionadosChange = new EventEmitter<Set<string>>();

  abierto = signal(false);
  busqueda = signal('');
  draft = signal<Set<string>>(new Set());
  pos = signal<{ top: number; left: number } | null>(null);

  constructor(private elRef: ElementRef<HTMLElement>) {}

  valoresFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.valores;
    return this.valores.filter((v) => this.formatoValor(v).toLowerCase().includes(q));
  });

  todoMarcado = computed(() => {
    const visibles = this.valoresFiltrados();
    return visibles.length > 0 && visibles.every((v) => this.draft().has(v));
  });

  tieneFiltroActivo(): boolean {
    return this.seleccionados.size > 0 && this.seleccionados.size < this.valores.length;
  }

  etiquetaBoton(): string {
    const n = this.seleccionados.size;
    if (n === 0 || n >= this.valores.length) return this.etiquetaTodos;
    if (n === 1) return this.formatoValor([...this.seleccionados][0]);
    return `${n} seleccionados`;
  }

  abrir(event: MouseEvent): void {
    // El draft arranca con el filtro activo -- o con TODO marcado si no hay
    // filtro (equivalente visual a "Todos" en Excel), para que destildar un
    // valor sea la primera accion natural.
    this.draft.set(this.seleccionados.size > 0 ? new Set(this.seleccionados) : new Set(this.valores));
    this.busqueda.set('');
    const boton = event.currentTarget as HTMLElement;
    const rect = boton.getBoundingClientRect();
    this.pos.set({ top: rect.bottom + 4, left: rect.left });
    this.abierto.set(true);
  }

  toggleValor(v: string): void {
    const set = new Set(this.draft());
    if (set.has(v)) set.delete(v);
    else set.add(v);
    this.draft.set(set);
  }

  toggleTodo(): void {
    const marcarTodos = !this.todoMarcado();
    const set = new Set(this.draft());
    for (const v of this.valoresFiltrados()) {
      if (marcarTodos) set.add(v);
      else set.delete(v);
    }
    this.draft.set(set);
  }

  aceptar(): void {
    const marcados = this.draft();
    // Todo marcado (o nada) equivale a "sin filtro" -- mas simple de leer
    // para quien consume este componente.
    const esTodos = marcados.size === 0 || marcados.size >= this.valores.length;
    this.seleccionadosChange.emit(esTodos ? new Set() : new Set(marcados));
    this.abierto.set(false);
  }

  cancelar(): void {
    this.abierto.set(false);
  }
}
