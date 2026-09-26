import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { BillingDocument, Client, DocumentStatus, HotelProfile, PaymentRecord, StatementRecord } from '../types';
import { dbService } from './db';

export const DEFAULT_ARCHIVE_PATH =
  'C:\\Users\\mercy\\OneDrive\\Documents\\Mikma & Hotel Damview\\Hotel Damview_Template Files\\Hotel Damview_Documents Templates\\Hotel Damview_Archives';

export const WORKBOOK_FILENAME = 'Hotel_Damview_Master_Suite.xlsm';
export const VBA_MODULE_FILENAME = 'modHotelDamviewEngine.bas';

// IndexedDB key for storing FileSystemDirectoryHandle
const FS_HANDLE_DB_NAME = 'damview_fs_store';
const FS_HANDLE_STORE_NAME = 'handles';
const FS_HANDLE_KEY = 'local_archive_dir';

/**
 * Persist FileSystemDirectoryHandle in IndexedDB
 */
export async function saveDirectoryHandle(handle: any): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FS_HANDLE_STORE_NAME)) {
        db.createObjectStore(FS_HANDLE_STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(FS_HANDLE_STORE_NAME, 'readwrite');
      tx.objectStore(FS_HANDLE_STORE_NAME).put(handle, FS_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve saved FileSystemDirectoryHandle from IndexedDB
 */
export async function getSavedDirectoryHandle(): Promise<any | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(FS_HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FS_HANDLE_STORE_NAME)) {
        db.createObjectStore(FS_HANDLE_STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction(FS_HANDLE_STORE_NAME, 'readonly');
        const getReq = tx.objectStore(FS_HANDLE_STORE_NAME).get(FS_HANDLE_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

/**
 * Clear saved directory handle
 */
export async function clearDirectoryHandle(): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise((resolve) => {
    const req = indexedDB.open(FS_HANDLE_DB_NAME, 1);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction(FS_HANDLE_STORE_NAME, 'readwrite');
        tx.objectStore(FS_HANDLE_STORE_NAME).delete(FS_HANDLE_KEY);
        tx.oncomplete = () => resolve();
      } catch {
        resolve();
      }
    };
    req.onerror = () => resolve();
  });
}

/**
 * Verify readwrite permission on directory handle
 */
export async function verifyDirectoryPermission(handle: any, readWrite = true): Promise<boolean> {
  if (!handle) return false;
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    if (typeof handle.queryPermission === 'function') {
      if ((await handle.queryPermission(options)) === 'granted') {
        return true;
      }
    }
    if (typeof handle.requestPermission === 'function') {
      if ((await handle.requestPermission(options)) === 'granted') {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export interface MasterWorkbookOptions {
  profile: HotelProfile;
  clients: Client[];
  documents: BillingDocument[];
  payments: PaymentRecord[];
  statements: StatementRecord[];
}

/**
 * Builds the complete Hotel Damview Master Suite .xlsm workbook
 */
export async function generateMasterSuiteWorkbook(
  options: MasterWorkbookOptions
): Promise<Uint8Array> {
  const { profile, clients, documents, payments, statements } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hotel Damview ERP System';
  wb.lastModifiedBy = 'Hotel Damview Management';
  wb.created = new Date();
  wb.modified = new Date();
  wb.company = 'HOTEL DAMVIEW LTD';
  wb.title = 'Hotel Damview Executive Master Suite';
  wb.subject = 'A4 Print Templates, Universal Document Editor & Google Sheets Live Ledger';

  // Fonts & styles
  const fontTimes11 = { name: 'Times New Roman', size: 11 };
  const fontTimes11Bold = { name: 'Times New Roman', size: 11, bold: true };
  const fontTimes12Bold = { name: 'Times New Roman', size: 12, bold: true };
  const fontTimes14Bold = { name: 'Times New Roman', size: 14, bold: true };
  const fontTimes16Bold = { name: 'Times New Roman', size: 16, bold: true };
  const fontTimes9Italic = { name: 'Times New Roman', size: 9, italic: true };
  const fontTimes9 = { name: 'Times New Roman', size: 9 };

  const fillCharcoal: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1C1917' }, // Stone 900
  };
  const fillGold: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF59E0B' }, // Amber 500
  };
  const fillSubtleGray: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF4F4F5' }, // Zinc 100
  };
  const fillHeaderGray: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE4E4E7' }, // Zinc 200
  };

  const borderHairline: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  };

  const borderDoubleBottom: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF18181B' } },
    bottom: { style: 'double', color: { argb: 'FF18181B' } },
    left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  };

  const formatCurrency = '#,##0.00';

  // ---------------------------------------------------------------------------
  // 1. DOC_EDITOR (Universal Document Editor Sheet)
  // ---------------------------------------------------------------------------
  const wsEditor = wb.addWorksheet('Doc_Editor', {
    views: [{ showGridLines: true }],
  });
  wsEditor.columns = [
    { width: 8 },  // A
    { width: 34 }, // B
    { width: 12 }, // C
    { width: 10 }, // D
    { width: 16 }, // E
    { width: 18 }, // F
    { width: 4 },  // G
  ];

  // Header
  wsEditor.mergeCells('A1:F1');
  const edTitle = wsEditor.getCell('A1');
  edTitle.value = 'HOTEL DAMVIEW LTD — UNIVERSAL DOCUMENT WORKSTATION';
  edTitle.font = { ...fontTimes14Bold, color: { argb: 'FFFFFFFF' } };
  edTitle.fill = fillCharcoal;
  edTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsEditor.getRow(1).height = 28;

  wsEditor.mergeCells('A2:F2');
  const edSub = wsEditor.getCell('A2');
  edSub.value = 'Select Document Type & Client from dropdowns. Enter line items. Click macros or Alt+F8 to populate printable templates & generate PDF.';
  edSub.font = fontTimes9Italic;
  edSub.alignment = { horizontal: 'center', vertical: 'middle' };
  wsEditor.getRow(2).height = 18;

  // Mode & Document Configuration
  wsEditor.getCell('B4').value = 'Document Type:';
  wsEditor.getCell('B4').font = fontTimes11Bold;
  wsEditor.getCell('C4').value = 'TAX INVOICE';
  wsEditor.getCell('C4').font = { ...fontTimes11Bold, color: { argb: 'FFB45309' } };
  wsEditor.getCell('C4').fill = fillSubtleGray;
  wsEditor.getCell('C4').dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"TAX INVOICE,QUOTATION,PROFORMA INVOICE,PAYMENT RECEIPT,STATEMENT"'],
  };

  wsEditor.getCell('E4').value = 'Document Number:';
  wsEditor.getCell('E4').font = fontTimes11Bold;
  wsEditor.getCell('F4').value = 'INV-2025-001';
  wsEditor.getCell('F4').font = fontTimes11Bold;
  wsEditor.getCell('F4').fill = fillSubtleGray;

  wsEditor.getCell('B5').value = 'Issue Date (YYYY-MM-DD):';
  wsEditor.getCell('B5').font = fontTimes11;
  wsEditor.getCell('C5').value = new Date().toISOString().split('T')[0];
  wsEditor.getCell('C5').font = fontTimes11;

  wsEditor.getCell('E5').value = 'Due Date / Validity:';
  wsEditor.getCell('E5').font = fontTimes11;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  wsEditor.getCell('F5').value = dueDate.toISOString().split('T')[0];
  wsEditor.getCell('F5').font = fontTimes11;

  wsEditor.getCell('B6').value = 'Payment Terms:';
  wsEditor.getCell('B6').font = fontTimes11;
  wsEditor.getCell('C6').value = 'Net 30 Days';
  wsEditor.getCell('C6').font = fontTimes11;

  wsEditor.getCell('E6').value = 'Status:';
  wsEditor.getCell('E6').font = fontTimes11;
  wsEditor.getCell('F6').value = 'Draft';
  wsEditor.getCell('F6').font = fontTimes11;

  // Client Selection
  wsEditor.mergeCells('B8:F8');
  const clHeader = wsEditor.getCell('B8');
  clHeader.value = 'CLIENT & CONTACT PARTICULARS';
  clHeader.font = fontTimes11Bold;
  clHeader.fill = fillHeaderGray;

  wsEditor.getCell('B9').value = 'Select Client Name:';
  wsEditor.getCell('B9').font = fontTimes11Bold;
  const defaultClientName = clients[0]?.name || 'Standard Client';
  wsEditor.getCell('C9').value = defaultClientName;
  wsEditor.getCell('C9').font = fontTimes11Bold;
  wsEditor.getCell('C9').fill = fillSubtleGray;
  wsEditor.getCell('C9').dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['Data_Clients!$B$2:$B$100'],
  };

  wsEditor.getCell('E9').value = 'KRA PIN:';
  wsEditor.getCell('E9').font = fontTimes11;
  wsEditor.getCell('F9').value = {
    formula: 'IFERROR(VLOOKUP(C9, Data_Clients!$B$2:$E$100, 4, FALSE), "P051982741Z")',
    result: clients[0]?.kraPin || 'P051982741Z',
  };
  wsEditor.getCell('F9').font = fontTimes11;

  wsEditor.getCell('B10').value = 'Telephone:';
  wsEditor.getCell('B10').font = fontTimes11;
  wsEditor.getCell('C10').value = {
    formula: 'IFERROR(VLOOKUP(C9, Data_Clients!$B$2:$C$100, 2, FALSE), "+254 700 000 000")',
    result: clients[0]?.phone || '+254 700 000 000',
  };
  wsEditor.getCell('C10').font = fontTimes11;

  wsEditor.getCell('E10').value = 'Physical Address:';
  wsEditor.getCell('E10').font = fontTimes11;
  wsEditor.getCell('F10').value = {
    formula: 'IFERROR(VLOOKUP(C9, Data_Clients!$B$2:$F$100, 5, FALSE), "Nairobi / Machakos, Kenya")',
    result: clients[0]?.address || 'Nairobi / Machakos, Kenya',
  };
  wsEditor.getCell('F10').font = fontTimes11;

  wsEditor.getCell('B11').value = 'Email Address:';
  wsEditor.getCell('B11').font = fontTimes11;
  wsEditor.getCell('C11').value = {
    formula: 'IFERROR(VLOOKUP(C9, Data_Clients!$B$2:$D$100, 3, FALSE), "info@client.co.ke")',
    result: clients[0]?.email || 'info@client.co.ke',
  };
  wsEditor.getCell('C11').font = fontTimes11;

  wsEditor.getCell('E11').value = 'Amount Paid (Ksh):';
  wsEditor.getCell('E11').font = fontTimes11;
  wsEditor.getCell('F11').value = 0;
  wsEditor.getCell('F11').numFmt = formatCurrency;
  wsEditor.getCell('F11').font = fontTimes11;

  // Action Buttons row / Macro trigger prompts
  wsEditor.mergeCells('B13:F13');
  const btnRow = wsEditor.getCell('B13');
  btnRow.value =
    '[VBA CONTROLS]: 1. Switch Mode  |  2. Populate Template  |  3. Export PDF  |  4. Save & Append to Data';
  btnRow.font = { ...fontTimes11Bold, color: { argb: 'FF1C1917' } };
  btnRow.fill = fillGold;
  btnRow.alignment = { horizontal: 'center', vertical: 'middle' };
  wsEditor.getRow(13).height = 24;

  // Particulars Table Headers
  const particularsHeaders = ['Item #', 'Description / Particulars', 'Qty', 'Days', 'Rate (Ksh)', 'Amount (Ksh)'];
  particularsHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const cell = wsEditor.getCell(`${colLetter}15`);
    cell.value = h;
    cell.font = { ...fontTimes11Bold, color: { argb: 'FFFFFFFF' } };
    cell.fill = fillCharcoal;
    cell.alignment = {
      horizontal: idx === 1 ? 'left' : idx >= 4 ? 'right' : 'center',
      vertical: 'middle',
    };
    cell.border = borderHairline;
  });
  wsEditor.getRow(15).height = 22;

  // 12 Structured Line Items (Rows 16 to 27)
  const sampleItems = [
    { desc: 'Executive Conference Hall & AV Facilities', qty: 1, days: 1, rate: 25000 },
    { desc: 'Full Day Delegate Package (Buffet Lunch & High Teas)', qty: 20, days: 1, rate: 2200 },
    { desc: 'Deluxe Room Accommodation (Bed & Breakfast)', qty: 2, days: 1, rate: 6500 },
  ];

  for (let i = 0; i < 12; i++) {
    const rIdx = 16 + i;
    const item = sampleItems[i] || { desc: '', qty: 0, days: 1, rate: 0 };
    wsEditor.getCell(`A${rIdx}`).value = i + 1;
    wsEditor.getCell(`A${rIdx}`).alignment = { horizontal: 'center' };
    wsEditor.getCell(`A${rIdx}`).font = fontTimes11;
    wsEditor.getCell(`A${rIdx}`).border = borderHairline;

    wsEditor.getCell(`B${rIdx}`).value = item.desc;
    wsEditor.getCell(`B${rIdx}`).font = fontTimes11;
    wsEditor.getCell(`B${rIdx}`).border = borderHairline;

    wsEditor.getCell(`C${rIdx}`).value = item.qty;
    wsEditor.getCell(`C${rIdx}`).alignment = { horizontal: 'center' };
    wsEditor.getCell(`C${rIdx}`).font = fontTimes11;
    wsEditor.getCell(`C${rIdx}`).border = borderHairline;

    wsEditor.getCell(`D${rIdx}`).value = item.days;
    wsEditor.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
    wsEditor.getCell(`D${rIdx}`).font = fontTimes11;
    wsEditor.getCell(`D${rIdx}`).border = borderHairline;

    wsEditor.getCell(`E${rIdx}`).value = item.rate;
    wsEditor.getCell(`E${rIdx}`).numFmt = formatCurrency;
    wsEditor.getCell(`E${rIdx}`).font = fontTimes11;
    wsEditor.getCell(`E${rIdx}`).border = borderHairline;

    wsEditor.getCell(`F${rIdx}`).value = {
      formula: `IF(C${rIdx}>0, C${rIdx}*MAX(1,D${rIdx})*E${rIdx}, 0)`,
      result: item.qty * item.days * item.rate,
    };
    wsEditor.getCell(`F${rIdx}`).numFmt = formatCurrency;
    wsEditor.getCell(`F${rIdx}`).font = fontTimes11;
    wsEditor.getCell(`F${rIdx}`).border = borderHairline;
    wsEditor.getRow(rIdx).height = 19;
  }

  // Financial Summary Block (Rows 28 to 32)
  wsEditor.getCell('E28').value = 'Subtotal (Excl. VAT 16%):';
  wsEditor.getCell('E28').font = fontTimes11;
  wsEditor.getCell('F28').value = { formula: 'F30/1.16', result: 0 };
  wsEditor.getCell('F28').numFmt = formatCurrency;
  wsEditor.getCell('F28').font = fontTimes11;

  wsEditor.getCell('E29').value = 'VAT (16% Included):';
  wsEditor.getCell('E29').font = fontTimes11;
  wsEditor.getCell('F29').value = { formula: 'F30-F28', result: 0 };
  wsEditor.getCell('F29').numFmt = formatCurrency;
  wsEditor.getCell('F29').font = fontTimes11;

  wsEditor.getCell('E30').value = 'Grand Total (Ksh):';
  wsEditor.getCell('E30').font = fontTimes12Bold;
  wsEditor.getCell('F30').value = { formula: 'SUM(F16:F27)', result: 82000 };
  wsEditor.getCell('F30').numFmt = formatCurrency;
  wsEditor.getCell('F30').font = fontTimes12Bold;
  wsEditor.getCell('F30').border = borderDoubleBottom;

  wsEditor.getCell('E31').value = 'Amount Paid (Ksh):';
  wsEditor.getCell('E31').font = fontTimes11;
  wsEditor.getCell('F31').value = { formula: 'F11', result: 0 };
  wsEditor.getCell('F31').numFmt = formatCurrency;
  wsEditor.getCell('F31').font = fontTimes11;

  wsEditor.getCell('E32').value = 'Net Balance Due (Ksh):';
  wsEditor.getCell('E32').font = { ...fontTimes12Bold, color: { argb: 'FFB91C1C' } };
  wsEditor.getCell('F32').value = { formula: 'F30-F31', result: 82000 };
  wsEditor.getCell('F32').numFmt = formatCurrency;
  wsEditor.getCell('F32').font = { ...fontTimes12Bold, color: { argb: 'FFB91C1C' } };
  wsEditor.getCell('F32').border = borderDoubleBottom;

  // Notes & Terms on Editor
  wsEditor.mergeCells('B34:F34');
  wsEditor.getCell('B34').value = 'TERMS & INSTRUCTIONS';
  wsEditor.getCell('B34').font = fontTimes11Bold;
  wsEditor.getCell('B34').fill = fillHeaderGray;

  const bankNote = (profile.bankName?.trim() && profile.accountNumber?.trim())
    ? ` 3. Bank: ${profile.bankName.trim()} Acc: ${profile.accountNumber.trim()}.`
    : '';
  const mpesaNote = profile.mpesaTillNumber?.trim()
    ? ` M-Pesa Till: ${profile.mpesaTillNumber.trim()}.`
    : '';
  wsEditor.mergeCells('B35:F35');
  wsEditor.getCell('B35').value =
    `1. Payment is due strictly according to agreed terms. 2. Cheques payable to ${profile.name || 'HOTEL DAMVIEW LTD'}.${mpesaNote}${bankNote}`;
  wsEditor.getCell('B35').font = fontTimes9Italic;

  // ---------------------------------------------------------------------------
  // 2. TEMPLATE_INVOICE (Print-Accurate A4 Mirroring)
  // ---------------------------------------------------------------------------
  buildPrintableTemplateSheet(
    wb,
    'Template_Invoice',
    'TAX INVOICE',
    profile,
    'INV-2025-001',
    'Invoice Number:'
  );

  // 3. TEMPLATE_QUOTATION
  buildPrintableTemplateSheet(
    wb,
    'Template_Quotation',
    'PRICE QUOTATION',
    profile,
    'QT-2025-001',
    'Quotation Number:'
  );

  // 4. TEMPLATE_PROFORMA
  buildPrintableTemplateSheet(
    wb,
    'Template_Proforma',
    'PROFORMA INVOICE',
    profile,
    'PI-2025-001',
    'Proforma Number:'
  );

  // 5. TEMPLATE_RECEIPT
  buildPrintableTemplateSheet(
    wb,
    'Template_Receipt',
    'OFFICIAL PAYMENT RECEIPT',
    profile,
    'REC-2025-001',
    'Receipt Number:'
  );

  // 6. TEMPLATE_STATEMENT
  buildPrintableTemplateSheet(
    wb,
    'Template_Statement',
    'STATEMENT OF ACCOUNT',
    profile,
    'SOA-2025-001',
    'Statement Number:'
  );

  // ---------------------------------------------------------------------------
  // 7. OPERATIONAL DATA TABS (Mirroring Google Sheets)
  // ---------------------------------------------------------------------------
  // A. Data_Clients
  const wsClients = wb.addWorksheet('Data_Clients');
  wsClients.columns = [
    { header: 'Client ID', key: 'id', width: 14 },
    { header: 'Client Name', key: 'name', width: 32 },
    { header: 'Telephone', key: 'phone', width: 18 },
    { header: 'Email Address', key: 'email', width: 26 },
    { header: 'KRA PIN', key: 'kraPin', width: 16 },
    { header: 'Physical Address', key: 'address', width: 30 },
    { header: 'Created Date', key: 'created', width: 16 },
  ];
  styleHeaderRow(wsClients, fillCharcoal);
  clients.forEach((c) => {
    wsClients.addRow({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      kraPin: c.kraPin || '',
      address: c.address || '',
      created: c.createdAt ? c.createdAt.split('T')[0] : '',
    });
  });

  // B. Data_Invoices
  const invoices = documents.filter((d) => d.documentType === 'INVOICE');
  const wsInvoices = wb.addWorksheet('Data_Invoices');
  wsInvoices.columns = [
    { header: 'Invoice Number', key: 'docNum', width: 18 },
    { header: 'Issue Date', key: 'date', width: 14 },
    { header: 'Due Date', key: 'dueDate', width: 14 },
    { header: 'Client Name', key: 'client', width: 30 },
    { header: 'Client PIN', key: 'pin', width: 16 },
    { header: 'Subtotal (Ksh)', key: 'subtotal', width: 18 },
    { header: 'VAT 16% (Ksh)', key: 'vat', width: 16 },
    { header: 'Grand Total (Ksh)', key: 'total', width: 18 },
    { header: 'Amount Paid (Ksh)', key: 'paid', width: 18 },
    { header: 'Balance Due (Ksh)', key: 'balance', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Payment Terms', key: 'terms', width: 18 },
    { header: 'Drive PDF Link', key: 'driveUrl', width: 36 },
  ];
  styleHeaderRow(wsInvoices, fillCharcoal);
  invoices.forEach((doc) => {
    const row = wsInvoices.addRow({
      docNum: doc.documentNumber,
      date: doc.issueDate,
      dueDate: doc.dueDate || '',
      client: doc.clientName,
      pin: doc.clientKraPin || '',
      subtotal: doc.subtotal,
      vat: doc.vatAmount,
      total: doc.grandTotal,
      paid: doc.amountPaid || 0,
      balance: doc.balanceDue,
      status: doc.status,
      terms: doc.terms || '',
      driveUrl: doc.driveFileUrl || '',
    });
    [6, 7, 8, 9, 10].forEach((idx) => {
      row.getCell(idx).numFmt = formatCurrency;
    });
  });

  // C. Data_Quotations
  const quotations = documents.filter((d) => d.documentType === 'QUOTATION');
  const wsQuotations = wb.addWorksheet('Data_Quotations');
  wsQuotations.columns = [
    { header: 'Quotation Number', key: 'docNum', width: 18 },
    { header: 'Issue Date', key: 'date', width: 14 },
    { header: 'Valid Until', key: 'dueDate', width: 14 },
    { header: 'Client Name', key: 'client', width: 30 },
    { header: 'Client PIN', key: 'pin', width: 16 },
    { header: 'Subtotal (Ksh)', key: 'subtotal', width: 18 },
    { header: 'VAT 16% (Ksh)', key: 'vat', width: 16 },
    { header: 'Grand Total (Ksh)', key: 'total', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Drive PDF Link', key: 'driveUrl', width: 36 },
  ];
  styleHeaderRow(wsQuotations, fillCharcoal);
  quotations.forEach((doc) => {
    const row = wsQuotations.addRow({
      docNum: doc.documentNumber,
      date: doc.issueDate,
      dueDate: doc.dueDate || '',
      client: doc.clientName,
      pin: doc.clientKraPin || '',
      subtotal: doc.subtotal,
      vat: doc.vatAmount,
      total: doc.grandTotal,
      status: doc.status,
      driveUrl: doc.driveFileUrl || '',
    });
    [6, 7, 8].forEach((idx) => {
      row.getCell(idx).numFmt = formatCurrency;
    });
  });

  // D. Data_Proformas
  const proformas = documents.filter((d) => d.documentType === 'PROFORMA');
  const wsProformas = wb.addWorksheet('Data_Proformas');
  wsProformas.columns = [
    { header: 'Proforma Number', key: 'docNum', width: 18 },
    { header: 'Issue Date', key: 'date', width: 14 },
    { header: 'Client Name', key: 'client', width: 30 },
    { header: 'Client PIN', key: 'pin', width: 16 },
    { header: 'Grand Total (Ksh)', key: 'total', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Drive PDF Link', key: 'driveUrl', width: 36 },
  ];
  styleHeaderRow(wsProformas, fillCharcoal);
  proformas.forEach((doc) => {
    const row = wsProformas.addRow({
      docNum: doc.documentNumber,
      date: doc.issueDate,
      client: doc.clientName,
      pin: doc.clientKraPin || '',
      total: doc.grandTotal,
      status: doc.status,
      driveUrl: doc.driveFileUrl || '',
    });
    row.getCell(5).numFmt = formatCurrency;
  });

  // E. Data_Receipts
  const wsReceipts = wb.addWorksheet('Data_Receipts');
  wsReceipts.columns = [
    { header: 'Receipt Number', key: 'recNum', width: 18 },
    { header: 'Payment Date', key: 'date', width: 14 },
    { header: 'Client Name', key: 'client', width: 30 },
    { header: 'Document Ref', key: 'docRef', width: 18 },
    { header: 'Payment Mode', key: 'mode', width: 16 },
    { header: 'Reference Note', key: 'ref', width: 22 },
    { header: 'Amount Paid (Ksh)', key: 'amount', width: 18 },
    { header: 'Drive PDF Link', key: 'driveUrl', width: 36 },
  ];
  styleHeaderRow(wsReceipts, fillCharcoal);
  payments.forEach((pay) => {
    const row = wsReceipts.addRow({
      recNum: pay.receiptNumber,
      date: pay.date,
      client: pay.clientName,
      docRef: pay.documentNumber,
      mode: pay.paymentMode,
      ref: pay.referenceNote || 'N/A',
      amount: pay.amount,
      driveUrl: pay.driveFileUrl || '',
    });
    row.getCell(7).numFmt = formatCurrency;
  });

  // F. Data_Statements
  const wsStatements = wb.addWorksheet('Data_Statements');
  wsStatements.columns = [
    { header: 'Statement Number', key: 'soaNum', width: 18 },
    { header: 'Generated Date', key: 'date', width: 14 },
    { header: 'Client Name', key: 'client', width: 30 },
    { header: 'Period Start', key: 'start', width: 14 },
    { header: 'Period End', key: 'end', width: 14 },
    { header: 'Closing Balance (Ksh)', key: 'balance', width: 22 },
  ];
  styleHeaderRow(wsStatements, fillCharcoal);
  statements.forEach((st) => {
    const row = wsStatements.addRow({
      soaNum: st.statementNumber,
      date: st.issueDate,
      client: st.clientName,
      start: st.startDate,
      end: st.endDate,
      balance: st.closingBalance,
    });
    row.getCell(6).numFmt = formatCurrency;
  });

  // G. Data_Hotel_Settings
  const wsSettings = wb.addWorksheet('Data_Hotel_Settings');
  wsSettings.columns = [
    { header: 'Setting Key', key: 'key', width: 30 },
    { header: 'Setting Value', key: 'val', width: 50 },
    { header: 'Category', key: 'cat', width: 20 },
  ];
  styleHeaderRow(wsSettings, fillCharcoal);
  const settingsEntries = [
    { key: 'Hotel Name', val: profile.name || 'HOTEL DAMVIEW', cat: 'Identity' },
    { key: 'Tagline', val: profile.tagline || '', cat: 'Identity' },
    { key: 'Physical Address', val: profile.physicalLocation || 'MARIAKANI', cat: 'Contact' },
    { key: 'Postal Address', val: profile.postalAddress || 'P.O. BOX 42491-80100, Mombasa, Kenya', cat: 'Contact' },
    { key: 'Telephone', val: profile.phone || '+254 725 242 620', cat: 'Contact' },
    { key: 'Email', val: profile.email || 'hoteldamview@gmail.com', cat: 'Contact' },
    { key: 'KRA PIN', val: profile.kraPin || 'P051453023Q', cat: 'Taxation' },
    { key: 'Default VAT Rate (%)', val: (profile.vatRate || 16) + '%', cat: 'Taxation' },
    { key: 'M-Pesa Buy Goods Till', val: profile.mpesaTillNumber || '', cat: 'Payment' },
    { key: 'Bank Name', val: profile.bankName || '', cat: 'Payment' },
    { key: 'Bank Account Number', val: profile.accountNumber || '', cat: 'Payment' },
    { key: 'Bank Branch', val: profile.bankBranch || '', cat: 'Payment' },
    { key: 'Local Archive Directory', val: DEFAULT_ARCHIVE_PATH, cat: 'Filesystem' },
  ];
  settingsEntries.forEach((s) => wsSettings.addRow(s));

  // Write Excel buffer
  const rawBuffer = await wb.xlsx.writeBuffer();

  // Package into macro-enabled .xlsm using JSZip
  const zip = await JSZip.loadAsync(rawBuffer);
  let contentTypes = await zip.file('[Content_Types].xml')?.async('string');
  if (contentTypes) {
    contentTypes = contentTypes.replace(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
      'application/vnd.ms-excel.sheet.macroEnabled.main+xml'
    );
    zip.file('[Content_Types].xml', contentTypes);
  }

  const xlsmBuffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  });

  return xlsmBuffer;
}

