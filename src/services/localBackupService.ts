/**
 * Hotel Damview Local Machine Filesystem Backup Service
 * 
 * Provides persistent local filesystem archiving targeted at the designated directory:
 * "C:\Users\mercy\OneDrive\Documents\Mikma & Hotel Damview\Hotel Damview_Template Files\Hotel Damview_Documents Templates\Hotel Damview_Archives"
 * 
 * Uses the modern File System Access API (window.showDirectoryPicker) with IndexedDB
 * handle persistence, automatic silent writes, pre-flight validation, and robust fallback.
 */

export const DEFAULT_DESIGNATED_ARCHIVE_PATH =
  'C:\\Users\\mercy\\OneDrive\\Documents\\Mikma & Hotel Damview\\Hotel Damview_Template Files\\Hotel Damview_Documents Templates\\Hotel Damview_Archives';

const FS_DB_NAME = 'HotelDamview_LocalFS_DB';
const FS_STORE_NAME = 'fs_handles';
const FS_HANDLE_KEY = 'primary_archive_directory_handle';
const TARGET_PATH_KEY = 'damview_designated_archive_path';
const BACKUP_HISTORY_KEY = 'damview_local_backup_history';

export interface LocalBackupRecord {
  id: string;
  fileName: string;
  documentNumber?: string;
  byteLength: number;
  timestamp: string;
  method: 'FILE_SYSTEM_ACCESS_API' | 'BROWSER_DOWNLOAD_FALLBACK';
  status: 'SUCCESS' | 'FAILED';
  path: string;
  error?: string;
}

export interface SaveLocalResult {
  success: boolean;
  method: 'FILE_SYSTEM_ACCESS_API' | 'BROWSER_DOWNLOAD_FALLBACK';
  fileName: string;
  path: string;
  byteLength: number;
  error?: string;
}

class LocalBackupService {
  private cachedHandle: any = null;

