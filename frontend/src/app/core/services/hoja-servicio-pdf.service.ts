// -----------------------------------------------------------------------------
// Genera la "Hoja de Servicio" en PDF (pdfMake) a partir de un registro de horas.
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, ContentTable, Style } from 'pdfmake/interfaces';

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
  // vfs_fonts en esta version exporta el mapa de fuentes directo (sin el
  // wrapper ".vfs" que muestran los tutoriales viejos de pdfmake).
  pdfMake.vfs = pdfFonts;
  pdfMakeCache = pdfMake;
  return pdfMake;
}

// ------------------------- Modelos -------------------------

export interface DetalleHora {
  fecha: string;        // 'DD/MM/YYYY'
  horaInicio: string;   // 'HH:mm'
  horaFin: string;      // 'HH:mm'
  descripcion: string;
}

export interface HojaServicio {
  // Empresa que emite el documento (la activa de la sesion)
  empresaNombre?: string;
  empresaLogo?: string | null; // data URI base64
  numeroServicio: string;
  fechaEmision: string;
  cliente: string;
  numeroContrato: string;
  direccion: string;
  ordenTrabajo: string;
  tecnico: string;
  supervisor: string;
  tipoServicio: string;
  prioridad: string;
  detalle: DetalleHora[];
  observaciones: string;
}

// ------------------------- Colores / estilos -------------------------

const PRIMARY = '#1F4E78';
const LIGHT = '#D9E1F2';
const INPUT = '#FFF9E6';
const GREY = '#EAEAEA';

// Calcula horas trabajadas entre dos horas 'HH:mm'
function calcularHoras(horaInicio: string, horaFin: string): string {
  if (!horaInicio || !horaFin) return '';
  const [hi, mi] = horaInicio.split(':').map(Number);
  const [hf, mf] = horaFin.split(':').map(Number);
  const minutos = (hf * 60 + mf) - (hi * 60 + mi);
  if (isNaN(minutos) || minutos < 0) return '';
  return (minutos / 60).toFixed(2);
}

@Injectable({ providedIn: 'root' })
export class HojaServicioPdfService {

  async generar(data: HojaServicio) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(data);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(data: HojaServicio): TDocumentDefinitions {

    const filasDetalle = data.detalle.map(d => ([
      { text: d.fecha, style: 'td', fillColor: INPUT },
      { text: d.horaInicio, style: 'td', fillColor: INPUT },
      { text: d.horaFin, style: 'td', fillColor: INPUT },
      { text: calcularHoras(d.horaInicio, d.horaFin), style: 'td', fillColor: GREY },
      { text: d.descripcion, style: 'tdLeft', fillColor: INPUT },
    ]));

    const totalHoras = data.detalle
      .reduce((sum, d) => sum + (parseFloat(calcularHoras(d.horaInicio, d.horaFin)) || 0), 0)
      .toFixed(2);

    const tablaDetalle: ContentTable = {
      table: {
        headerRows: 1,
        widths: [60, 60, 60, 45, '*'],
        body: [
          [
            { text: 'Fecha', style: 'th' },
            { text: 'Hora inicio', style: 'th' },
            { text: 'Hora fin', style: 'th' },
            { text: 'Horas', style: 'th' },
            { text: 'Descripción de la actividad', style: 'th' },
          ],
          ...filasDetalle,
        ],
      },
      layout: {
        hLineColor: () => '#B7B7B7',
        vLineColor: () => '#B7B7B7',
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
      },
    };

    const encabezadoEmpresa: any[] = [];
    if (data.empresaLogo || data.empresaNombre) {
      encabezadoEmpresa.push({
        columns: [
          data.empresaLogo
            ? { image: data.empresaLogo, fit: [100, 100] }
            : { text: '', width: 50 },
          { text: data.empresaNombre || '', style: 'empresaNombre', alignment: 'left' },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 12],
      });
    }

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 40, 40, 40],