/**
 * Builds standard pixel-accurate printable A4 template sheet
 */
function buildPrintableTemplateSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  docTitle: string,
  profile: HotelProfile,
  sampleNum: string,
  docNumLabel: string
) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  ws.columns = [
    { width: 8 },  // A
    { width: 34 }, // B
    { width: 10 }, // C
    { width: 10 }, // D
    { width: 16 }, // E
    { width: 18 }, // F
  ];

  const fontTimes11 = { name: 'Times New Roman', size: 11 };
  const fontTimes11Bold = { name: 'Times New Roman', size: 11, bold: true };
  const fontTimes12Bold = { name: 'Times New Roman', size: 12, bold: true };
  const fontTimes14Bold = { name: 'Times New Roman', size: 14, bold: true };
  const fontTimes16Bold = { name: 'Times New Roman', size: 16, bold: true };
  const fontTimes9Italic = { name: 'Times New Roman', size: 9, italic: true };
  const fontTimes9Bold = { name: 'Times New Roman', size: 9, bold: true };
  const fontTimes9 = { name: 'Times New Roman', size: 9 };

  const fillCharcoal: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1C1917' },
  };
  const fillSubtleGray: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F5F4' },
  };
  const borderHairline: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  };
  const borderDoubleBottom: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF18181B' } },
    bottom: { style: 'double', color: { argb: 'FF18181B' } },
    left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
    right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
  };
  const formatCurrency = '#,##0.00';

  // 1. Header Banner
  ws.mergeCells('A1:F1');
  const h1 = ws.getCell('A1');
  h1.value = profile.name || 'HOTEL DAMVIEW';
  h1.font = { ...fontTimes16Bold, color: { argb: 'FFFFFFFF' } };
  h1.fill = fillCharcoal;
  h1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.mergeCells('A2:F2');
  const h2 = ws.getCell('A2');
  const taglineDisplay = profile.tagline?.trim() ? `${profile.tagline.trim()} • ` : '';
  const phoneDisplay = profile.phone?.trim() ? profile.phone.trim() : '+254 725 242 620';
  const emailDisplay = profile.email?.trim() ? profile.email.trim() : 'hoteldamview@gmail.com';
  h2.value = `${taglineDisplay}${profile.physicalLocation || 'MARIAKANI'} | Phone: ${phoneDisplay} | Email: ${emailDisplay} | PIN: ${profile.kraPin || 'P051453023Q'}`;
  h2.font = fontTimes9Italic;
  h2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 16;

  // Document Title
  ws.mergeCells('A4:F4');
  const docTitleCell = ws.getCell('A4');
  docTitleCell.value = docTitle;
  docTitleCell.font = { ...fontTimes14Bold, color: { argb: 'FF1C1917' } };
  docTitleCell.fill = fillSubtleGray;
  docTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(4).height = 22;

  // 2. Borderless Side-by-Side Panels (Client Details & Document Details)
  // Left Panel: Client Details (Cols A to C)
  ws.mergeCells('A6:C6');
  ws.getCell('A6').value = 'CLIENT DETAILS';
  ws.getCell('A6').font = fontTimes9Bold;
  ws.getCell('A6').fill = fillSubtleGray;

  ws.getCell('A7').value = 'Client Name:';
  ws.getCell('A7').font = fontTimes11Bold;
  ws.mergeCells('B7:C7');
  ws.getCell('B7').value = 'County Government of Machakos';
  ws.getCell('B7').font = fontTimes11Bold;

  ws.getCell('A8').value = 'KRA PIN:';
  ws.getCell('A8').font = fontTimes11;
  ws.mergeCells('B8:C8');
  ws.getCell('B8').value = 'P051234567Z';
  ws.getCell('B8').font = fontTimes11;

  ws.getCell('A9').value = 'Telephone:';
  ws.getCell('A9').font = fontTimes11;
  ws.mergeCells('B9:C9');
  ws.getCell('B9').value = '+254 711 000 000';
  ws.getCell('B9').font = fontTimes11;

  ws.getCell('A10').value = 'Address:';
  ws.getCell('A10').font = fontTimes11;
  ws.mergeCells('B10:C10');
  ws.getCell('B10').value = 'Machakos Town, Kenya';
  ws.getCell('B10').font = fontTimes11;

  // Right Panel: Document Details (Cols D to F)
  ws.mergeCells('D6:F6');
  ws.getCell('D6').value = 'DOCUMENT DETAILS';
  ws.getCell('D6').font = fontTimes9Bold;
  ws.getCell('D6').fill = fillSubtleGray;

  ws.getCell('D7').value = docNumLabel;
  ws.getCell('D7').font = fontTimes11Bold;
  ws.mergeCells('E7:F7');
  ws.getCell('E7').value = sampleNum;
  ws.getCell('E7').font = { ...fontTimes11Bold, color: { argb: 'FFB45309' } };
  ws.getCell('E7').alignment = { horizontal: 'right' };

  ws.getCell('D8').value = 'Issue Date:';
  ws.getCell('D8').font = fontTimes11;
  ws.mergeCells('E8:F8');
  ws.getCell('E8').value = new Date().toISOString().split('T')[0];
  ws.getCell('E8').font = fontTimes11;
  ws.getCell('E8').alignment = { horizontal: 'right' };

  ws.getCell('D9').value = 'Due Date / Terms:';
  ws.getCell('D9').font = fontTimes11;
  ws.mergeCells('E9:F9');
  ws.getCell('E9').value = 'Net 30 Days';
  ws.getCell('E9').font = fontTimes11;
  ws.getCell('E9').alignment = { horizontal: 'right' };

  ws.getCell('D10').value = 'Status:';
  ws.getCell('D10').font = fontTimes11;
  ws.mergeCells('E10:F10');
  ws.getCell('E10').value = 'Draft';
  ws.getCell('E10').font = fontTimes11Bold;
  ws.getCell('E10').alignment = { horizontal: 'right' };

  // 3. Particulars Header
  const headers = ['Item #', 'Description / Particulars', 'Qty', 'Days', 'Rate (Ksh)', 'Amount (Ksh)'];
  headers.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const cell = ws.getCell(`${colLetter}12`);
    cell.value = h;
    cell.font = { ...fontTimes11Bold, color: { argb: 'FFFFFFFF' } };
    cell.fill = fillCharcoal;
    cell.alignment = {
      horizontal: idx === 1 ? 'left' : idx >= 4 ? 'right' : 'center',
      vertical: 'middle',
    };
    cell.border = borderHairline;
  });
  ws.getRow(12).height = 22;

  // 4. Line Items (Rows 13 to 24)
  const defaultItems = [
    { desc: 'Main Conference Hall Hire (Air Conditioned & Projector)', qty: 1, days: 2, rate: 30000 },
    { desc: 'Executive Buffet Lunch & Mineral Water', qty: 25, days: 2, rate: 2200 },
    { desc: 'Morning & Afternoon Herbal Teas with Pastries', qty: 25, days: 2, rate: 900 },
  ];

  for (let i = 0; i < 12; i++) {
    const rIdx = 13 + i;
    const it = defaultItems[i] || { desc: '', qty: 0, days: 1, rate: 0 };
    ws.getCell(`A${rIdx}`).value = i + 1;
    ws.getCell(`A${rIdx}`).alignment = { horizontal: 'center' };
    ws.getCell(`A${rIdx}`).font = fontTimes11;
    ws.getCell(`A${rIdx}`).border = borderHairline;

    ws.getCell(`B${rIdx}`).value = it.desc;
    ws.getCell(`B${rIdx}`).font = fontTimes11;
    ws.getCell(`B${rIdx}`).border = borderHairline;

    ws.getCell(`C${rIdx}`).value = it.qty;
    ws.getCell(`C${rIdx}`).alignment = { horizontal: 'center' };
    ws.getCell(`C${rIdx}`).font = fontTimes11;
    ws.getCell(`C${rIdx}`).border = borderHairline;

    ws.getCell(`D${rIdx}`).value = it.days;
    ws.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
    ws.getCell(`D${rIdx}`).font = fontTimes11;
    ws.getCell(`D${rIdx}`).border = borderHairline;

    ws.getCell(`E${rIdx}`).value = it.rate;
    ws.getCell(`E${rIdx}`).numFmt = formatCurrency;
    ws.getCell(`E${rIdx}`).font = fontTimes11;
    ws.getCell(`E${rIdx}`).border = borderHairline;

    ws.getCell(`F${rIdx}`).value = {
      formula: `IF(C${rIdx}>0, C${rIdx}*MAX(1,D${rIdx})*E${rIdx}, 0)`,
      result: it.qty * it.days * it.rate,
    };
    ws.getCell(`F${rIdx}`).numFmt = formatCurrency;
    ws.getCell(`F${rIdx}`).font = fontTimes11;
    ws.getCell(`F${rIdx}`).border = borderHairline;
    ws.getRow(rIdx).height = 18;
  }

  // 5. Left Payment Details & Right Financial Summary (Rows 26 to 30)
  // Left: Remittance
  ws.mergeCells('A26:C26');
  ws.getCell('A26').value = 'PAYMENT & REMITTANCE DETAILS';
  ws.getCell('A26').font = fontTimes9Bold;
  ws.getCell('A26').fill = fillSubtleGray;

  const hasBankDetails = Boolean(profile.bankName?.trim() && profile.accountNumber?.trim());
  const hasMpesa = Boolean(profile.mpesaTillNumber?.trim());

  ws.mergeCells('A27:C27');
  ws.getCell('A27').value = hasMpesa
    ? `• M-Pesa Buy Goods Till: ${profile.mpesaTillNumber?.trim()} (${profile.name || 'Hotel Damview'})`
    : `• Remittance payable to ${profile.name || 'Hotel Damview'}`;
  ws.getCell('A27').font = fontTimes9;

  ws.mergeCells('A28:C28');
  ws.getCell('A28').value = hasBankDetails
    ? `• Bank: ${profile.bankName.trim()} | Acc: ${profile.accountNumber.trim()}`
    : '';
  ws.getCell('A28').font = fontTimes9;

  ws.mergeCells('A29:C29');
  ws.getCell('A29').value = (hasBankDetails && profile.bankBranch?.trim())
    ? `• Branch: ${profile.bankBranch.trim()}`
    : '';
  ws.getCell('A29').font = fontTimes9;

  ws.mergeCells('A30:C30');
  ws.getCell('A30').value = `• Submit remittance slips to ${profile.email || 'hoteldamview@gmail.com'}`;
  ws.getCell('A30').font = fontTimes9Italic;

  // Right: Kenyan VAT 16% Financial Summary
  ws.mergeCells('D26:E26');
  ws.getCell('D26').value = 'Subtotal (Excl. VAT 16%):';
  ws.getCell('D26').font = fontTimes11;
  ws.getCell('F26').value = { formula: 'F28/1.16', result: 0 };
  ws.getCell('F26').numFmt = formatCurrency;
  ws.getCell('F26').font = fontTimes11;

  ws.mergeCells('D27:E27');
  ws.getCell('D27').value = 'VAT (16% Included):';
  ws.getCell('D27').font = fontTimes11;
  ws.getCell('F27').value = { formula: 'F28-F26', result: 0 };
  ws.getCell('F27').numFmt = formatCurrency;
  ws.getCell('F27').font = fontTimes11;

  ws.mergeCells('D28:E28');
  ws.getCell('D28').value = 'Grand Total (Ksh):';
  ws.getCell('D28').font = fontTimes12Bold;
  ws.getCell('F28').value = { formula: 'SUM(F13:F24)', result: 0 };
  ws.getCell('F28').numFmt = formatCurrency;
  ws.getCell('F28').font = fontTimes12Bold;
  ws.getCell('F28').border = borderDoubleBottom;

  ws.mergeCells('D29:E29');
  ws.getCell('D29').value = 'Amount Paid (Ksh):';
  ws.getCell('D29').font = fontTimes11;
  ws.getCell('F29').value = 0;
  ws.getCell('F29').numFmt = formatCurrency;
  ws.getCell('F29').font = fontTimes11;

  ws.mergeCells('D30:E30');
  ws.getCell('D30').value = 'Net Balance Due (Ksh):';
  ws.getCell('D30').font = { ...fontTimes12Bold, color: { argb: 'FFB91C1C' } };
  ws.getCell('F30').value = { formula: 'F28-F29', result: 0 };
  ws.getCell('F30').numFmt = formatCurrency;
  ws.getCell('F30').font = { ...fontTimes12Bold, color: { argb: 'FFB91C1C' } };
  ws.getCell('F30').border = borderDoubleBottom;

  // 6. Fixed-height 3-statement Terms & Conditions fallback block (Rows 32 to 35)
  ws.mergeCells('A32:F32');
  ws.getCell('A32').value = 'STANDARD TERMS & CONDITIONS';
  ws.getCell('A32').font = fontTimes9Bold;
  ws.getCell('A32').fill = fillSubtleGray;

  ws.mergeCells('A33:F33');
  ws.getCell('A33').value =
    '1. Payment is due strictly according to specified payment terms. Overdue accounts attract a 2% monthly interest.';
  ws.getCell('A33').font = fontTimes9Italic;

  ws.mergeCells('A34:F34');
  ws.getCell('A34').value =
    '2. All cheques payable to HOTEL DAMVIEW LTD. M-Pesa payments via Official Till Number 5432100 only.';
  ws.getCell('A34').font = fontTimes9Italic;

  ws.mergeCells('A35:F35');
  ws.getCell('A35').value =
    '3. Reservations and catering services once booked are subject to Hotel Damview operational cancellation guidelines.';
  ws.getCell('A35').font = fontTimes9Italic;

  // 7. Signature / Stamp Row (Rows 37 to 38)
  ws.mergeCells('A37:C37');
  ws.getCell('A37').value = 'Prepared By: Accounts / Finance';
  ws.getCell('A37').font = fontTimes9;

  ws.mergeCells('D37:F37');
  ws.getCell('D37').value = 'Authorized Signatory & Official Stamp: ______________________';
  ws.getCell('D37').font = fontTimes9;
  ws.getCell('D37').alignment = { horizontal: 'right' };
}

