# Plan: Reporte de horas (PDF resumen por cliente y rango de fechas)

Fecha: 2026-08-30
Basado en el ejemplo `reporte-horas.component.ts` que pasaste, adaptado a
los modelos y servicios reales de este proyecto.

## 1. Qué se va a construir

Una pantalla nueva ("Reporte de horas") con un filtro (cliente + rango de
fechas) que genera un PDF resumen de todas las horas registradas que
cumplen el filtro — distinto de la "Hoja de Servicio" que ya existe (esa
es por un solo registro; esta es un listado/resumen de varios).

## 2. Diferencias entre el ejemplo pegado y este proyecto

El ejemplo que pasaste asume datos que no existen tal cual acá. Hay que
adaptar:

| En el ejemplo | En este proyecto |
|---|---|
| `clientes: string[]` hardcodeado en el componente | `ClientesService.listar()` (ya existe) |
| `registros: RegistroHora[]` hardcodeado, con `cliente`, `tecnico`, `estado` | `RegistroHorasService.listar({ desde, hasta })` (ya existe, soporta rango de fechas server-side) |
| Campo `cliente` (nombre plano) | `cliente_nombre` (viene del join con `contratos`/`clientes`) |
| Campo `tecnico` | `usuario_nombre` |
| Campo `estado` ('Facturado' / 'Finalizado') | **No existe** en `registro_horas`. El "estado" en este sistema vive en `contratos.estado`, no por registro individual. Opciones: (a) omitir la columna, (b) traerla vía el `numero_contrato` haciendo un `estado_contrato` adicional en el backend. Recomendado: **omitir** para la v1, se puede agregar despues si hace falta. |
| `ReporteResumenHorasPdfService` | **No fue provisto** — hay que crearlo (ver seccion 4), siguiendo el mismo patron que `hoja-servicio-pdf.service.ts` (carga diferida de pdfmake, mismo esquema de colores). |
| Filtro de cliente aplicado en memoria sobre datos mock | El backend YA soporta `desde`/`hasta` como query params en `GET /api/horas`, pero **no** un filtro directo por cliente (solo por `contrato_id`). Mas simple: filtrar por cliente en el frontend despues de traer el rango de fechas (mismo patron que ya usan otras pantallas de esta app). |

## 3. Backend: sin cambios obligatorios

`registroHoras.controller.js` -> `listar()` ya acepta `desde`/`hasta` (y
`contrato_id`, `tipo_servicio_id`, `usuario_id`). Para este reporte alcanza
con:

```ts
this.horasSrv.listar({ desde: fechaInicio, hasta: fechaFin }).subscribe(...)
```

y despues filtrar por `cliente_nombre` en el frontend si el usuario eligio
un cliente puntual. Esto ya queda scopeado a la empresa activa (como todo
en este backend), no hace falta nada especial ahi.

**Mejora opcional (no necesaria para la v1):** agregar un query param
`cliente_id` en `registroHoras.controller.js` -> `listar()` (join contra
`contratos.cliente_id`) para filtrar en la base de datos en vez de traer
todo el rango y filtrar en memoria. Solo vale la pena si los rangos de
fechas devuelven muchisimos registros.

## 4. Nuevo servicio: `core/services/reporte-resumen-horas-pdf.service.ts`

Mismo patron que `hoja-servicio-pdf.service.ts` (carga diferida de
`pdfmake`, mismos colores institucionales) pero con un `content` distinto:
una tabla con **una fila por registro de horas** en vez de una sola fila
de detalle.

