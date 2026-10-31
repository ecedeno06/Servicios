// -----------------------------------------------------------------------------
// Genera el "Reporte de equipos asignados" en Excel (.xlsx) via exceljs,
// cargado de forma diferida -- mismo patron que reporte-carrito-excel.service.ts,
// pero con una sola hoja (un equipo no tiene detalle/lineas hijas).
// -----------------------------------------------------------------------------

import { Injectable } from '@angular/core';
import { EquipoAsignado } from '../models/models';
import { FiltroReporteEquipos } from './reporte-equipos-pdf.service';

let exceljsCache: any = null;
async function cargarExcelJs(): Promise<any> {
  if (exceljsCache) return exceljsCache;
  const mod = await import('exceljs');
  exceljsCache = (mod as any).default ?? mod;
  return exceljsCache;
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function textoMac(e: EquipoAsignado): string {
  if (!e.mac_address && !e.hardware_address) return '-';
  return `${e.mac_address ?? '-'} - ${e.hardware_address ?? '-'}`;
}

const COLUMNAS_EQUIPOS = 12; // Categoria, Marca/Modelo, Estado, Asignado a, Entrada, Vida util, CPU, RAM, Disk, MAC, Proveedor, No. Factura

function tituloYFiltro(hoja: any, titulo: string, filtro: FiltroReporteEquipos, empresa: { nombre?: string | null } | undefined, totalColumnas: number): void {
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

  const filaPeriodo = hoja.addRow([`Estado: ${filtro.estado || 'Todos'}          Periodo de entrada: ${formatearFecha(filtro.fechaInicio)} - ${formatearFecha(filtro.fechaFin)}`]);
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
export class ReporteEquiposExcelService {

  async descargar(
    equipos: EquipoAsignado[],
    filtro: FiltroReporteEquipos,
    textoVidaUtil: (e: EquipoAsignado) => string,
    etiquetaEstado: (e: EquipoAsignado) => string,
    empresa?: { nombre?: string | null }
  ): Promise<void> {
    const ExcelJS = await cargarExcelJs();
    const libro = new ExcelJS.Workbook();

    const hoja = libro.addWorksheet('Equipos');
    hoja.columns = [
      { key: 'categoria', width: 18 },
      { key: 'marcaModelo', width: 26 },
      { key: 'estado', width: 14 },
      { key: 'asignadoA', width: 20 },
      { key: 'entrada', width: 14 },
      { key: 'vidaUtil', width: 14 },
      { key: 'cpu', width: 16 },
      { key: 'ram', width: 10 },
      { key: 'disk', width: 10 },
      { key: 'mac', width: 26 },
      { key: 'proveedor', width: 18 },
      { key: 'noFactura', width: 14 },
    ];

    tituloYFiltro(hoja, 'REPORTE DE EQUIPOS ASIGNADOS', filtro, empresa, COLUMNAS_EQUIPOS);

    const encabezado = hoja.addRow(['Categoria', 'Marca / Modelo', 'Estado', 'Asignado a', 'Entrada', 'Vida util', 'CPU', 'RAM', 'Disk', 'MAC', 'Proveedor', 'No. Factura']);
    estilarEncabezado(encabezado);

    equipos.forEach((e) => {
      hoja.addRow({
        categoria: e.categoria_nombre,
        marcaModelo: `${e.marca} ${e.modelo}`,
        estado: etiquetaEstado(e),
        asignadoA: e.asignada_a || '-',
        entrada: formatearFecha(e.fecha_entrada),
        vidaUtil: textoVidaUtil(e),
        cpu: e.procesador_nombre || '-',
        ram: e.memoria_ram || '-',
        disk: e.disco_duro || '-',
        mac: textoMac(e),
        proveedor: e.proveedor_nombre || '-',
        noFactura: e.no_factura || '-',
      });
    });

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-equipos-asignados_${formatearFecha(filtro.fechaInicio).replace(/\//g, '-')}_${formatearFecha(filtro.fechaFin).replace(/\//g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
