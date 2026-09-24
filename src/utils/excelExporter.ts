import ExcelJS from 'exceljs';
import { HotelProfile } from '../types';
import { formatDate } from './formatters';

export interface ExcelColumnDefinition {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'currency' | 'number' | 'date' | 'status' | 'code';
}

export interface ExcelExportOptions {
  title: string;
  sheetName?: string;
  profile?: HotelProfile;
  columns: ExcelColumnDefinition[];
  data: Record<string, any>[];
  filename?: string;
  summaryRow?: boolean;
}

/**
 * Enterprise styled .xlsx workbook exporter for Hotel Damview Management Suite.
 * Generates styled workbooks with custom header branding, correct number formatting,
 * currency typing (Ksh #,##0.00), auto-fit column widths, and zebra striping.
 */
export async function exportTableToXlsx(options: ExcelExportOptions): Promise<void> {
  const { title, sheetName = 'Sheet1', profile, columns, data, filename, summaryRow = true } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hotel Damview Management Suite';
  workbook.lastModifiedBy = 'Hotel Damview System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', paperSize: 9 }, // A4
  });

  const hotelName = profile?.name || 'HOTEL DAMVIEW';
  const kraPin = profile?.kraPin || 'P051453023Q';
  const address = profile?.physicalLocation || 'MARIAKANI, KENYA';

  // 1. Hotel Brand Title Banner
  worksheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = `${hotelName} — ${title.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFF59E0B' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1C1917' }, // Stone 900
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  // 2. Metadata Subtitle Row
  worksheet.mergeCells(2, 1, 2, columns.length);
  const metaCell = worksheet.getCell(2, 1);
  metaCell.value = `PIN: ${kraPin} | Location: ${address} | Export Generated: ${new Date().toLocaleString()} | Total Records: ${data.length}`;
  metaCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  metaCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF292524' }, // Stone 800
  };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  // 3. Empty Separator Row
  worksheet.getRow(3).height = 8;

  // 4. Table Header Row (Row 4)
  const headerRow = worksheet.getRow(4);
  headerRow.height = 24;

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Slate 900
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.type === 'currency' || col.type === 'number' ? 'right' : 'left',
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FFF59E0B' } }, // Amber underline
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });

  // 5. Data Rows
  let currentRowIdx = 5;
  const currencyTotals: Record<number, number> = {};

  data.forEach((rowObj, rIdx) => {
    const row = worksheet.getRow(currentRowIdx);
    row.height = 20;
    const isEven = rIdx % 2 === 0;

    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      const rawVal = rowObj[col.key];

      if (col.type === 'currency') {
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0).replace(/[^0-9.-]/g, '')) || 0;
        cell.value = numVal;
        cell.numFmt = '"Ksh "#,##0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        currencyTotals[cIdx + 1] = (currencyTotals[cIdx + 1] || 0) + numVal;
      } else if (col.type === 'number') {
        const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal) || 0;
        cell.value = numVal;
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (col.type === 'date') {
        cell.value = rawVal ? formatDate(String(rawVal)) : '-';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (col.type === 'code') {
        cell.value = rawVal ? String(rawVal) : '';
        cell.font = { name: 'Courier New', size: 9.5, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.value = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      cell.font = cell.font || { name: 'Arial', size: 9.5 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }, // Zebra striping
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    currentRowIdx++;
  });

  // 6. Summary / Total Row (if there are currency columns and summaryRow is enabled)
  if (summaryRow && Object.keys(currencyTotals).length > 0) {
    const summaryRowObj = worksheet.getRow(currentRowIdx);
    summaryRowObj.height = 24;

    columns.forEach((col, cIdx) => {
      const colNum = cIdx + 1;
      const cell = summaryRowObj.getCell(colNum);

      if (cIdx === 0) {
        cell.value = 'TOTAL';
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1C1917' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (currencyTotals[colNum] !== undefined) {
        cell.value = currencyTotals[colNum];
        cell.numFmt = '"Ksh "#,##0.00';
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1C1917' } };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.value = '';
      }

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
  }

  // 7. Auto-fit column widths with safety margins
  worksheet.columns.forEach((column, i) => {
    const colDef = columns[i];
    if (colDef && colDef.width) {
      column.width = colDef.width;
    } else {
      let maxLen = (colDef?.header?.length || 10) + 4;
      data.forEach((row) => {
        const val = row[colDef.key];
        if (val) {
          const s = String(val);
          if (s.length > maxLen) maxLen = Math.min(s.length + 3, 40);
        }
      });
      column.width = Math.max(maxLen, 12);
    }
  });

  // 8. Generate buffer and trigger instant download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const finalName =
    filename ||
    `HotelDamview_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${formatDate(new Date().toISOString())}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}