      content: [
        ...encabezadoEmpresa,
        // Encabezado
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'HOJA DE SERVICIO', style: 'titulo', fillColor: PRIMARY }]],
          },
          layout: 'noBorders',
        },
        {
          text: `N.° de servicio: ${data.numeroServicio || '__________'}          Fecha de emisión: ${data.fechaEmision || '__________'}`,
          style: 'subtituloItalic',
          margin: [0, 4, 0, 10],
        },

        // Datos generales
        {
          table: {
            widths: [110, 150, 100, '*'],
            body: [
              [
                { text: 'Cliente:', style: 'label' },
                { text: data.cliente || '', style: 'valor', fillColor: INPUT },
                { text: 'N.° de contrato:', style: 'label' },
                { text: data.numeroContrato || '', style: 'valor', fillColor: INPUT },
              ],
              [
                { text: 'Dirección / Sitio:', style: 'label' },
                { text: data.direccion || '', style: 'valor', fillColor: INPUT },
                { text: 'Orden de trabajo:', style: 'label' },
                { text: data.ordenTrabajo || '', style: 'valor', fillColor: INPUT },
              ],
              [
                { text: 'Técnico / Responsable:', style: 'label' },
                { text: data.tecnico || '', style: 'valor', fillColor: INPUT },
                { text: 'Supervisor:', style: 'label' },
                { text: data.supervisor || '', style: 'valor', fillColor: INPUT },
              ],
              [
                { text: 'Tipo de servicio:', style: 'label' },
                { text: data.tipoServicio || '', style: 'valor', fillColor: INPUT },
                { text: 'Prioridad:', style: 'label' },
                { text: data.prioridad || '', style: 'valor', fillColor: INPUT },
              ],
            ],
          },
          layout: {
            hLineColor: () => '#B7B7B7',
            vLineColor: () => '#B7B7B7',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
          margin: [0, 0, 0, 10],
        },

        // Subtítulo detalle de horas
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'DETALLE DE HORAS TRABAJADAS', style: 'subtituloTabla', fillColor: PRIMARY }]],
          },
          layout: 'noBorders',
        },
        tablaDetalle,

        // Total
        {
          table: {
            widths: ['*', 100],
            body: [[
              { text: 'TOTAL DE HORAS', style: 'label', alignment: 'right' },
              { text: totalHoras, style: 'tdBold', fillColor: LIGHT },
            ]],
          },
          layout: {
            hLineColor: () => '#B7B7B7',
            vLineColor: () => '#B7B7B7',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
          margin: [0, 0, 0, 10],
        },

        // Observaciones
        { text: 'Observaciones:', style: 'label', margin: [0, 0, 0, 3] },
        {
          table: { widths: ['*'], body: [[{ text: (data.observaciones || ' ') + '\n\n\n', style: 'valor', fillColor: INPUT }]] },
          layout: { hLineColor: () => '#B7B7B7', vLineColor: () => '#B7B7B7', hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
          margin: [0, 0, 0, 20],
        },

        // Firmas
        {
          columns: [
            { text: '_______________________\nFirma del técnico', alignment: 'center', style: 'firma' },
            { text: '_______________________\nFirma / sello del cliente', alignment: 'center', style: 'firma' },
          ],
        },
      ],

      styles: {
        empresaNombre: { fontSize: 13, bold: true, color: PRIMARY, margin: [0, 12, 0, 0] } as Style,
        titulo: { fontSize: 16, bold: true, color: 'white', alignment: 'center', margin: [0, 10, 0, 10] } as Style,
        subtituloItalic: { fontSize: 8, italics: true, alignment: 'center', color: 'grey' } as Style,
        subtituloTabla: { fontSize: 9, bold: true, color: 'white', alignment: 'center', margin: [0, 5, 0, 5] } as Style,
        label: { fontSize: 9, bold: true, margin: [4, 4, 4, 4] } as Style,
        valor: { fontSize: 9, margin: [4, 4, 4, 4] } as Style,
        th: { fontSize: 8.5, bold: true, color: 'white', alignment: 'center', fillColor: PRIMARY, margin: [2, 4, 2, 4] } as Style,
        td: { fontSize: 8.5, alignment: 'center', margin: [2, 3, 2, 3] } as Style,
        tdLeft: { fontSize: 8.5, alignment: 'left', margin: [2, 3, 2, 3] } as Style,
        tdBold: { fontSize: 9, bold: true, alignment: 'center', margin: [2, 4, 2, 4] } as Style,
        firma: { fontSize: 9, margin: [0, 30, 0, 0] } as Style,
      },

      defaultStyle: { font: 'Roboto' },
    };
  }
}