  /**
   * Check if the native File System Access API is supported and allowed in the current window context.
   */
  isFileSystemAccessSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasApi = 'showDirectoryPicker' in window;
    // Cross-origin iframes block showDirectoryPicker for browser security
    const isTopWindow = window.self === window.top;
    return hasApi && isTopWindow;
  }

  /**
   * Check if the current context is inside an embedded preview iframe.
   */
  isInEmbeddedFrame(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  /**
   * Get the designated target filesystem path string (for UI display and reference).
   */
  getTargetDirectoryPath(): string {
    if (typeof window === 'undefined') return DEFAULT_DESIGNATED_ARCHIVE_PATH;
    return localStorage.getItem(TARGET_PATH_KEY) || DEFAULT_DESIGNATED_ARCHIVE_PATH;
  }

  /**
   * Set or update the designated target filesystem path string.
   */
  setTargetDirectoryPath(path: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TARGET_PATH_KEY, path.trim());
  }

  /**
   * Open the IndexedDB store dedicated to storing the serialized FileSystemDirectoryHandle.
   */
  private async openFsDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FS_DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(FS_STORE_NAME)) {
          db.createObjectStore(FS_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve the stored directory handle from IndexedDB.
   */
  async getStoredDirectoryHandle(): Promise<any | null> {
    if (this.cachedHandle) return this.cachedHandle;
    if (!this.isFileSystemAccessSupported()) return null;

    try {
      const db = await this.openFsDB();
      return new Promise((resolve) => {
        const tx = db.transaction(FS_STORE_NAME, 'readonly');
        const store = tx.objectStore(FS_STORE_NAME);
        const request = store.get(FS_HANDLE_KEY);
        request.onsuccess = () => {
          if (request.result) {
            this.cachedHandle = request.result;
            resolve(request.result);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Store directory handle in IndexedDB for persistent future sessions.
   */
  private async persistDirectoryHandle(handle: any): Promise<void> {
    this.cachedHandle = handle;
    try {
      const db = await this.openFsDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(FS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(FS_STORE_NAME);
        const req = store.put(handle, FS_HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Could not persist FileSystemDirectoryHandle to IndexedDB:', err);
    }
  }

  /**
   * Verify and request readwrite permission on a directory handle.
   */
  async verifyPermission(handle: any, readWrite = true): Promise<boolean> {
    if (!handle) return false;
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }

    try {
      // Check if permission was already granted
      if ((await handle.queryPermission(options)) === 'granted') {
        return true;
      }
      // Request permission if not yet granted
      if ((await handle.requestPermission(options)) === 'granted') {
        return true;
      }
    } catch (err) {
      console.warn('Directory permission query error:', err);
    }
    return false;
  }

  /**
   * Prompt user to select their local archive directory (targeting Hotel Damview Archives).
   * Saves the granted handle into IndexedDB for persistent background backups.
   */
  async pickArchiveDirectory(): Promise<{ success: boolean; directoryName?: string; error?: string }> {
    if (this.isInEmbeddedFrame()) {
      return {
        success: false,
        error: 'Browser Security Note: Direct folder picking is restricted inside embedded preview frames. Generated PDFs automatically save via seamless browser download to your designated folder ("Hotel Damview Archives"). When opened in a top-level tab, direct folder handle connection is active.',
      };
    }

    if (!('showDirectoryPicker' in window)) {
      return {
        success: false,
        error: 'File System Access API is not supported in this browser. Fallback automatic download mode is active.',
      };
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        id: 'hotelDamviewArchives',
        mode: 'readwrite',
        startIn: 'documents',
      });

      const hasPermission = await this.verifyPermission(handle, true);
      if (!hasPermission) {
        return { success: false, error: 'Write permission was not granted by the user.' };
      }

      await this.persistDirectoryHandle(handle);
      return { success: true, directoryName: handle.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Directory selection cancelled.' };
      }
      if (err.name === 'SecurityError' || (err.message && (err.message.includes('sub frame') || err.message.includes('Cross origin')))) {
        return {
          success: false,
          error: 'Browser Security Note: Direct file picker is restricted inside embedded preview frames. PDFs automatically save via standard browser download.',
        };
      }
      return { success: false, error: err.message || 'Failed to select archive directory.' };
    }
  }

  /**
   * Disconnect or remove the stored directory handle.
   */
  async clearStoredDirectory(): Promise<void> {
    this.cachedHandle = null;
    try {
      const db = await this.openFsDB();
      const tx = db.transaction(FS_STORE_NAME, 'readwrite');
      tx.objectStore(FS_STORE_NAME).delete(FS_HANDLE_KEY);
    } catch (err) {
      console.warn('Error clearing directory handle:', err);
    }
  }

  /**
   * Trigger the browser download fallback when native filesystem access is unavailable.
   */
  private triggerDownloadFallback(blob: Blob, fileName: string): SaveLocalResult {
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }, 1000);

      this.recordBackup({
        fileName,
        byteLength: blob.size,
        method: 'BROWSER_DOWNLOAD_FALLBACK',
        status: 'SUCCESS',
        path: 'Browser Downloads / User Destination',
      });

      return {
        success: true,
        method: 'BROWSER_DOWNLOAD_FALLBACK',
        fileName,
        path: 'Browser Downloads / User Destination',
        byteLength: blob.size,
      };
    } catch (err: any) {
      this.recordBackup({
        fileName,
        byteLength: blob.size,
        method: 'BROWSER_DOWNLOAD_FALLBACK',
        status: 'FAILED',
        path: 'Browser Downloads',
        error: err.message,
      });

      return {
        success: false,
        method: 'BROWSER_DOWNLOAD_FALLBACK',
        fileName,
        path: 'Browser Downloads',
        byteLength: blob.size,
        error: err.message,
      };
    }
  }

  /**
   * Save a rendered PDF blob directly to the designated local archive folder.
   * If native FileSystemDirectoryHandle is available and granted, writes silently.
   * Otherwise, seamlessly triggers the download fallback.
   */
  async savePdfToLocalArchive(
    blob: Blob,
    fileName: string,
    options?: { forceFallback?: boolean; documentNumber?: string }
  ): Promise<SaveLocalResult> {
    const designatedPath = this.getTargetDirectoryPath();

    if (options?.forceFallback || !this.isFileSystemAccessSupported()) {
      return this.triggerDownloadFallback(blob, fileName);
    }

    try {
      const dirHandle = await this.getStoredDirectoryHandle();

      if (dirHandle) {
        // Check permission without blocking if already granted
        const hasPerm = await this.verifyPermission(dirHandle, true);
        if (hasPerm) {
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          const record: LocalBackupRecord = {
            id: `bk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            fileName,
            documentNumber: options?.documentNumber,
            byteLength: blob.size,
            timestamp: new Date().toISOString(),
            method: 'FILE_SYSTEM_ACCESS_API',
            status: 'SUCCESS',
            path: `${designatedPath}\\${fileName}`,
          };
          this.recordBackup(record);

          return {
            success: true,
            method: 'FILE_SYSTEM_ACCESS_API',
            fileName,
            path: `${designatedPath}\\${fileName}`,
            byteLength: blob.size,
          };
        }
      }

      // If no directory handle has been picked yet, use the graceful download fallback
      return this.triggerDownloadFallback(blob, fileName);
    } catch (err: any) {
      console.warn('Native local archive write encountered an error, triggering fallback:', err);
      return this.triggerDownloadFallback(blob, fileName);
    }
  }

  /**
   * Save a JSON state record directly to the local archive folder (silent background mirror).
   */
  async saveStateRecordToLocalArchive(
    data: any,
    fileName: string,
    options?: { documentNumber?: string }
  ): Promise<SaveLocalResult> {
    const designatedPath = this.getTargetDirectoryPath();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    if (!this.isFileSystemAccessSupported()) {
      return {
        success: false,
        method: 'BROWSER_DOWNLOAD_FALLBACK',
        fileName,
        path: designatedPath,
        byteLength: blob.size,
        error: 'File System Access API not available for silent JSON state recording.',
      };
    }

    try {
      const dirHandle = await this.getStoredDirectoryHandle();
      if (dirHandle) {
        const hasPerm = await this.verifyPermission(dirHandle, true);
        if (hasPerm) {
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          const record: LocalBackupRecord = {
            id: `bk-json-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            fileName,
            documentNumber: options?.documentNumber,
            byteLength: blob.size,
            timestamp: new Date().toISOString(),
            method: 'FILE_SYSTEM_ACCESS_API',
            status: 'SUCCESS',
            path: `${designatedPath}\\${fileName}`,
          };
          this.recordBackup(record);

          return {
            success: true,
            method: 'FILE_SYSTEM_ACCESS_API',
            fileName,
            path: `${designatedPath}\\${fileName}`,
            byteLength: blob.size,
          };
        }
      }

      return {
        success: false,
        method: 'FILE_SYSTEM_ACCESS_API',
        fileName,
        path: designatedPath,
        byteLength: blob.size,
        error: 'Local archive directory handle not initialized.',
      };
    } catch (err: any) {
      return {
        success: false,
        method: 'FILE_SYSTEM_ACCESS_API',
        fileName,
        path: designatedPath,
        byteLength: blob.size,
        error: err?.message || 'Failed saving JSON record',
      };
    }
  }

  /**
   * Auto-mirror a complete document and its rendered PDF blob directly to the local archive
   */
  async mirrorDocumentDualLocalBackup(
    pdfBlob: Blob | undefined,
    pdfFileName: string,
    documentPayload: any,
    documentNumber: string
  ): Promise<{ pdfResult?: SaveLocalResult; jsonResult?: SaveLocalResult }> {
    const results: { pdfResult?: SaveLocalResult; jsonResult?: SaveLocalResult } = {};
    const sanitizedNumber = documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const jsonFileName = `${sanitizedNumber}_StateRecord.json`;

    // 1. Mirror JSON State Record
    try {
      results.jsonResult = await this.saveStateRecordToLocalArchive(
        documentPayload,
        jsonFileName,
        { documentNumber }
      );
    } catch (e) {
      console.warn('Silent local state backup warning:', e);
    }

    // 2. Mirror PDF if blob available
    if (pdfBlob) {
      try {
        results.pdfResult = await this.savePdfToLocalArchive(pdfBlob, pdfFileName, {
          documentNumber,
        });
      } catch (e) {
        console.warn('Local PDF archival warning:', e);
      }
    }

    return results;
  }

  /**
   * Record backup activity in history store (localStorage).
   */
  private recordBackup(record: Omit<LocalBackupRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): void {
    if (typeof window === 'undefined') return;
    try {
      const existingStr = localStorage.getItem(BACKUP_HISTORY_KEY);
      const history: LocalBackupRecord[] = existingStr ? JSON.parse(existingStr) : [];
      const completeRecord: LocalBackupRecord = {
        id: record.id || `bk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        fileName: record.fileName,
        documentNumber: record.documentNumber,
        byteLength: record.byteLength,
        timestamp: record.timestamp || new Date().toISOString(),
        method: record.method,
        status: record.status,
        path: record.path,
        error: record.error,
      };

      // Keep latest 100 records
      const updated = [completeRecord, ...history].slice(0, 100);
      localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Could not record backup history:', err);
    }
  }

  /**
   * Retrieve recent backup history log.
   */
  getBackupHistory(): LocalBackupRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear backup history log.
   */
  clearBackupHistory(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(BACKUP_HISTORY_KEY);
  }
}

export const localBackupService = new LocalBackupService();
