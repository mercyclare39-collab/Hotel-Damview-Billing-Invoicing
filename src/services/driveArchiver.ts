import { dbService } from './db';
import { syncManager } from './sync';
import { BillingDocument, PaymentRecord, StatementRecord } from '../types';

export interface ArchiverResult {
  success: boolean;
  driveUrl?: string;
  driveFileId?: string;
  fileName?: string;
  byteLength?: number;
  uploadVerified?: boolean;
  error?: string;
  message?: string;
}

/**
 * Enterprise Google Drive Archiver Engine
 * Handles PDF cloud archiving, base64 binary streaming, deduplication & local directory mirroring
 */
export class DriveArchiver {
  /**
   * Universal PDF base64 archiving to Google Drive
   */
  static async archivePdf(
    pdfBase64: string,
    fileName: string,
    folderName?: string
  ): Promise<ArchiverResult> {
    const profile = await dbService.getHotelProfile();
    const targetFolder = folderName || profile.googleDriveFolder || 'Hotel Damview Archives';

    // Clean and validate Base64 stream
    let cleanBase64 = String(pdfBase64 || '').trim();
    const commaIdx = cleanBase64.indexOf(',');
    if (cleanBase64.startsWith('data:') && commaIdx >= 0) {
      cleanBase64 = cleanBase64.substring(commaIdx + 1).trim();
    }

    if (!cleanBase64 || cleanBase64.length < 500) {
      return {
        success: false,
        error: 'Corrupt or truncated PDF binary stream (base64 length undersized).',
      };
    }

    // Call central sync manager to execute Google Apps Script ARCHIVE_PDF action
    const response = await syncManager.uploadPdfToDrive({
      folderName: targetFolder,
      fileName,
      pdfBase64: cleanBase64,
    });

    if (response.success && response.driveUrl) {
      return {
        success: true,
        driveUrl: response.driveUrl,
        driveFileId: response.driveFileId,
        fileName: response.fileName || fileName,
        byteLength: response.byteLength,
        uploadVerified: true,
        message: `Successfully archived "${fileName}" to Google Drive folder "${targetFolder}".`,
      };
    }

    return {
      success: false,
      error: response.error || 'Google Drive cloud archiving failed.',
    };
  }

  /**
   * Archive Billing Document (Invoice, Quotation, Proforma) PDF to Google Drive
   */
  static async archiveDocument(
    doc: BillingDocument,
    pdfBase64?: string,
    customFileName?: string
  ): Promise<ArchiverResult> {
    const canonicalName =
      customFileName ||
      `${doc.documentNumber}_${(doc.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}_${doc.issueDate}.pdf`;

    return syncManager.archiveDocumentPdf(doc, pdfBase64, canonicalName);
  }

  /**
   * Archive Payment Receipt PDF to Google Drive
   */
  static async archiveReceipt(
    payment: PaymentRecord,
    pdfBase64?: string,
    customFileName?: string
  ): Promise<ArchiverResult> {
    const canonicalName =
      customFileName ||
      `REC_${payment.receiptNumber}_${(payment.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}_${payment.date}.pdf`;

    return syncManager.archiveReceiptPdf(payment, pdfBase64, canonicalName);
  }

  /**
   * Archive Statement of Account PDF to Google Drive
   */
  static async archiveStatement(
    statement: StatementRecord,
    pdfBase64?: string,
    customFileName?: string
  ): Promise<ArchiverResult> {
    const canonicalName =
      customFileName ||
      `${statement.statementNumber}_${(statement.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}_${statement.issueDate}.pdf`;

    return syncManager.archiveStatementPdf(statement, pdfBase64, canonicalName);
  }

  /**
   * Save PDF binary blob directly to user's local Windows/OneDrive directory via File System Access API
   */
  static async saveToLocalDirectory(
    blob: Blob,
    fileName: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check for browser File System Access API support
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'PDF Document',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return {
          success: true,
          message: `File "${fileName}" saved directly to selected local directory.`,
        };
      }

      // Browser download fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return {
        success: true,
        message: `File "${fileName}" downloaded via browser download fallback.`,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Local save cancelled by user.' };
      }
      return { success: false, message: err.message || 'Failed to save local file.' };
    }
  }
}

export const driveArchiver = DriveArchiver;