```ts
import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';
import { RegistroHora } from '../models/models';

// Mismo mecanismo de carga diferida que hoja-servicio-pdf.service.ts.
// Considerar mover esta funcion a un archivo compartido (ej.
// core/services/pdf-loader.ts) para no duplicarla entre los dos servicios.
let pdfMakeCache: any = null;
async function cargarPdfMake(): Promise<any> {
  if (pdfMakeCache) return pdfMakeCache;
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule;
  const pdfFonts = (pdfFontsModule as any).default ?? pdfFontsModule;
  pdfMake.vfs = pdfFonts;
  pdfMakeCache = pdfMake;
  return pdfMake;
}

export interface FiltroReporteHoras {
  cliente: string;       // '' = todos
  fechaInicio: string;   // 'YYYY-MM-DD' (del <input type="date">)
  fechaFin: string;      // 'YYYY-MM-DD'
}

// Mismos colores que hoja-servicio-pdf.service.ts, para que ambos PDFs
// se vean consistentes. Si se quiere cambiar la paleta, hacerlo en los
// dos archivos a la vez (o mejor: sacarla a un archivo compartido,
// ej. core/services/pdf-colores.ts, y que ambos servicios lo importen).
const PRIMARY = '#1F4E78';
const LIGHT = '#D9E1F2';
const GREY = '#EAEAEA';

function formatearFecha(iso: string): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

@Injectable({ providedIn: 'root' })
export class ReporteResumenHorasPdfService {

  async generar(
    registros: RegistroHora[],
    filtro: FiltroReporteHoras,
    empresa?: { nombre?: string; logo?: string | null }
  ) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(registros, filtro, empresa);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(
    registros: RegistroHora[],
    filtro: FiltroReporteHoras,
    empresa?: { nombre?: string; logo?: string | null }
  ): TDocumentDefinitions {

    const filas = registros.map((r) => ([
      { text: formatearFecha(r.fecha), style: 'td' },
      { text: r.cliente_nombre ?? '', style: 'td' },
      { text: r.numero_contrato ?? '', style: 'td' },
      { text: r.tipo_servicio_nombre ?? '', style: 'td' },
      { text: r.usuario_nombre ?? '', style: 'td' },
      { text: `${r.hora_inicio?.substring(0, 5) ?? ''} - ${r.hora_fin?.substring(0, 5) ?? ''}`, style: 'td' },
      { text: (r.horas ?? 0).toFixed(2), style: 'tdBold', fillColor: GREY },
    ]));

    const totalHoras = registros.reduce((sum, r) => sum + Number(r.horas ?? 0), 0).toFixed(2);

    const encabezadoEmpresa: any[] = [];
    if (empresa?.logo || empresa?.nombre) {
      encabezadoEmpresa.push({
        columns: [
          empresa.logo ? { image: empresa.logo, fit: [60, 60] } : { text: '', width: 50 },
          { text: empresa.nombre || '', style: 'empresaNombre' },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 12],
      });
    }

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 30],
      content: [
        ...encabezadoEmpresa,
        {
          table: { widths: ['*'], body: [[{ text: 'REPORTE DE HORAS', style: 'titulo', fillColor: PRIMARY }]] },
          layout: 'noBorders',
        },
        {
          text: `Cliente: ${filtro.cliente || 'Todos'}          Periodo: ${formatearFecha(filtro.fechaInicio)} - ${formatearFecha(filtro.fechaFin)}`,
          style: 'subtituloItalic',
          margin: [0, 4, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: [55, '*', 70, '*', '*', 70, 45],
            body: [
              [
                { text: 'Fecha', style: 'th' },
                { text: 'Cliente', style: 'th' },
                { text: 'Contrato', style: 'th' },
                { text: 'Servicio', style: 'th' },
                { text: 'Tecnico', style: 'th' },
                { text: 'Horario', style: 'th' },
                { text: 'Horas', style: 'th' },
              ],
              ...filas,
            ],
          },
          layout: {
            hLineColor: () => '#B7B7B7', vLineColor: () => '#B7B7B7',
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          },
        },
        {
          columns: [
            { text: '', width: '*' },
            {
              table: { widths: ['*', 70], body: [[
                { text: 'TOTAL HORAS', style: 'label', alignment: 'right' },
                { text: totalHoras, style: 'tdBold', fillColor: LIGHT },
              ]] },
              layout: { hLineColor: () => '#B7B7B7', vLineColor: () => '#B7B7B7', hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
            },
          ],
          margin: [0, 10, 0, 0],
        },
      ],
      styles: {
        empresaNombre: { fontSize: 13, bold: true, color: PRIMARY, margin: [0, 8, 0, 0] } as Style,
        titulo: { fontSize: 15, bold: true, color: 'white', alignment: 'center', margin: [0, 8, 0, 8] } as Style,
        subtituloItalic: { fontSize: 8, italics: true, alignment: 'center', color: 'grey' } as Style,
        label: { fontSize: 9, bold: true, margin: [4, 4, 4, 4] } as Style,
        th: { fontSize: 8, bold: true, color: 'white', alignment: 'center', fillColor: PRIMARY, margin: [2, 4, 2, 4] } as Style,
        td: { fontSize: 8, alignment: 'left', margin: [2, 3, 2, 3] } as Style,
        tdBold: { fontSize: 8.5, bold: true, alignment: 'center', margin: [2, 3, 2, 3] } as Style,
      },
      defaultStyle: { font: 'Roboto' },
    };
  }
}
```

Nota: uso `pageOrientation: 'landscape'` porque son mas columnas que en la
Hoja de Servicio (necesita mas ancho horizontal) — se puede volver a
`portrait` si se prefiere.

## 5. Nuevo componente: `features/reportes/reporte-horas.component.ts`

Adaptado del ejemplo, pero usando servicios reales en vez de arrays
hardcodeados:

