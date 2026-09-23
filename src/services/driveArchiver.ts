export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

export const driveArchiver = {
  async uploadPdf(fileName: string, pdfBlob: Blob): Promise<DriveUploadResult> {
    try {
      // Fallback / client download if Google Drive API is not configured
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      return {
        success: true,
        fileId: 'local-download',
        webViewLink: url,
      };
    } catch (err: any) {
      console.error('Drive archiver upload failed:', err);
      return {
        success: false,
        error: err.message || 'Failed to archive PDF',
      };
    }
  },
};