function styleHeaderRow(ws: ExcelJS.Worksheet, fill: ExcelJS.Fill) {
  const headerRow = ws.getRow(1);
  headerRow.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = fill;
  headerRow.height = 24;
  headerRow.alignment = { vertical: 'middle' };
}

/**
 * Saves workbook buffer to local archive directory via FileSystemDirectoryHandle or direct download
 */
export async function saveWorkbookToLocalArchive(
  buffer: Uint8Array,
  fileName = WORKBOOK_FILENAME
): Promise<{ success: boolean; method: 'fs_api' | 'download'; path?: string; message: string }> {
  // Check for saved File System Access API handle
  try {
    const handle = await getSavedDirectoryHandle();
    if (handle) {
      const hasPermission = await verifyDirectoryPermission(handle, true);
      if (hasPermission) {
        const fileHandle = await handle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const copyBuffer = new Uint8Array(buffer.byteLength);
        copyBuffer.set(buffer);
        await writable.write(copyBuffer.buffer);
        await writable.close();

        // Also save VBA macro file alongside
        try {
          const vbaHandle = await handle.getFileHandle(VBA_MODULE_FILENAME, { create: true });
          const vbaWritable = await vbaHandle.createWritable();
          await vbaWritable.write(getVbaModuleCode());
          await vbaWritable.close();
        } catch {}

        return {
          success: true,
          method: 'fs_api',
          path: `${DEFAULT_ARCHIVE_PATH}\\${fileName}`,
          message: `Directly synced and updated ${fileName} in your local archive directory.`,
        };
      }
    }
  } catch (err: any) {
    console.warn('File System Access write attempt failed:', err);
  }

  // Fallback to browser download
  triggerBrowserDownload(buffer, fileName, 'application/vnd.ms-excel.sheet.macroEnabled.main+xml');
  return {
    success: true,
    method: 'download',
    path: DEFAULT_ARCHIVE_PATH,
    message: `Downloaded ${fileName}. Move this file to ${DEFAULT_ARCHIVE_PATH}.`,
  };
}

