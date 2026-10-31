// -----------------------------------------------------------------------------
// Genera el "Reporte de equipos asignados" en PDF (pdfMake): una sola tabla
// (a diferencia del carrito de compras, un equipo no tiene lineas/detalle
// hijas) -- mismo mecanismo de carga diferida que reporte-carrito-pdf.service.ts.
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';
import { EquipoAsignado } from '../models/models';

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

export interface FiltroReporteEquipos {
  estado: string; // '' = todos (ya resuelto a etiqueta legible)
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string; // 'YYYY-MM-DD'
}

const PRIMARY = '#1F4E78';

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function textoMac(e: EquipoAsignado): string {
  if (!e.mac_address && !e.hardware_address) return '-';
  return `${e.mac_address ?? '-'} - ${e.hardware_address ?? '-'}`;
}

@Injectable({ providedIn: 'root' })
export class ReporteEquiposPdfService {

  async generar(
    equipos: EquipoAsignado[],
    filtro: FiltroReporteEquipos,
    textoVidaUtil: (e: EquipoAsignado) => string,
    etiquetaEstado: (e: EquipoAsignado) => string,
    empresa?: { nombre?: string | null; logo?: string | null }
  ) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(equipos, filtro, textoVidaUtil, etiquetaEstado, empresa);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(
    equipos: EquipoAsignado[],
    filtro: FiltroReporteEquipos,
    textoVidaUtil: (e: EquipoAsignado) => string,
    etiquetaEstado: (e: EquipoAsignado) => string,
    empresa?: { nombre?: string | null; logo?: string | null }
  ): TDocumentDefinitions {

    const cuerpo = equipos.map((e) => ([
      { text: e.categoria_nombre, style: 'td' },
      { text: `${e.marca} ${e.modelo}`, style: 'td' },
      { text: etiquetaEstado(e), style: 'td' },
      { text: e.asignada_a || '-', style: 'td' },
      { text: formatearFecha(e.fecha_entrada), style: 'td' },
      { text: textoVidaUtil(e), style: 'td' },
      { text: e.procesador_nombre || '-', style: 'td' },
      { text: e.memoria_ram || '-', style: 'td' },
      { text: e.disco_duro || '-', style: 'td' },
      { text: textoMac(e), style: 'td' },
      { text: e.proveedor_nombre || '-', style: 'td' },
    ]));

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
      pageMargins: [24, 30, 24, 30],
      content: [
        ...encabezadoEmpresa,
        {
          table: { widths: ['*'], body: [[{ text: 'REPORTE DE EQUIPOS ASIGNADOS', style: 'titulo', fillColor: PRIMARY }]] },
          layout: 'noBorders',
        },
        {
          text: `Estado: ${filtro.estado || 'Todos'}          Periodo de entrada: ${formatearFecha(filtro.fechaInicio)} - ${formatearFecha(filtro.fechaFin)}          Total: ${equipos.length} equipo(s)`,
          style: 'subtituloItalic',
          margin: [0, 4, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: [55, 70, 45, 55, 45, 50, 45, 35, 35, 90, '*'],
            body: [
              [
                { text: 'Categoria', style: 'th' },
                { text: 'Marca / Modelo', style: 'th' },
                { text: 'Estado', style: 'th' },
                { text: 'Asignado a', style: 'th' },
                { text: 'Entrada', style: 'th' },
                { text: 'Vida util', style: 'th' },
                { text: 'CPU', style: 'th' },
                { text: 'RAM', style: 'th' },
                { text: 'Disk', style: 'th' },
                { text: 'MAC', style: 'th' },
                { text: 'Proveedor', style: 'th' },
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
      ],
      styles: {
        empresaNombre: { fontSize: 13, bold: true, color: PRIMARY, margin: [0, 8, 0, 0] } as Style,
        titulo: { fontSize: 15, bold: true, color: 'white', alignment: 'center', margin: [0, 8, 0, 8] } as Style,
        subtituloItalic: { fontSize: 8, italics: true, alignment: 'center', color: 'grey' } as Style,
        th: { fontSize: 7.5, bold: true, color: 'white', alignment: 'center', fillColor: PRIMARY, margin: [2, 4, 2, 4] } as Style,
        td: { fontSize: 7.5, alignment: 'left', margin: [2, 3, 2, 3] } as Style,
      },
      defaultStyle: { font: 'Roboto' },
    };
  }
}
