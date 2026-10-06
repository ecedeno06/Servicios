// -----------------------------------------------------------------------------
// Genera el "Reporte de servicios" en Excel (.xlsx) via exceljs, cargado de
// forma diferida (igual que pdfmake en reporte-servicios-pdf.service.ts) para
// no engordar el bundle principal.
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import { ReporteServicioPagos } from '../models/models';
import { FiltroReporteServicios } from './reporte-servicios-pdf.service';

let exceljsCache: any = null;
async function cargarExcelJs(): Promise<any> {
  if (exceljsCache) return exceljsCache;
  const mod = await import('exceljs');
  exceljsCache = (mod as any).default ?? mod;
  return exceljsCache;
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const TOTAL_COLUMNAS = 6; // Servicio, Proveedor, Sector, Estado, Costo Mensual, Pagos en Periodo

@Injectable({ providedIn: 'root' })
export class ReporteServiciosExcelService {

  async descargar(
    filas: ReporteServicioPagos[],
    filtro: FiltroReporteServicios,
    empresa?: { nombre?: string | null }
  ): Promise<void> {
    const ExcelJS = await cargarExcelJs();
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Reporte de servicios');

    // Columnas solo por ancho/clave -- sin "header" para no disparar la fila
    // de encabezados automatica de exceljs en la fila 1 (esta va mas abajo,
    // despues del bloque de titulo/empresa/periodo).
    hoja.columns = [
      { key: 'servicio', width: 32 },
      { key: 'proveedor', width: 26 },
      { key: 'sector', width: 20 },
      { key: 'estado', width: 14 },
      { key: 'costoMensual', width: 20 },
      { key: 'pagosPeriodo', width: 22 },
    ];

    // --- Bloque de titulo / empresa / periodo ---
    const filaTitulo = hoja.addRow(['REPORTE DE SERVICIOS']);
    hoja.mergeCells(filaTitulo.number, 1, filaTitulo.number, TOTAL_COLUMNAS);
    filaTitulo.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    filaTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
    filaTitulo.height = 22;
    filaTitulo.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };

    if (empresa?.nombre) {
      const filaEmpresa = hoja.addRow([`Empresa: ${empresa.nombre}`]);
      hoja.mergeCells(filaEmpresa.number, 1, filaEmpresa.number, TOTAL_COLUMNAS);
      filaEmpresa.font = { bold: true };
    }

    const filaPeriodo = hoja.addRow([`Periodo de pagos: ${formatearFecha(filtro.fechaInicio)} - ${formatearFecha(filtro.fechaFin)}`]);
    hoja.mergeCells(filaPeriodo.number, 1, filaPeriodo.number, TOTAL_COLUMNAS);
    filaPeriodo.font = { italic: true, color: { argb: 'FF666666' } };

    if (filtro.proveedor || filtro.sector) {
      const partes = [
        filtro.proveedor ? `Proveedor: ${filtro.proveedor}` : null,
        filtro.sector ? `Sector: ${filtro.sector}` : null,
      ].filter(Boolean);
      const filaFiltros = hoja.addRow([partes.join('          ')]);
      hoja.mergeCells(filaFiltros.number, 1, filaFiltros.number, TOTAL_COLUMNAS);
      filaFiltros.font = { italic: true, color: { argb: 'FF666666' } };
    }

    hoja.addRow([]); // separacion antes de la tabla

    // --- Encabezado de la tabla ---
    const encabezado = hoja.addRow(['Servicio', 'Proveedor', 'Sector', 'Estado', 'Costo Mensual (USD)', 'Pagos en Periodo (USD)']);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.eachCell((celda: any) => {
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      celda.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    filas.forEach((f) => {
      hoja.addRow({
        servicio: f.servicio,
        proveedor: f.proveedor_nombre,
        sector: f.sector_nombre || '-',
        estado: f.estado,
        costoMensual: Number(f.costo_mensual ?? 0),
        pagosPeriodo: Number(f.pagos_total_rango ?? 0),
      });
    });

    hoja.getColumn('costoMensual').numFmt = '#,##0.00';
    hoja.getColumn('pagosPeriodo').numFmt = '#,##0.00';

    const filaTotal = hoja.addRow({
      servicio: '',
      proveedor: '',
      sector: '',
      estado: 'TOTAL',
      costoMensual: filas.reduce((sum, f) => sum + Number(f.costo_mensual ?? 0), 0),
      pagosPeriodo: filas.reduce((sum, f) => sum + Number(f.pagos_total_rango ?? 0), 0),
    });
    filaTotal.font = { bold: true };

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-servicios_${formatearFecha(filtro.fechaInicio).replace(/\//g, '-')}_${formatearFecha(filtro.fechaFin).replace(/\//g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
