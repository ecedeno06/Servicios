// -----------------------------------------------------------------------------
// Genera el "Reporte de horas" en PDF (pdfMake): resumen de varios registros
// de horas filtrados por cliente y rango de fechas.
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';
import { RegistroHora } from '../models/models';

// Mismo mecanismo de carga diferida que hoja-servicio-pdf.service.ts.
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
  cliente: string; // '' = todos
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string; // 'YYYY-MM-DD'
}

// Mismos colores que hoja-servicio-pdf.service.ts, para que ambos PDFs se
// vean consistentes. Si se cambia la paleta, ajustar en los dos archivos.
const PRIMARY = '#1F4E78';
const LIGHT = '#D9E1F2';
const GREY = '#EAEAEA';

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

@Injectable({ providedIn: 'root' })
export class ReporteResumenHorasPdfService {

  async generar(
    registros: RegistroHora[],
    filtro: FiltroReporteHoras,
    empresa?: { nombre?: string | null; logo?: string | null }
  ) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(registros, filtro, empresa);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(
    registros: RegistroHora[],
    filtro: FiltroReporteHoras,
    empresa?: { nombre?: string | null; logo?: string | null }
  ): TDocumentDefinitions {

    const filas = registros.map((r) => ([
      { text: formatearFecha(r.fecha), style: 'td' },
      { text: r.cliente_nombre ?? '', style: 'td' },
      { text: r.numero_contrato ?? '', style: 'td' },
      { text: r.tipo_servicio_nombre ?? '', style: 'td' },
      { text: r.usuario_nombre ?? '', style: 'td' },
      { text: `${r.hora_inicio?.substring(0, 5) ?? ''} - ${r.hora_fin?.substring(0, 5) ?? ''}`, style: 'td' },
      { text: Number(r.horas ?? 0).toFixed(2), style: 'tdBold', fillColor: GREY },
    ]));

    const totalHoras = registros
      .reduce((sum, r) => sum + Number(r.horas ?? 0), 0)
      .toFixed(2);

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
                widths: ['*', 70],
                body: [[
                  { text: 'TOTAL HORAS', style: 'label', alignment: 'right' },
                  { text: totalHoras, style: 'tdBold', fillColor: LIGHT },
                ]],
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
