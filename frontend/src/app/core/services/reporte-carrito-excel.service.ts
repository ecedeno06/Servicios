// -----------------------------------------------------------------------------
// Genera el "Reporte de carrito de compras" en Excel (.xlsx) via exceljs,
// cargado de forma diferida -- mismo patron que reporte-servicios-excel.service.ts.
// Dos hojas: "Ordenes" (cabeceras con totales) y "Detalle" (equipos por orden).
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import { ReporteCarritoCabecera, ReporteCarritoDetalleItem } from '../models/models';
import { FiltroReporteCarrito } from './reporte-carrito-pdf.service';

let exceljsCache: any = null;
async function cargarExcelJs(): Promise<any> {
  if (exceljsCache) return exceljsCache;
  const mod = await import('exceljs');
  exceljsCache = (mod as any).default ?? mod;
  return exceljsCache;
}

function idCorto(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const COLUMNAS_ORDENES = 7; // ID, Titulo, Fecha Solicitud, Estado, Aprobado por, Costo Propuesto, Costo Aprobado
const COLUMNAS_DETALLE = 7; // Orden, Categoria, Marca/Modelo, Proveedor, Cant. Propuesta, Cant. Aprobada, Costo Estimado

function tituloYFiltro(hoja: any, titulo: string, filtro: FiltroReporteCarrito, empresa: { nombre?: string | null } | undefined, totalColumnas: number): void {
  const filaTitulo = hoja.addRow([titulo]);
  hoja.mergeCells(filaTitulo.number, 1, filaTitulo.number, totalColumnas);
  filaTitulo.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  filaTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
  filaTitulo.height = 22;
  filaTitulo.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };

  if (empresa?.nombre) {
    const filaEmpresa = hoja.addRow([`Empresa: ${empresa.nombre}`]);
    hoja.mergeCells(filaEmpresa.number, 1, filaEmpresa.number, totalColumnas);
    filaEmpresa.font = { bold: true };
  }

  const filaPeriodo = hoja.addRow([`Estado: ${filtro.estado || 'Todos'}          Periodo de solicitud: ${formatearFecha(filtro.fechaInicio)} - ${formatearFecha(filtro.fechaFin)}`]);
  hoja.mergeCells(filaPeriodo.number, 1, filaPeriodo.number, totalColumnas);
  filaPeriodo.font = { italic: true, color: { argb: 'FF666666' } };

  hoja.addRow([]); // separacion antes de la tabla
}

function estilarEncabezado(fila: any): void {
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.eachCell((celda: any) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}

@Injectable({ providedIn: 'root' })
export class ReporteCarritoExcelService {

  async descargar(
    cabeceras: ReporteCarritoCabecera[],
    detalles: ReporteCarritoDetalleItem[],
    filtro: FiltroReporteCarrito,
    empresa?: { nombre?: string | null }
  ): Promise<void> {
    const ExcelJS = await cargarExcelJs();
    const libro = new ExcelJS.Workbook();

    // --- Hoja 1: Ordenes ---
    const hojaOrdenes = libro.addWorksheet('Ordenes');
    hojaOrdenes.columns = [
      { key: 'id', width: 12 },
      { key: 'titulo', width: 30 },
      { key: 'fechaSolicitud', width: 16 },
      { key: 'estado', width: 16 },
      { key: 'aprobadoPor', width: 24 },
      { key: 'costoPropuesto', width: 18 },
      { key: 'costoAprobado', width: 18 },
    ];

    tituloYFiltro(hojaOrdenes, 'REPORTE DE CARRITO DE COMPRAS', filtro, empresa, COLUMNAS_ORDENES);

    const encabezadoOrdenes = hojaOrdenes.addRow(['ID', 'Titulo', 'Fecha Solicitud', 'Estado', 'Aprobado por', 'Costo Propuesto (USD)', 'Costo Aprobado (USD)']);
    estilarEncabezado(encabezadoOrdenes);

    cabeceras.forEach((c) => {
      hojaOrdenes.addRow({
        id: idCorto(c.id),
        titulo: c.titulo,
        fechaSolicitud: formatearFecha(c.fecha_solicitud),
        estado: c.estado,
        aprobadoPor: c.aprobado_por_nombre || '-',
        costoPropuesto: Number(c.costo_estimado_propuesto_total ?? 0),
        costoAprobado: Number(c.costo_estimado_aprobado_total ?? 0),
      });
    });

    hojaOrdenes.getColumn('costoPropuesto').numFmt = '#,##0.00';
    hojaOrdenes.getColumn('costoAprobado').numFmt = '#,##0.00';

    const filaTotalOrdenes = hojaOrdenes.addRow({
      titulo: '',
      estado: 'TOTAL',
      costoPropuesto: cabeceras.reduce((sum, c) => sum + Number(c.costo_estimado_propuesto_total ?? 0), 0),
      costoAprobado: cabeceras.reduce((sum, c) => sum + Number(c.costo_estimado_aprobado_total ?? 0), 0),
    });
    filaTotalOrdenes.font = { bold: true };

    // --- Hoja 2: Detalle ---
    const hojaDetalle = libro.addWorksheet('Detalle');
    hojaDetalle.columns = [
      { key: 'orden', width: 34 },
      { key: 'categoria', width: 20 },
      { key: 'marcaModelo', width: 28 },
      { key: 'proveedor', width: 22 },
      { key: 'cantidadPropuesta', width: 16 },
      { key: 'cantidadAprobada', width: 16 },
      { key: 'costoEstimado', width: 18 },
    ];

    tituloYFiltro(hojaDetalle, 'DETALLE DE EQUIPOS POR ORDEN', filtro, empresa, COLUMNAS_DETALLE);

    const encabezadoDetalle = hojaDetalle.addRow(['Orden', 'Categoria', 'Marca / Modelo', 'Proveedor', 'Cant. Propuesta', 'Cant. Aprobada', 'Costo Estimado (USD)']);
    estilarEncabezado(encabezadoDetalle);

    detalles.forEach((d) => {
      hojaDetalle.addRow({
        orden: `${idCorto(d.carrito_id)} · ${d.carrito_titulo}`,
        categoria: d.categoria_nombre || '-',
        marcaModelo: `${d.marca} ${d.modelo}`,
        proveedor: d.proveedor_nombre || '-',
        cantidadPropuesta: d.cantidad_propuesta,
        cantidadAprobada: d.cantidad_aprobada ?? '-',
        costoEstimado: Number(d.costo_estimado ?? 0),
      });
    });

    hojaDetalle.getColumn('costoEstimado').numFmt = '#,##0.00';

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-carrito-compras_${formatearFecha(filtro.fechaInicio).replace(/\//g, '-')}_${formatearFecha(filtro.fechaFin).replace(/\//g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