```ts
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
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.clientesSrv.listar().subscribe((data) => this.clientes.set(data));
  }

  generarReporte(): void {
    if (this.filtroForm.invalid) return;
    const ventana = window.open('', '_blank') ?? undefined; // igual que en registro-horas: abrir YA, sincronico
    const { cliente, fechaInicio, fechaFin } = this.filtroForm.getRawValue();

    this.generando.set(true);
    this.horasSrv.listar({ desde: fechaInicio!, hasta: fechaFin! }).subscribe({
      next: (registros: RegistroHora[]) => {
        const filtrados = cliente
          ? registros.filter((r) => r.cliente_nombre === cliente)
          : registros;

        const empresa = this.auth.empresaActiva();
        this.pdfSrv
          .generar(filtrados, { cliente: cliente ?? '', fechaInicio: fechaInicio!, fechaFin: fechaFin! }, {
            nombre: empresa?.empresa_nombre ?? '',
            logo: empresa?.empresa_logo ?? null,
          })
          .then((doc) => doc.open(undefined, ventana))
          .catch(() => alert('No se pudo generar el reporte.'))
          .finally(() => this.generando.set(false));
      },
      error: () => {
        this.generando.set(false);
        alert('No se pudieron cargar los registros de horas.');
      },
    });
  }
}

function hoyISO(): string { return new Date().toISOString().substring(0, 10); }
function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
```

```html
<!-- reporte-horas.component.html -->
<div class="page-header">
  <div>
    <h1>Reporte de horas</h1>
    <div class="desc">Genera un PDF resumen de horas ejecutadas por cliente y rango de fechas</div>
  </div>
</div>

<div class="card">
  <form [formGroup]="filtroForm" (ngSubmit)="generarReporte()">
    <div class="form-group">
      <label>Cliente</label>
      <select class="input" formControlName="cliente">
        <option value="">Todos los clientes</option>
        @for (c of clientes(); track c.id) { <option [value]="c.nombre">{{ c.nombre }}</option> }
      </select>
    </div>
    <div class="form-group mt-16">
      <label>Desde *</label>
      <input class="input" type="date" formControlName="fechaInicio" />
    </div>
    <div class="form-group mt-16">
      <label>Hasta *</label>
      <input class="input" type="date" formControlName="fechaFin" />
    </div>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary" [disabled]="filtroForm.invalid || generando()">
        {{ generando() ? 'Generando...' : 'Generar PDF' }}
      </button>
    </div>
  </form>
</div>
```

(Sigue el patrón visual de esta plantilla — `page-header` + `card` +
`form-group`/`form-actions` — ver `PLANTILLA-UI.md` en la raíz del
proyecto si hace falta repasar las clases disponibles.)

## 6. Ruta y menú

En `app.routes.ts`, dentro de los children del layout:

```ts
{ path: 'reportes', component: ReporteHorasComponent },
```

En `layout.component.html`, agregar el link en `.sidebar-nav` justo
despues de "Registro de horas" (sin restriccion de rol: quien ya puede
ver el registro de horas, puede generar este reporte de solo lectura):

```html
<a routerLink="/dashboard" routerLinkActive="active">Resumen</a>
<a routerLink="/contratos" routerLinkActive="active">Contratos</a>
<a routerLink="/horas" routerLinkActive="active">Registro de horas</a>
<a routerLink="/reportes" routerLinkActive="active">Reportes</a>
<a routerLink="/clientes" routerLinkActive="active">Clientes</a>
```

## 7. Checklist de implementación

1. Crear `core/services/reporte-resumen-horas-pdf.service.ts` (seccion 4).
2. Crear `features/reportes/reporte-horas.component.ts` + `.html` + `.css` (seccion 5).
3. Agregar la ruta `/reportes` en `app.routes.ts`.
4. Agregar el link en el sidebar (`layout.component.html`).
5. Probar: elegir un cliente + rango de fechas con datos reales, confirmar
   que el PDF se abre con la tabla correcta y el total suma bien.
6. Probar sin elegir cliente ("Todos") para confirmar que trae todos los
   registros del rango, de cualquier cliente de la empresa activa.
7. (Opcional) si el rango de fechas devuelve demasiados registros y se
   siente lento, agregar el filtro `cliente_id` en el backend (seccion 3)
   en vez de filtrar en memoria.

## 8. Nota sobre los colores del PDF

Vi que en `hoja-servicio-pdf.service.ts` dejaste comentada una paleta gris
alternativa (`PRIMARY/LIGHT = '#A9A9A9'`). Si la intención es cambiar el
color institucional del PDF, conviene:

- Decidir la paleta una sola vez y aplicarla en **ambos** servicios de PDF
  (`hoja-servicio-pdf.service.ts` y este nuevo `reporte-resumen-horas-pdf.service.ts`),
  para que los dos documentos se vean consistentes.
- Considerar sacar `PRIMARY`/`LIGHT`/`INPUT`/`GREY` a un archivo compartido
  (ej. `core/services/pdf-colores.ts`) e importarlo desde los dos, en vez
  de mantener las mismas constantes duplicadas en cada servicio.
