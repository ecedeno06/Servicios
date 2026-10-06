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

@Injectable({ providedIn: 'root' })
export class ReporteServiciosExcelService {

  async descargar(filas: ReporteServicioPagos[], filtro: FiltroReporteServicios): Promise<void> {
    const ExcelJS = await cargarExcelJs();
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Reporte de servicios');

    hoja.columns = [
      { header: 'Servicio', key: 'servicio', width: 32 },
      { header: 'Proveedor', key: 'proveedor', width: 26 },
      { header: 'Sector', key: 'sector', width: 20 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Costo Mensual (USD)', key: 'costoMensual', width: 20 },
      { header: 'Pagos en Periodo (USD)', key: 'pagosPeriodo', width: 22 },
    ];

    const encabezado = hoja.getRow(1);
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
