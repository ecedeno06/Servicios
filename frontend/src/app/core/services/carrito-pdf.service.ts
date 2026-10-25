// -----------------------------------------------------------------------------
// Genera el PDF de una Solicitud de Compra (Carrito) -- pdfMake. Mismo
// mecanismo de carga diferida y misma paleta que el resto de los PDF del
// sistema (ver checklist-equipo-pdf.service.ts / reporte-servicios-pdf.service.ts).
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';

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

export interface CarritoPdfLinea {
  equipo: string; // "marca modelo"
  url?: string | null; // link del producto -- si viene, "equipo" se muestra como link
  categoria?: string | null;
  proveedor?: string | null;
  cantidadPropuesta: number;
  cantidadAprobada?: number | null;
  costoEstimado?: number | null;
  totalLinea: number; // cantidadAprobada * costoEstimado
  observacion?: string | null;
}

export interface CarritoPdfMovimiento {
  estadoAnterior?: string | null; // etiqueta ya traducida (ej. "En Construccion"), null = creacion
  estadoNuevo: string;
  registradoPor?: string;
  fecha: string; // ya formateada
}

export interface CarritoPdfData {
  empresaNombre?: string | null;
  empresaLogo?: string | null; // data URI base64
  idCorto: string;
  titulo: string;
  estado: string; // etiqueta ya traducida
  estadoColor: string; // hex, segun el estado
  fechaSolicitud: string; // ya formateada
  fechaAprobacion?: string | null; // ya formateada
  observacion?: string | null;
  creadoPor?: string;
  actorUltimoEstado?: string | null; // quien registro el ultimo cambio de estado
  fechaUltimoEstado?: string | null; // ya formateada
  lineas: CarritoPdfLinea[];
  totalPropuesto: number;
  totalAprobado: number;
  movimientos: CarritoPdfMovimiento[]; // orden cronologico (mas antiguo primero)
  fechaGeneracion: string; // ya formateada
  generadoPor?: string;
}

// ------------------------- Colores / estilos -------------------------
// Misma paleta que el resto de los PDF del sistema, para que todos se vean
// consistentes.
const PRIMARY = '#1F4E78';
const LIGHT = '#D9E1F2';
const GREY = '#EAEAEA';
const GREY_TEXT = '#6B6B6B';

