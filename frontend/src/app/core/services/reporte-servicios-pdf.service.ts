// -----------------------------------------------------------------------------
// Genera el "Reporte de servicios" en PDF (pdfMake): servicios contratados con
// su proveedor, sector, costo mensual y pagos totales en un rango de fechas.
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';
import { ReporteServicioPagos } from '../models/models';

// Mismo mecanismo de carga diferida que reporte-resumen-horas-pdf.service.ts.
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

export interface FiltroReporteServicios {
  proveedor: string; // '' = todos
  sector: string; // '' = todos
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string; // 'YYYY-MM-DD'
}

// Misma paleta que reporte-resumen-horas-pdf.service.ts / hoja-servicio-pdf.service.ts,
// para que todos los PDFs del sistema se vean consistentes.
const PRIMARY = '#1F4E78';
const LIGHT = '#D9E1F2';
const GREY = '#EAEAEA';

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function formatearMoneda(valor: number | null | undefined): string {
  return Number(valor ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

@Injectable({ providedIn: 'root' })
export class ReporteServiciosPdfService {

  async generar(
    filas: ReporteServicioPagos[],
    filtro: FiltroReporteServicios,
    empresa?: { nombre?: string | null; logo?: string | null }
  ) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(filas, filtro, empresa);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(
    filas: ReporteServicioPagos[],
    filtro: FiltroReporteServicios,
    empresa?: { nombre?: string | null; logo?: string | null }
  ): TDocumentDefinitions {

    const cuerpo = filas.map((f) => ([
      { text: f.servicio, style: 'td' },
      { text: f.proveedor_nombre, style: 'td' },
      { text: f.sector_nombre || '-', style: 'td' },
      { text: f.estado, style: 'td' },
      { text: formatearMoneda(f.costo_mensual), style: 'td', alignment: 'right' },
      { text: formatearMoneda(f.pagos_total_rango), style: 'tdBold', fillColor: GREY, alignment: 'right' },
    ]));

    const totalMensual = filas.reduce((sum, f) => sum + Number(f.costo_mensual ?? 0), 0);
    const totalPagado = filas.reduce((sum, f) => sum + Number(f.pagos_total_rango ?? 0), 0);

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
          table: { widths: ['*'], body: [[{ text: 'REPORTE DE SERVICIOS', style: 'titulo', fillColor: PRIMARY }]] },
          layout: 'noBorders',
        },
        {
          text: `Proveedor: ${filtro.proveedor || 'Todos'}          Sector: ${filtro.sector || 'Todos'}          Periodo de pagos: ${formatearFecha(filtro.fechaInicio)} - ${formatearFecha(filtro.fechaFin)}`,
          style: 'subtituloItalic',
          margin: [0, 4, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', 70, 75, 85],
            body: [
              [
                { text: 'Servicio', style: 'th' },
                { text: 'Proveedor', style: 'th' },
                { text: 'Sector', style: 'th' },
                { text: 'Estado', style: 'th' },
                { text: 'Costo Mensual', style: 'th' },
                { text: 'Pagos en Periodo', style: 'th' },
              ],
              ...cuerpo,
            ],
          },
          layout: {
            hLineColor: () => '#B7B7B7',
            vLineColor: () => '#B7B7B7',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
        },
        {
          columns: [
            { text: '', width: '*' },
            {
              table: {
                widths: ['*', 85],
                body: [
                  [{ text: 'TOTAL COSTO MENSUAL', style: 'label', alignment: 'right' }, { text: formatearMoneda(totalMensual), style: 'tdBold', fillColor: LIGHT, alignment: 'right' }],
                  [{ text: 'TOTAL PAGADO EN PERIODO', style: 'label', alignment: 'right' }, { text: formatearMoneda(totalPagado), style: 'tdBold', fillColor: LIGHT, alignment: 'right' }],
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
