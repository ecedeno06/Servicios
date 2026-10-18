// -----------------------------------------------------------------------------
// Genera el PDF de una ejecucion de Checklist de Equipo (pdfMake).
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';

// pdfmake (con sus fuentes embebidas) pesa varios MB -- se carga con
// "import() dinamico" solo cuando alguien realmente genera un PDF, en vez
// de venir siempre en el bundle inicial de toda la app.
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

// ------------------------- Modelos -------------------------

export interface ChecklistPdfItem {
  descripcion: string;
  completado: boolean;
  fechaCompletado?: string | null; // ya formateada, lista para mostrar
  completadoPor?: string | null;
}

export interface ChecklistPdfData {
  empresaNombre?: string;
  empresaLogo?: string | null; // data URI base64
  equipo: string; // "marca modelo"
  categoria?: string;
  asignadoA?: string;
  fechaEjecucion: string; // ya formateada
  fechaGeneracion: string; // ya formateada
  generadoPor?: string;
  asignadoIniciales?: string; // iniciales de "Asignado a" -- ej. "AM" -- mismo criterio que el avatar del topbar (inicial de Nombre + inicial de Apellido)
  items: ChecklistPdfItem[];
}

// ------------------------- Colores / estilos -------------------------

const PRIMARY = '#1F4E78';
const GREEN = '#1E8E5A';
const GREY_BORDER = '#D8D8D8';
const GREY_TEXT = '#6B6B6B';

@Injectable({ providedIn: 'root' })
export class ChecklistEquipoPdfService {

  async generar(data: ChecklistPdfData) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(data);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(data: ChecklistPdfData): TDocumentDefinitions {
    const total = data.items.length;
    const completados = data.items.filter((i) => i.completado).length;

    // Avatar con las iniciales de quien genera el PDF (mismo estilo que el
    // circulo del topbar) -- se dibuja como celda de tabla rellena en vez
    // de texto SVG, para no depender del soporte de <text> dentro de svg.
    const avatarIniciales = data.asignadoIniciales
      ? {
          table: { widths: [36], heights: [36], body: [[{ text: data.asignadoIniciales, style: 'avatarIniciales', fillColor: PRIMARY }]] },
          layout: 'noBorders',
          width: 36,
        }
      : { text: '', width: 0 };

    const encabezadoEmpresa: any[] = [];
    if (data.empresaLogo || data.empresaNombre || data.asignadoIniciales) {
      encabezadoEmpresa.push({
        columns: [
          data.empresaLogo
            ? { image: data.empresaLogo, fit: [70, 70] }
            : { text: '', width: 50 },
          { text: data.empresaNombre || '', style: 'empresaNombre', alignment: 'left' },
          avatarIniciales,
        ],
        columnGap: 10,
        margin: [0, 0, 0, 16],
      });
    }

    // El check se dibuja como SVG (no como glifo "✓" de texto): la fuente
    // Roboto embebida en pdfmake no trae ese caracter y se veia en blanco.
    const svgCheck = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="${GREEN}"/><path d="M6.5 12.5l4 4 7-8" stroke="white" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const svgPendiente = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="5" fill="none" stroke="${GREY_BORDER}" stroke-width="2"/></svg>`;

    const filasItems: any[] = data.items.map((item) => ([
      {
        svg: item.completado ? svgCheck : svgPendiente,
        width: 16,
        height: 16,
        alignment: 'center',
        margin: [0, 10, 0, 0],
        border: [true, true, true, true],
      },
      {
        stack: [
          { text: item.descripcion, style: item.completado ? 'itemTextDone' : 'itemText' },
          ...(item.completado && item.fechaCompletado
            ? [{
                text: `Completado el ${item.fechaCompletado}` + (item.completadoPor ? ` · ${item.completadoPor}` : ''),
                style: 'itemSub',
              }]
            : []),
        ],
        border: [false, true, true, true],
        margin: [8, 6, 8, 6],
      },
    ]));

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 40, 40, 50],

      content: [
        ...encabezadoEmpresa,

        {
          table: {
            widths: ['*'],
            body: [[{ text: 'CHECKLIST DE EQUIPO', style: 'titulo', fillColor: PRIMARY }]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 14],
        },

        // Datos del equipo / ejecucion
        {
          table: {
            widths: [90, '*', 70, '*'],
            body: [
              [
                { text: 'Equipo:', style: 'label' },
                { text: data.equipo || '', style: 'valor' },
                { text: 'Categoría:', style: 'label' },
                { text: data.categoria || '-', style: 'valor' },
              ],
              [
                { text: 'Asignado a:', style: 'label' },
                { text: data.asignadoA || 'Sin asignar', style: 'valor' },
                { text: 'Fecha:', style: 'label' },
                { text: data.fechaEjecucion || '', style: 'valor' },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 16],
        },

        // Resumen de avance
        {
          columns: [
            { text: `Progreso: ${completados} de ${total} completados`, style: 'resumen' },
            { text: total > 0 ? `${Math.round((completados / total) * 100)}%` : '0%', style: 'resumenPct', alignment: 'right' },
          ],
          margin: [0, 0, 0, 6],
        },

        // Lista de items
        total > 0
          ? {
              table: {
                widths: [26, '*'],
                body: filasItems,
              },
              layout: {
                hLineColor: () => GREY_BORDER,
                vLineColor: () => GREY_BORDER,
                hLineWidth: () => 0.75,
                vLineWidth: () => 0.75,
                paddingLeft: () => 0,
                paddingRight: () => 0,
              },
            }
          : { text: 'No hay items de checklist activos en el catálogo.', style: 'valor', italics: true },
      ],

      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Generado el ${data.fechaGeneracion}` + (data.generadoPor ? ` · ${data.generadoPor}` : ''), style: 'pie', margin: [40, 0, 0, 0] },
          { text: `${currentPage} / ${pageCount}`, style: 'pie', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
      }),

      styles: {
        empresaNombre: { fontSize: 13, bold: true, color: PRIMARY, margin: [0, 8, 0, 0] } as Style,
        avatarIniciales: { fontSize: 13, bold: true, color: 'white', alignment: 'center', margin: [0, 11, 0, 0] } as Style,
        titulo: { fontSize: 15, bold: true, color: 'white', alignment: 'center', margin: [0, 9, 0, 9] } as Style,
        label: { fontSize: 9, bold: true, color: GREY_TEXT, margin: [0, 3, 0, 3] } as Style,
        valor: { fontSize: 9.5, margin: [0, 3, 0, 3] } as Style,
        resumen: { fontSize: 10, bold: true, color: PRIMARY } as Style,
        resumenPct: { fontSize: 10, bold: true, color: GREEN } as Style,
        itemText: { fontSize: 9.5 } as Style,
        itemTextDone: { fontSize: 9.5, decoration: 'lineThrough', color: GREY_TEXT } as Style,
        itemSub: { fontSize: 8, color: GREY_TEXT, margin: [0, 2, 0, 0] } as Style,
        pie: { fontSize: 7.5, color: GREY_TEXT } as Style,
      },

      defaultStyle: { font: 'Roboto' },
    };
  }
}