function formatearMoneda(valor: number | null | undefined): string {
  return Number(valor ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

@Injectable({ providedIn: 'root' })
export class CarritoPdfService {

  async generar(data: CarritoPdfData) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(data);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(data: CarritoPdfData): TDocumentDefinitions {
    const encabezadoEmpresa: any[] = [];
    if (data.empresaLogo || data.empresaNombre) {
      encabezadoEmpresa.push({
        columns: [
          data.empresaLogo ? { image: data.empresaLogo, fit: [60, 60] } : { text: '', width: 50 },
          { text: data.empresaNombre || '', style: 'empresaNombre' },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 12],
      });
    }

    const filasLineas = data.lineas.map((l) => ([
      l.url
        ? { text: l.equipo, style: 'td', link: l.url, color: PRIMARY, decoration: 'underline' }
        : { text: l.equipo, style: 'td' },
      { text: l.categoria || '-', style: 'td' },
      { text: l.proveedor || '-', style: 'td' },
      { text: String(l.cantidadPropuesta), style: 'td', alignment: 'center' },
      { text: l.cantidadAprobada != null ? String(l.cantidadAprobada) : '-', style: 'td', alignment: 'center' },
      { text: l.costoEstimado != null ? formatearMoneda(l.costoEstimado) : '-', style: 'td', alignment: 'right' },
      { text: formatearMoneda(l.totalLinea), style: 'tdBold', fillColor: GREY, alignment: 'right' },
    ]));

    const filasMovimientos = data.movimientos.map((m) => ([
      { text: m.estadoAnterior ? `${m.estadoAnterior} -> ${m.estadoNuevo}` : `Creado como ${m.estadoNuevo}`, style: 'td' },
      { text: m.registradoPor || '-', style: 'td' },
      { text: m.fecha, style: 'td' },
    ]));

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 40],
      content: [
        ...encabezadoEmpresa,
        {
          table: {
            widths: ['*'],
            body: [[{ text: `SOLICITUD DE COMPRA · ID ${data.idCorto}`, style: 'titulo', fillColor: PRIMARY }]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 12],
        },

        // Encabezado de la solicitud
        {
          table: {
            widths: [85, '*', 85, '*', 85, '*'],
            body: [
              [
                { text: 'Titulo:', style: 'label' },
                { text: data.titulo, style: 'valor', colSpan: 3 }, {}, {},
                { text: 'Estado:', style: 'label' },
                { text: data.estado, style: 'valorEstado', color: data.estadoColor },
              ],
              [
                { text: 'Fecha Solicitud:', style: 'label' },
                { text: data.fechaSolicitud || '-', style: 'valor' },
                { text: 'Fecha Aprobacion:', style: 'label' },
                { text: data.fechaAprobacion || '-', style: 'valor' },
                { text: 'Creado por:', style: 'label' },
                { text: data.creadoPor || '-', style: 'valor' },
              ],
              [
                { text: 'Ultimo cambio por:', style: 'label' },
                { text: data.actorUltimoEstado || '-', style: 'valor' },
                { text: 'Fecha del cambio:', style: 'label' },
                { text: data.fechaUltimoEstado || '-', style: 'valor' },
                { text: '', style: 'label' },
                { text: '', style: 'valor' },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, data.observacion ? 6 : 14],
        },

        ...(data.observacion
          ? [{ text: 'Observacion:', style: 'label', margin: [0, 0, 0, 2] as [number, number, number, number] },
             { text: data.observacion, style: 'valor', margin: [0, 0, 0, 14] as [number, number, number, number] }]
          : []),

        // Detalle de equipos
        { text: 'EQUIPOS DE LA SOLICITUD', style: 'subtitulo', margin: [0, 0, 0, 6] },
        data.lineas.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: ['*', 90, 90, 55, 55, 65, 70],
                body: [
                  [
                    { text: 'Equipo', style: 'th' },
                    { text: 'Categoria', style: 'th' },
                    { text: 'Proveedor', style: 'th' },
                    { text: 'Cant. Propuesta', style: 'th' },
                    { text: 'Cant. Aprobada', style: 'th' },
                    { text: 'Costo Unit.', style: 'th' },
                    { text: 'Total', style: 'th' },
                  ],
                  ...filasLineas,
                ],
              },
              layout: {
                hLineColor: () => '#B7B7B7',
                vLineColor: () => '#B7B7B7',
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
              },
            }
          : { text: 'No se agregaron equipos a esta solicitud.', style: 'valor', italics: true },

        // Totales
        {
          columns: [
            { text: '', width: '*' },
            {
              table: {
                widths: ['*', 85],
                body: [
                  [{ text: 'TOTAL COSTO ESTIMADO PROPUESTO', style: 'label', alignment: 'right' }, { text: formatearMoneda(data.totalPropuesto), style: 'tdBold', fillColor: LIGHT, alignment: 'right' }],
                  [{ text: 'TOTAL COSTO ESTIMADO APROBADO', style: 'label', alignment: 'right' }, { text: formatearMoneda(data.totalAprobado), style: 'tdBold', fillColor: LIGHT, alignment: 'right' }],
                ],
              },
              layout: {
                hLineColor: () => '#B7B7B7',
                vLineColor: () => '#B7B7B7',
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
              },
            },
          ],
          margin: [0, 8, 0, 18],
        },

        // Historico de movimientos
        { text: 'HISTORICO DE MOVIMIENTOS', style: 'subtitulo', margin: [0, 0, 0, 6] },
        data.movimientos.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: ['*', 130, 110],
                body: [
                  [
                    { text: 'Movimiento', style: 'th' },
                    { text: 'Registrado por', style: 'th' },
                    { text: 'Fecha', style: 'th' },
                  ],
                  ...filasMovimientos,
                ],
              },
              layout: {
                hLineColor: () => '#B7B7B7',
                vLineColor: () => '#B7B7B7',
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
              },
            }
          : { text: 'Sin movimientos registrados.', style: 'valor', italics: true },
      ],

      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Generado el ${data.fechaGeneracion}` + (data.generadoPor ? ` · ${data.generadoPor}` : ''), style: 'pie', margin: [30, 0, 0, 0] },
          { text: `${currentPage} / ${pageCount}`, style: 'pie', alignment: 'right', margin: [0, 0, 30, 0] },
        ],
      }),

      styles: {
        empresaNombre: { fontSize: 13, bold: true, color: PRIMARY, margin: [0, 8, 0, 0] } as Style,
        titulo: { fontSize: 15, bold: true, color: 'white', alignment: 'center', margin: [0, 8, 0, 8] } as Style,
        subtitulo: { fontSize: 10, bold: true, color: PRIMARY } as Style,
        label: { fontSize: 8.5, bold: true, color: GREY_TEXT, margin: [0, 3, 0, 3] } as Style,
        valor: { fontSize: 9, margin: [0, 3, 0, 3] } as Style,
        valorEstado: { fontSize: 9.5, bold: true, margin: [0, 3, 0, 3] } as Style,
        th: { fontSize: 8, bold: true, color: 'white', alignment: 'center', fillColor: PRIMARY, margin: [2, 4, 2, 4] } as Style,
        td: { fontSize: 8, alignment: 'left', margin: [2, 3, 2, 3] } as Style,
        tdBold: { fontSize: 8.5, bold: true, alignment: 'center', margin: [2, 3, 2, 3] } as Style,
        pie: { fontSize: 7.5, color: GREY_TEXT } as Style,
      },

      defaultStyle: { font: 'Roboto' },
    };
  }
}
