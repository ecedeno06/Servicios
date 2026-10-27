// -----------------------------------------------------------------------------
// Genera el "Reporte de carrito de compras" en PDF (pdfMake): ordenes de
// solicitud con sus totales, seguidas del detalle de equipos de cada una.
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import type { TDocumentDefinitions, Style } from 'pdfmake/interfaces';
import { ReporteCarritoCabecera, ReporteCarritoDetalleItem } from '../models/models';

// Mismo mecanismo de carga diferida que reporte-servicios-pdf.service.ts.
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

export interface FiltroReporteCarrito {
  estado: string; // '' = todos (ya resuelto a etiqueta legible)
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string; // 'YYYY-MM-DD'
}

// Misma paleta que el resto de reportes/PDFs del sistema.
const PRIMARY = '#1F4E78';
const LIGHT = '#D9E1F2';
const GREY = '#EAEAEA';

function idCorto(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function formatearMoneda(valor: number | string | null | undefined): string {
  return Number(valor ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

@Injectable({ providedIn: 'root' })
export class ReporteCarritoPdfService {

  async generar(
    cabeceras: ReporteCarritoCabecera[],
    detalles: ReporteCarritoDetalleItem[],
    filtro: FiltroReporteCarrito,
    empresa?: { nombre?: string | null; logo?: string | null }
  ) {
    const pdfMake = await cargarPdfMake();
    const docDefinition = this.buildDocDefinition(cabeceras, detalles, filtro, empresa);
    return pdfMake.createPdf(docDefinition);
  }

  private buildDocDefinition(
    cabeceras: ReporteCarritoCabecera[],
    detalles: ReporteCarritoDetalleItem[],
    filtro: FiltroReporteCarrito,
    empresa?: { nombre?: string | null; logo?: string | null }
  ): TDocumentDefinitions {

    const cuerpoCabeceras = cabeceras.map((c) => ([
      { text: idCorto(c.id), style: 'td' },
      { text: c.titulo, style: 'td' },
      { text: formatearFecha(c.fecha_solicitud), style: 'td' },
      { text: c.estado, style: 'td' },
      { text: c.aprobado_por_nombre || '-', style: 'td' },
      { text: formatearMoneda(c.costo_estimado_propuesto_total), style: 'td', alignment: 'right' },
      { text: formatearMoneda(c.costo_estimado_aprobado_total), style: 'tdBold', fillColor: GREY, alignment: 'right' },
    ]));

    const totalPropuesto = cabeceras.reduce((sum, c) => sum + Number(c.costo_estimado_propuesto_total ?? 0), 0);
    const totalAprobado = cabeceras.reduce((sum, c) => sum + Number(c.costo_estimado_aprobado_total ?? 0), 0);

    const cuerpoDetalles = detalles.map((d) => ([
      { text: `${idCorto(d.carrito_id)} · ${d.carrito_titulo}`, style: 'td' },
      { text: d.categoria_nombre || '-', style: 'td' },
      { text: `${d.marca} ${d.modelo}`, style: 'td' },
      { text: d.proveedor_nombre || '-', style: 'td' },
      { text: String(d.cantidad_propuesta), style: 'td', alignment: 'right' },
      { text: d.cantidad_aprobada != null ? String(d.cantidad_aprobada) : '-', style: 'td', alignment: 'right' },
      { text: formatearMoneda(d.costo_estimado), style: 'td', alignment: 'right' },
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
      pageMargins: [30, 30, 30, 30],
      content: [
        ...encabezadoEmpresa,
        {
          table: { widths: ['*'], body: [[{ text: 'REPORTE DE CARRITO DE COMPRAS', style: 'titulo', fillColor: PRIMARY }]] },
          layout: 'noBorders',
        },
        {
          text: `Estado: ${filtro.estado || 'Todos'}          Periodo de solicitud: ${formatearFecha(filtro.fechaInicio)} - ${formatearFecha(filtro.fechaFin)}`,
          style: 'subtituloItalic',
          margin: [0, 4, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: [55, '*', 65, 70, 65, 80, 80],
            body: [
              [
                { text: 'ID', style: 'th' },
                { text: 'Titulo', style: 'th' },
                { text: 'Fecha Solicitud', style: 'th' },
                { text: 'Estado', style: 'th' },
                { text: 'Aprobado por', style: 'th' },
                { text: 'Costo Propuesto', style: 'th' },
                { text: 'Costo Aprobado', style: 'th' },
              ],
              ...cuerpoCabeceras,
              [
                { text: 'Totales', style: 'totalesValor', alignment: 'right', colSpan: 5 }, {}, {}, {}, {},
                { text: formatearMoneda(totalPropuesto), style: 'totalesValor', fillColor: LIGHT, alignment: 'right' },
                { text: formatearMoneda(totalAprobado), style: 'totalesValor', fillColor: LIGHT, alignment: 'right' },
              ],
            ],
          },
          layout: {
            hLineColor: () => '#B7B7B7',
            vLineColor: () => '#B7B7B7',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
          margin: [0, 0, 0, 16],
        },
        {
          table: { widths: ['*'], body: [[{ text: 'DETALLE DE EQUIPOS POR ORDEN', style: 'tituloSeccion', fillColor: PRIMARY }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 8],
        },
        detalles.length
          ? {
              table: {
                headerRows: 1,
                widths: ['*', 75, '*', 75, 55, 55, 70],
                body: [
                  [
                    { text: 'Orden', style: 'th' },
                    { text: 'Categoria', style: 'th' },
                    { text: 'Marca / Modelo', style: 'th' },
                    { text: 'Proveedor', style: 'th' },
                    { text: 'Cant. Propuesta', style: 'th' },
                    { text: 'Cant. Aprobada', style: 'th' },
                    { text: 'Costo Estimado', style: 'th' },
                  ],
                  ...cuerpoDetalles,
                ],
              },
              layout: {
                hLineColor: () => '#B7B7B7',
                vLineColor: () => '#B7B7B7',
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
              },
            }
          : { text: 'Las ordenes seleccionadas no tienen equipos cargados.', style: 'subtituloItalic' },
      ],
      styles: {
        empresaNombre: { fontSize: 13, bold: true, color: PRIMARY, margin: [0, 8, 0, 0] } as Style,
        titulo: { fontSize: 15, bold: true, color: 'white', alignment: 'center', margin: [0, 8, 0, 8] } as Style,
        tituloSeccion: { fontSize: 12, bold: true, color: 'white', alignment: 'center', margin: [0, 5, 0, 5] } as Style,
        subtituloItalic: { fontSize: 8, italics: true, alignment: 'center', color: 'grey' } as Style,
        th: { fontSize: 8, bold: true, color: 'white', alignment: 'center', fillColor: PRIMARY, margin: [2, 4, 2, 4] } as Style,
        td: { fontSize: 8, alignment: 'left', margin: [2, 3, 2, 3] } as Style,
        tdBold: { fontSize: 8.5, bold: true, alignment: 'center', margin: [2, 3, 2, 3] } as Style,
        totalesValor: { fontSize: 11, bold: true, margin: [2, 4, 2, 4] } as Style,
      },
      defaultStyle: { font: 'Roboto' },
    };
  }
}