/**
 * Triggers a browser file download
 */
export function triggerBrowserDownload(data: Uint8Array | string, fileName: string, mimeType: string) {
  let blob: Blob;
  if (typeof data === 'string') {
    blob = new Blob([data], { type: mimeType });
  } else {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    blob = new Blob([copy.buffer], { type: mimeType });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedWorkbookDoc {
  documentNumber: string;
  documentType: 'INVOICE' | 'QUOTATION' | 'PROFORMA';
  issueDate: string;
  dueDate?: string;
  clientName: string;
  clientKraPin?: string;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  amountPaid?: number;
  balanceDue?: number;
  status: DocumentStatus;
  terms?: string;
  notes?: string;
  lineItems?: any[];
}

export interface ParsedWorkbookResult {
  clients: Partial<Client>[];
  invoices: ParsedWorkbookDoc[];
  quotations: ParsedWorkbookDoc[];
  proformas: ParsedWorkbookDoc[];
  payments: Partial<PaymentRecord>[];
  editorDoc: ParsedWorkbookDoc | null;
}

/**
 * Bi-Directional Extraction: Parses modified .xlsm or .xlsx workbook and extracts ledger data
 */
export async function readMasterSuiteWorkbook(fileBuffer: ArrayBuffer): Promise<ParsedWorkbookResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBuffer);

  const result: ParsedWorkbookResult = {
    clients: [],
    invoices: [],
    quotations: [],
    proformas: [],
    payments: [],
    editorDoc: null,
  };

  // 1. Parse Data_Clients
  const wsClients = wb.getWorksheet('Data_Clients');
  if (wsClients) {
    wsClients.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const name = String(row.getCell(2).value || '').trim();
      if (!name) return;
      result.clients.push({
        id: String(row.getCell(1).value || `cli-${Date.now()}-${rowNumber}`),
        name,
        contactPerson: name,
        phone: String(row.getCell(3).value || ''),
        email: String(row.getCell(4).value || ''),
        kraPin: String(row.getCell(5).value || ''),
        address: String(row.getCell(6).value || ''),
      });
    });
  }

  // 2. Parse Data_Invoices
  const wsInvoices = wb.getWorksheet('Data_Invoices');
  if (wsInvoices) {
    wsInvoices.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const docNum = String(row.getCell(1).value || '').trim();
      const clientName = String(row.getCell(4).value || '').trim();
      if (!docNum || !clientName) return;
      result.invoices.push({
        documentNumber: docNum,
        documentType: 'INVOICE',
        issueDate: String(row.getCell(2).value || new Date().toISOString().split('T')[0]),
        dueDate: String(row.getCell(3).value || ''),
        clientName,
        clientKraPin: String(row.getCell(5).value || ''),
        subtotal: Number(row.getCell(6).value || 0),
        vatAmount: Number(row.getCell(7).value || 0),
        grandTotal: Number(row.getCell(8).value || 0),
        amountPaid: Number(row.getCell(9).value || 0),
        balanceDue: Number(row.getCell(10).value || 0),
        status: (String(row.getCell(11).value || 'Draft') as DocumentStatus),
        terms: row.getCell(12).value ? String(row.getCell(12).value) : '',
      });
    });
  }

  // 3. Parse Data_Quotations
  const wsQuotations = wb.getWorksheet('Data_Quotations');
  if (wsQuotations) {
    wsQuotations.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const docNum = String(row.getCell(1).value || '').trim();
      const clientName = String(row.getCell(4).value || '').trim();
      if (!docNum || !clientName) return;
      result.quotations.push({
        documentNumber: docNum,
        documentType: 'QUOTATION',
        issueDate: String(row.getCell(2).value || new Date().toISOString().split('T')[0]),
        dueDate: String(row.getCell(3).value || ''),
        clientName,
        clientKraPin: String(row.getCell(5).value || ''),
        subtotal: Number(row.getCell(6).value || 0),
        vatAmount: Number(row.getCell(7).value || 0),
        grandTotal: Number(row.getCell(8).value || 0),
        status: (String(row.getCell(9).value || 'Draft') as DocumentStatus),
      });
    });
  }

  // 4. Parse Data_Receipts
  const wsReceipts = wb.getWorksheet('Data_Receipts');
  if (wsReceipts) {
    wsReceipts.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const recNum = String(row.getCell(1).value || '').trim();
      const clientName = String(row.getCell(3).value || '').trim();
      if (!recNum || !clientName) return;
      result.payments.push({
        receiptNumber: recNum,
        date: String(row.getCell(2).value || new Date().toISOString().split('T')[0]),
        clientName,
        documentNumber: String(row.getCell(4).value || ''),
        paymentMode: 'M-Pesa',
        referenceNote: String(row.getCell(6).value || 'Excel Record'),
        amount: Number(row.getCell(7).value || 0),
      });
    });
  }

  // 5. Parse Doc_Editor active draft
  const wsEditor = wb.getWorksheet('Doc_Editor');
  if (wsEditor) {
    const rawType = String(wsEditor.getCell('C4').value || '').toUpperCase();
    let docType: 'INVOICE' | 'QUOTATION' | 'PROFORMA' = 'INVOICE';
    if (rawType.includes('QUOTATION')) docType = 'QUOTATION';
    else if (rawType.includes('PROFORMA')) docType = 'PROFORMA';

    const docNum = String(wsEditor.getCell('F4').value || '').trim();
    const clientName = String(wsEditor.getCell('C9').value || '').trim();
    if (docNum && clientName) {
      const lineItems: any[] = [];
      for (let r = 16; r <= 27; r++) {
        const desc = String(wsEditor.getCell(`B${r}`).value || '').trim();
        const qty = Number(wsEditor.getCell(`C${r}`).value || 0);
        const days = Number(wsEditor.getCell(`D${r}`).value || 1);
        const rate = Number(wsEditor.getCell(`E${r}`).value || 0);
        if (desc && qty > 0) {
          lineItems.push({
            id: `item-${r}`,
            particulars: desc,
            quantity: qty,
            days: days,
            rate: rate,
            amount: qty * days * rate,
          });
        }
      }

      if (lineItems.length > 0) {
        const grandTotal = Number(wsEditor.getCell('F30').value?.valueOf() || 0);
        result.editorDoc = {
          documentNumber: docNum,
          documentType: docType,
          issueDate: String(wsEditor.getCell('C5').value || new Date().toISOString().split('T')[0]),
          dueDate: String(wsEditor.getCell('F5').value || ''),
          clientName,
          clientKraPin: String(wsEditor.getCell('F9').value || ''),
          lineItems,
          subtotal: grandTotal / 1.16,
          vatAmount: grandTotal - grandTotal / 1.16,
          grandTotal,
          amountPaid: Number(wsEditor.getCell('F11').value || 0),
          balanceDue: grandTotal - Number(wsEditor.getCell('F11').value || 0),
          status: 'Draft',
          terms: wsEditor.getCell('C6').value ? String(wsEditor.getCell('C6').value) : '',
        };
      }
    }
  }

  return result;
}

/**
 * Reconciles and upserts parsed workbook data into IndexedDB and adds sync queue items
 */
export async function syncExcelChangesToLedger(extractedData: ParsedWorkbookResult) {
  const summary = {
    clientsCreated: 0,
    clientsUpdated: 0,
    documentsUpserted: 0,
    paymentsUpserted: 0,
  };

  // Upsert Clients
  const existingClients = await dbService.getClients();
  for (const c of extractedData.clients) {
    if (!c.name) continue;
    const match = existingClients.find(
      (ec) => ec.name.toLowerCase() === c.name!.toLowerCase() || (c.id && ec.id === c.id)
    );
    if (match) {
      await dbService.saveClient({
        ...match,
        phone: c.phone || match.phone,
        email: c.email || match.email,
        kraPin: c.kraPin || match.kraPin,
        address: c.address || match.address,
        updatedAt: new Date().toISOString(),
      });
      summary.clientsUpdated++;
    } else {
      await dbService.saveClient({
        id: c.id || `cli-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: c.name!,
        contactPerson: c.contactPerson || c.name!,
        phone: c.phone || '',
        email: c.email || '',
        kraPin: c.kraPin || '',
        address: c.address || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      summary.clientsCreated++;
    }
  }

  // Upsert Invoices, Quotations, Proformas
  const allDocsToProcess = [
    ...extractedData.invoices,
    ...extractedData.quotations,
    ...extractedData.proformas,
  ];
  if (extractedData.editorDoc) {
    allDocsToProcess.push(extractedData.editorDoc);
  }

  const existingDocs = await dbService.getDocuments();
  for (const doc of allDocsToProcess) {
    if (!doc.documentNumber || !doc.clientName) continue;
    const existing = existingDocs.find((d) => d.documentNumber === doc.documentNumber);
    const docToSave: BillingDocument = {
      id: existing?.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      documentNumber: doc.documentNumber,
      documentType: doc.documentType || 'INVOICE',
      issueDate: doc.issueDate || new Date().toISOString().split('T')[0],
      dueDate: doc.dueDate || '',
      validityDays: 30,
      clientId: existing?.clientId || `cli-${Date.now()}`,
      clientName: doc.clientName,
      clientPhone: existing?.clientPhone || '',
      clientEmail: existing?.clientEmail || '',
      clientKraPin: doc.clientKraPin || existing?.clientKraPin || '',
      clientAddress: existing?.clientAddress || '',
      lineItems: doc.lineItems && doc.lineItems.length > 0 ? (doc.lineItems as any) : existing?.lineItems || [
        {
          id: 'item-1',
          particulars: 'Imported from Excel Master Suite',
          quantity: 1,
          days: 1,
          rate: doc.grandTotal || 0,
          amount: doc.grandTotal || 0,
        },
      ],
      subtotal: doc.subtotal || (doc.grandTotal ? doc.grandTotal / 1.16 : 0),
      vatAmount: doc.vatAmount || (doc.grandTotal ? doc.grandTotal - doc.grandTotal / 1.16 : 0),
      grandTotal: doc.grandTotal || 0,
      amountPaid: doc.amountPaid || 0,
      balanceDue: doc.balanceDue ?? (doc.grandTotal || 0),
      status: doc.status || 'Draft',
      notes: doc.notes ? String(doc.notes) : (existing?.notes || ''),
      terms: doc.terms ? String(doc.terms) : (existing?.terms || ''),
      syncedToGoogle: false,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveDocument(docToSave);
    summary.documentsUpserted++;

    // Add to Google Sheets sync queue
    await dbService.addToSyncQueue({
      action: 'UPSERT_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: docToSave.id,
      payload: {
        action: 'UPSERT_DOCUMENT',
        document: docToSave,
      },
    });
  }

  // Upsert Payments
  const existingPayments = await dbService.getPayments();
  for (const pay of extractedData.payments) {
    if (!pay.receiptNumber || !pay.amount) continue;
    const existing = existingPayments.find((p) => p.receiptNumber === pay.receiptNumber);
    const payToSave: PaymentRecord = {
      id: existing?.id || `pay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      receiptNumber: pay.receiptNumber,
      documentId: existing?.documentId || '',
      documentNumber: pay.documentNumber || '',
      clientId: existing?.clientId || '',
      clientName: pay.clientName || 'Walk-in Client',
      amount: pay.amount,
      date: pay.date || new Date().toISOString().split('T')[0],
      paymentMode: (pay.paymentMode as any) || 'M-Pesa',
      referenceNote: pay.referenceNote || '',
      syncedToGoogle: false,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    await dbService.savePayment(payToSave);
    summary.paymentsUpserted++;

    await dbService.addToSyncQueue({
      action: 'RECORD_PAYMENT',
      entityType: 'PAYMENT',
      entityId: payToSave.id,
      payload: {
        action: 'RECORD_PAYMENT',
        payment: payToSave,
      },
    });
  }

  // Record audit log
  await dbService.recordAuditLog({
    entityType: 'SYSTEM',
    entityId: 'excel-reconciler',
    action: 'RECONCILE',
    details: `Reconciled from Excel Master Suite: ${summary.clientsCreated} clients created, ${summary.clientsUpdated} clients updated, ${summary.documentsUpserted} documents, ${summary.paymentsUpserted} payments queued for cloud sync.`,
  });

  return summary;
}

/**
 * Returns the complete, clean VBA module code (modHotelDamviewEngine.bas)
 */
export function getVbaModuleCode(): string {
  return `Attribute VB_Name = "modHotelDamviewEngine"
' =====================================================================================
' HOTEL DAMVIEW MANAGEMENT SUITE — KENYA
' Automated VBA Automation Engine & Document Publisher
' Target Archive: C:\\Users\\mercy\\OneDrive\\Documents\\Mikma & Hotel Damview\\Hotel Damview_Template Files\\Hotel Damview_Documents Templates\\Hotel Damview_Archives
' =====================================================================================
Option Explicit

Public Const DEFAULT_ARCHIVE_PATH As String = "C:\\Users\\mercy\\OneDrive\\Documents\\Mikma & Hotel Damview\\Hotel Damview_Template Files\\Hotel Damview_Documents Templates\\Hotel Damview_Archives"
Public Const HOTEL_PIN As String = "P051982741Z"
Public Const HOTEL_TILL As String = "5432100"

' -------------------------------------------------------------------------------------
' 1. SWITCH DOCUMENT MODE
' Reconfigures Doc_Editor layout, active prefixes, and default labels
' -------------------------------------------------------------------------------------
Public Sub SwitchDocumentMode(Optional ByVal docType As String = "")
    Dim wsEd As Worksheet
    Set wsEd = ThisWorkbook.Sheets("Doc_Editor")
    
    If docType = "" Then
        docType = wsEd.Range("C4").Value
    Else
        wsEd.Range("C4").Value = docType
    End If
    
    Dim prefix As String
    Dim nextSerial As Long
    Dim dataWsName As String
    
    Select Case UCase(Trim(docType))
        Case "QUOTATION"
            prefix = "QT-"
            dataWsName = "Data_Quotations"
            wsEd.Range("E5").Value = "Valid Until:"
            wsEd.Range("B6").Value = "Validity Period:"
            wsEd.Range("C6").Value = "30 Days from Issue"
        Case "PROFORMA INVOICE"
            prefix = "PI-"
            dataWsName = "Data_Proformas"
            wsEd.Range("E5").Value = "Valid Until:"
            wsEd.Range("B6").Value = "Payment Terms:"
            wsEd.Range("C6").Value = "100% Advance Payment"
        Case "PAYMENT RECEIPT"
            prefix = "REC-"
            dataWsName = "Data_Receipts"
            wsEd.Range("E5").Value = "Payment Mode:"
            wsEd.Range("B6").Value = "Transaction / M-Pesa Ref:"
            wsEd.Range("C6").Value = "M-Pesa Buy Goods 5432100"
        Case "STATEMENT"
            prefix = "SOA-"
            dataWsName = "Data_Statements"
            wsEd.Range("E5").Value = "Period End Date:"
            wsEd.Range("B6").Value = "Statement Terms:"
            wsEd.Range("C6").Value = "Immediate Settlement"
        Case Else ' TAX INVOICE
            prefix = "INV-"
            dataWsName = "Data_Invoices"
            wsEd.Range("E5").Value = "Due Date:"
            wsEd.Range("B6").Value = "Payment Terms:"
            wsEd.Range("C6").Value = "Net 30 Days"
    End Select
    
    ' Calculate Next Sequence Number
    nextSerial = GetNextSequentialNumber(dataWsName)
    Dim yearStr As String
    yearStr = CStr(Year(Date))
    wsEd.Range("F4").Value = prefix & yearStr & "-" & Format(nextSerial, "000")
    
    MsgBox "Document mode switched to: " & docType & vbCrLf & _
           "Assigned Number: " & wsEd.Range("F4").Value, vbInformation, "Hotel Damview Workstation"
End Sub

' -------------------------------------------------------------------------------------
' 2. POPULATE TEMPLATE FROM EDITOR
' Validates input and copies metadata & line items from Doc_Editor into target template
' -------------------------------------------------------------------------------------
Public Sub PopulateTemplateFromEditor()
    Dim wsEd As Worksheet
    Dim targetWsName As String
    Dim wsTgt As Worksheet
    Dim docType As String
    
    Set wsEd = ThisWorkbook.Sheets("Doc_Editor")
    docType = UCase(Trim(wsEd.Range("C4").Value))
    
    ' Determine Target Template Worksheet
    Select Case docType
        Case "QUOTATION"
            targetWsName = "Template_Quotation"
        Case "PROFORMA INVOICE"
            targetWsName = "Template_Proforma"
        Case "PAYMENT RECEIPT"
            targetWsName = "Template_Receipt"
        Case "STATEMENT"
            targetWsName = "Template_Statement"
        Case Else
            targetWsName = "Template_Invoice"
    End Select
    
    On Error Resume Next
    Set wsTgt = ThisWorkbook.Sheets(targetWsName)
    On Error GoTo 0
    
    If wsTgt Is Nothing Then
        MsgBox "Target template worksheet '" & targetWsName & "' not found.", vbCritical, "Error"
        Exit Sub
    End If
    
    ' Validate mandatory inputs
    Dim clientName As String
    clientName = Trim(wsEd.Range("C9").Value)
    If clientName = "" Then
        MsgBox "Please select or enter a valid Client Name in Cell C9.", vbExclamation, "Validation"
        wsEd.Activate
        wsEd.Range("C9").Select
        Exit Sub
    End If
    
    Dim hasItems As Boolean
    Dim r As Long
    hasItems = False
    For r = 16 To 27
        If Trim(wsEd.Range("B" & r).Value) <> "" And Val(wsEd.Range("C" & r).Value) > 0 Then
            hasItems = True
            Exit For
        End If
    Next r
    
    If Not hasItems Then
        MsgBox "Please enter at least one line item with description and quantity.", vbExclamation, "Validation"
        wsEd.Activate
        wsEd.Range("B16").Select
        Exit Sub
    End If
    
    Application.ScreenUpdating = False
    
    ' 1. Populate Client Details (Template row 7 to 10)
    wsTgt.Range("B7").Value = clientName
    wsTgt.Range("B8").Value = wsEd.Range("F9").Value ' KRA PIN
    wsTgt.Range("B9").Value = wsEd.Range("C10").Value ' Telephone
    wsTgt.Range("B10").Value = wsEd.Range("F10").Value ' Address
    
    ' 2. Populate Document Details (Template row 7 to 10 right panel)
    wsTgt.Range("E7").Value = wsEd.Range("F4").Value ' Doc Number
    wsTgt.Range("E8").Value = wsEd.Range("C5").Value ' Issue Date
    wsTgt.Range("E9").Value = wsEd.Range("F5").Value ' Due Date / Terms
    wsTgt.Range("E10").Value = wsEd.Range("F6").Value ' Status
    
    ' 3. Populate Line Items (Template rows 13 to 24)
    For r = 1 To 12
        Dim srcR As Long, tgtR As Long
        srcR = 15 + r
        tgtR = 12 + r
        
        wsTgt.Range("A" & tgtR).Value = r
        wsTgt.Range("B" & tgtR).Value = wsEd.Range("B" & srcR).Value
        wsTgt.Range("C" & tgtR).Value = wsEd.Range("C" & srcR).Value
        wsTgt.Range("D" & tgtR).Value = wsEd.Range("D" & srcR).Value
        wsTgt.Range("E" & tgtR).Value = wsEd.Range("E" & srcR).Value
    Next r
    
    ' 4. Populate Amount Paid if applicable
    wsTgt.Range("F29").Value = Val(wsEd.Range("F11").Value)
    
    ' Recalculate formulas
    wsTgt.Calculate
    
    Application.ScreenUpdating = True
    wsTgt.Activate
    wsTgt.Range("A1").Select
    
    MsgBox "Template '" & targetWsName & "' successfully populated from Editor." & vbCrLf & _
           "Document: " & wsEd.Range("F4").Value & " for " & clientName, vbInformation, "Populated"
End Sub

' -------------------------------------------------------------------------------------
' 3. GENERATE PDF FROM ACTIVE TEMPLATE
' Direct vector PDF export to the designated local archive path
' -------------------------------------------------------------------------------------
Public Sub GeneratePDFFromActiveTemplate()
    Dim ws As Worksheet
    Set ws = ActiveSheet
    
    ' Ensure user is on a template sheet
    If InStr(1, ws.Name, "Template_", vbTextCompare) = 0 Then
        Dim confirm As VbMsgBoxResult
        confirm = MsgBox("Active sheet '" & ws.Name & "' is not a standard template." & vbCrLf & _
                         "Do you want to switch to 'Template_Invoice' and export?", vbQuestion + vbYesNo, "Confirm Template")
        If confirm = vbYes Then
            Set ws = ThisWorkbook.Sheets("Template_Invoice")
            ws.Activate
        Else
            Exit Sub
        End If
    End If
    
    Dim docNumber As String
    docNumber = Trim(ws.Range("E7").Value)
    If docNumber = "" Then
        docNumber = "DAMVIEW_" & Format(Now, "YYYYMMDD_HHNNSS")
    End If
    
    ' Clean illegal filename characters
    docNumber = Replace(Replace(Replace(Replace(docNumber, "/", "-"), "\\", "-"), ":", "-"), "*", "-")
    
    ' Determine Archive Path
    Dim archivePath As String
    archivePath = GetConfiguredArchivePath()
    
    ' Ensure directory exists
    CreateFolderRecursive archivePath
    
    Dim pdfPath As String
    pdfPath = archivePath & "\\" & docNumber & ".pdf"
    
    On Error GoTo ExportErr
    Application.ScreenUpdating = False
    
    ' Setup Page for single-page A4
    With ws.PageSetup
        .PaperSize = xlPaperA4
        .Orientation = xlPortrait
        .FitToPagesWide = 1
        .FitToPagesTall = 1
        .Zoom = False
    End With
    
    ws.ExportAsFixedFormat Type:=xlTypePDF, _
        Filename:=pdfPath, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False, _
        OpenAfterPublish:=True
        
    Application.ScreenUpdating = True
    
    MsgBox "PDF Generated & Archived Successfully!" & vbCrLf & _
           "File: " & docNumber & ".pdf" & vbCrLf & _
           "Location: " & archivePath, vbInformation, "Hotel Damview Archive"
    Exit Sub
    
ExportErr:
    Application.ScreenUpdating = True
    MsgBox "Failed to export PDF: " & Err.Description & vbCrLf & _
           "Target Path: " & pdfPath, vbCritical, "PDF Export Error"
End Sub

' -------------------------------------------------------------------------------------
' 4. APPEND RECORD TO DATA SHEET
' Appends newly generated record to appropriate Data_* sheet, guarding against collisions
' -------------------------------------------------------------------------------------
Public Sub AppendRecordToDataSheet()
    Dim wsEd As Worksheet
    Set wsEd = ThisWorkbook.Sheets("Doc_Editor")
    
    Dim docType As String, docNum As String, clientName As String
    docType = UCase(Trim(wsEd.Range("C4").Value))
    docNum = Trim(wsEd.Range("F4").Value)
    clientName = Trim(wsEd.Range("C9").Value)
    
    If docNum = "" Or clientName = "" Then
        MsgBox "Document Number and Client Name are required.", vbExclamation, "Validation"
        Exit Sub
    End If
    
    Dim targetSheetName As String
    Select Case docType
        Case "QUOTATION"
            targetSheetName = "Data_Quotations"
        Case "PROFORMA INVOICE"
            targetSheetName = "Data_Proformas"
        Case "PAYMENT RECEIPT"
            targetSheetName = "Data_Receipts"
        Case "STATEMENT"
            targetSheetName = "Data_Statements"
        Case Else
            targetSheetName = "Data_Invoices"
    End Select
    
    Dim wsData As Worksheet
    Set wsData = ThisWorkbook.Sheets(targetSheetName)
    
    ' Check for duplicate document number
    Dim foundRow As Range
    Set foundRow = wsData.Columns(1).Find(What:=docNum, LookIn:=xlValues, LookAt:=xlWhole)
    
    Dim nextRow As Long
    If Not foundRow Is Nothing Then
        Dim resp As VbMsgBoxResult
        resp = MsgBox("Document '" & docNum & "' already exists on row " & foundRow.Row & "." & vbCrLf & _
                      "Do you want to overwrite this record?", vbQuestion + vbYesNo, "Duplicate Notice")
        If resp = vbYes Then
            nextRow = foundRow.Row
        Else
            Exit Sub
        End If
    Else
        nextRow = wsData.Cells(wsData.Rows.Count, 1).End(xlUp).Row + 1
    End If
    
    ' Write row fields
    Select Case targetSheetName
        Case "Data_Invoices"
            wsData.Cells(nextRow, 1).Value = docNum
            wsData.Cells(nextRow, 2).Value = wsEd.Range("C5").Value ' Date
            wsData.Cells(nextRow, 3).Value = wsEd.Range("F5").Value ' Due Date
            wsData.Cells(nextRow, 4).Value = clientName
            wsData.Cells(nextRow, 5).Value = wsEd.Range("F9").Value ' KRA PIN
            wsData.Cells(nextRow, 6).Value = wsEd.Range("F28").Value ' Subtotal
            wsData.Cells(nextRow, 7).Value = wsEd.Range("F29").Value ' VAT
            wsData.Cells(nextRow, 8).Value = wsEd.Range("F30").Value ' Total
            wsData.Cells(nextRow, 9).Value = wsEd.Range("F11").Value ' Paid
            wsData.Cells(nextRow, 10).Value = wsEd.Range("F32").Value ' Balance
            wsData.Cells(nextRow, 11).Value = wsEd.Range("F6").Value ' Status
            wsData.Cells(nextRow, 12).Value = wsEd.Range("C6").Value ' Terms
            
        Case "Data_Quotations"
            wsData.Cells(nextRow, 1).Value = docNum
            wsData.Cells(nextRow, 2).Value = wsEd.Range("C5").Value
            wsData.Cells(nextRow, 3).Value = wsEd.Range("F5").Value
            wsData.Cells(nextRow, 4).Value = clientName
            wsData.Cells(nextRow, 5).Value = wsEd.Range("F9").Value
            wsData.Cells(nextRow, 6).Value = wsEd.Range("F28").Value
            wsData.Cells(nextRow, 7).Value = wsEd.Range("F29").Value
            wsData.Cells(nextRow, 8).Value = wsEd.Range("F30").Value
            wsData.Cells(nextRow, 9).Value = wsEd.Range("F6").Value
            
        Case "Data_Receipts"
            wsData.Cells(nextRow, 1).Value = docNum
            wsData.Cells(nextRow, 2).Value = wsEd.Range("C5").Value
            wsData.Cells(nextRow, 3).Value = clientName
            wsData.Cells(nextRow, 4).Value = wsEd.Range("C6").Value
            wsData.Cells(nextRow, 5).Value = "M-PESA"
            wsData.Cells(nextRow, 6).Value = "TILL 5432100"
            wsData.Cells(nextRow, 7).Value = wsEd.Range("F30").Value
            wsData.Cells(nextRow, 8).Value = "Accounts"
    End Select
    
    MsgBox "Record saved to '" & targetSheetName & "' on row " & nextRow & ".", vbInformation, "Record Appended"
End Sub

' -------------------------------------------------------------------------------------
' HELPER ROUTINES
' -------------------------------------------------------------------------------------
Private Function GetNextSequentialNumber(ByVal sheetName As String) As Long
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(sheetName)
    If ws Is Nothing Then
        GetNextSequentialNumber = 1
        Exit Function
    End If
    
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If lastRow < 2 Then
        GetNextSequentialNumber = 1
    Else
        GetNextSequentialNumber = lastRow
    End If
End Function

Private Function GetConfiguredArchivePath() As String
    On Error Resume Next
    Dim wsSet As Worksheet
    Set wsSet = ThisWorkbook.Sheets("Data_Hotel_Settings")
    If Not wsSet Is Nothing Then
        Dim foundCell As Range
        Set foundCell = wsSet.Columns(1).Find(What:="Local Archive Directory", LookIn:=xlValues, LookAt:=xlWhole)
        If Not foundCell Is Nothing Then
            Dim customPath As String
            customPath = Trim(foundCell.Offset(0, 1).Value)
            If customPath <> "" Then
                GetConfiguredArchivePath = customPath
                Exit Function
            End If
        End If
    End If
    GetConfiguredArchivePath = DEFAULT_ARCHIVE_PATH
End Function

Private Sub CreateFolderRecursive(ByVal folderPath As String)
    On Error Resume Next
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If Not fso.FolderExists(folderPath) Then
        Dim parent As String
        parent = fso.GetParentFolderName(folderPath)
        If parent <> "" Then CreateFolderRecursive parent
        fso.CreateFolder folderPath
    End If
End Sub
`;
}
