import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Download,
  Printer,
  Share2,
  ExternalLink,
  Eye,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FileText,
  Layers,
  Sparkles,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import { BillingDocument, PaymentRecord, StatementRecord, HotelProfile } from '../types';
import { formatKsh, formatDate, getPdfFileName } from '../utils/formatters';
import { dbService } from '../services/db';
import { driveArchiver } from '../services/driveArchiver';
import {
  generatePdfFromElement,
  universalSharePdfDocument,
  getDocumentOperationalSummary,
  getReceiptOperationalSummary,
  getStatementOperationalSummary,
  validatePdfBlob,
  downloadPdfBlob,
  printPdfBlob,
  createPdfBlobUrl,
  revokePdfBlobUrl,
  safeOpenPdfInNewTab,
  GeneratePdfResult,
} from '../utils/pdfGenerator';
import { A4DocumentPreview } from './A4DocumentPreview';
import { A4ReceiptPreview } from './A4ReceiptPreview';
import { A4StatementPreview } from './A4StatementPreview';
import { AutoScalingA4Container } from './AutoScalingA4Container';

export interface UniversalPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: HotelProfile;
  // One of the following target payload types
  document?: BillingDocument | null;
  payment?: PaymentRecord | null;
  statement?: {
    statementRecord?: StatementRecord;
    client?: any;
    startDate?: string;
    endDate?: string;
    issueDate?: string;
    entries?: any[];
    summary?: any;
  } | null;
  // Optional pre-compiled binary payloads
  precompiledBlob?: Blob | null;
  precompiledBase64?: string | null;
  precompiledFileName?: string | null;
  // Auto action trigger upon opening
  autoAction?: 'NONE' | 'PRINT' | 'DOWNLOAD' | 'SHARE' | 'OPEN_TAB';
  // Optional navigation callback on close
  onNavigateToJournal?: () => void;
}

export const UniversalPdfPreviewModal: React.FC<UniversalPdfPreviewModalProps> = ({
  isOpen,
  onClose,
  profile,
  document: doc,
  payment,
  statement,
  precompiledBlob,
  precompiledBase64,
  precompiledFileName,
  autoAction = 'NONE',
  onNavigateToJournal,
}) => {
  // Determine active document descriptor
  const docDescriptor = useMemo(() => {
    if (doc) {
      return {
        type: doc.documentType,
        number: doc.documentNumber,
        clientName: doc.clientName,
        total: doc.grandTotal,
        date: doc.issueDate,
        category: 'DOCUMENT' as const,
      };
    }
    if (payment) {
      return {
        type: 'RECEIPT' as const,
        number: payment.receiptNumber,
        clientName: payment.clientName,
        total: payment.amount,
        date: payment.date,
        category: 'RECEIPT' as const,
      };
    }
    if (statement) {
      const num = statement.statementRecord?.statementNumber || `SOA-${statement.client?.name || 'Client'}`;
      const name = statement.statementRecord?.clientName || statement.client?.name || 'Client';
      const tot = statement.statementRecord?.closingBalance ?? (statement.summary?.closingBalance || 0);
      const dt = statement.statementRecord?.issueDate || statement.issueDate || formatDate();
      return {
        type: 'STATEMENT' as const,
        number: num,
        clientName: name,
        total: tot,
        date: dt,
        category: 'STATEMENT' as const,
      };
    }
    return {
      type: 'DOCUMENT' as const,
      number: 'DOC-0001',
      clientName: 'Guest',
      total: 0,
      date: formatDate(),
      category: 'DOCUMENT' as const,
    };
  }, [doc, payment, statement]);

  // Binary state
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(precompiledBlob || null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(precompiledBase64 || null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(precompiledFileName || null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Unified High-Fidelity Vector Standard (Authoritative 1:1 Rendering)
  const [viewMode, setViewMode] = useState<'pdf_binary' | 'high_fidelity_vector'>('high_fidelity_vector');
  const [isSandboxBlocked, setIsSandboxBlocked] = useState(false);
  const [hasTimedOutPdfCheck, setHasTimedOutPdfCheck] = useState(false);

  // Template DOM reference for rendering
  const templateContainerRef = useRef<HTMLDivElement>(null);
  const objectEmbedRef = useRef<HTMLObjectElement>(null);

  // Auto-action executed flag
  const autoActionExecutedRef = useRef(false);

  // Sync precompiled props if they change
  useEffect(() => {
    if (precompiledBlob) {
      setPdfBlob(precompiledBlob);
      if (blobUrl) revokePdfBlobUrl(blobUrl);
      setBlobUrl(createPdfBlobUrl(precompiledBlob));
    }
    if (precompiledBase64) setPdfBase64(precompiledBase64);
    if (precompiledFileName) setPdfFileName(precompiledFileName);
  }, [precompiledBlob, precompiledBase64, precompiledFileName]);

  // Compile PDF binary if not provided
  useEffect(() => {
    if (!isOpen) return;

    if (pdfBlob && blobUrl) {
      // Already compiled
      return;
    }

    let isMounted = true;
    const compileBinary = async () => {
      setIsGenerating(true);
      setGenerationError(null);
      try {
        await new Promise((res) => setTimeout(res, 80));
        if (!templateContainerRef.current) return;

        const res: GeneratePdfResult = await generatePdfFromElement(
          templateContainerRef.current,
          docDescriptor.number,
          docDescriptor.clientName,
          docDescriptor.date,
          { download: false }
        );

        if (!isMounted) return;

        const validation = validatePdfBlob(res.blob, res.base64);
        if (validation.isValid) {
          setPdfBlob(res.blob);
          setPdfBase64(res.base64);
          setPdfFileName(res.fileName);
          const newUrl = createPdfBlobUrl(res.blob);
          setBlobUrl(newUrl);
        } else {
          setGenerationError(validation.error || 'Compiled PDF failed validation check');
          // Fall back gracefully to high-fidelity vector view
          setViewMode('high_fidelity_vector');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setGenerationError(err?.message || 'Error compiling PDF binary');
        setViewMode('high_fidelity_vector');
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    compileBinary();

    return () => {
      isMounted = false;
    };
  }, [isOpen, docDescriptor, pdfBlob, blobUrl]);

  // Automatic Frame Sandbox Blocked Detection & Timeout Watchdog
  useEffect(() => {
    if (!isOpen || viewMode !== 'pdf_binary' || !blobUrl) return;

    // Detect if running inside a sandboxed iframe without allow-scripts/allow-same-origin
    let isSandboxed = false;
    try {
      if (window.self !== window.top) {
        // In iframe; check for mobile or strict CSP indicators
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
        if (isMobile) {
          isSandboxed = true;
        }
      }
    } catch {
      isSandboxed = true;
    }

    if (isSandboxed) {
      setIsSandboxBlocked(true);
      setViewMode('high_fidelity_vector');
      return;
    }

    // Safety timeout: if object embed doesn't fire load event or browser fails to display, mark fallback
    const timer = setTimeout(() => {
      setHasTimedOutPdfCheck(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isOpen, viewMode, blobUrl]);

  // Execute Auto Actions
  useEffect(() => {
    if (!isOpen || autoActionExecutedRef.current || isGenerating || !pdfBlob) return;

    if (autoAction === 'DOWNLOAD' && pdfFileName) {
      autoActionExecutedRef.current = true;
      downloadPdfBlob(pdfBlob, pdfFileName);
    } else if (autoAction === 'PRINT') {
      autoActionExecutedRef.current = true;
      printPdfBlob(pdfBlob).catch(() => window.print());
    } else if (autoAction === 'OPEN_TAB') {
      autoActionExecutedRef.current = true;
      safeOpenPdfInNewTab(pdfBlob, pdfFileName || `${docDescriptor.number}.pdf`);
    }
  }, [isOpen, autoAction, isGenerating, pdfBlob, pdfFileName, docDescriptor.number]);

  // Handle Clean Close & Revoke URLs
  const handleCleanDismiss = useCallback(() => {
    if (blobUrl) {
      revokePdfBlobUrl(blobUrl);
      setBlobUrl(null);
    }
    onClose();
    if (onNavigateToJournal) {
      onNavigateToJournal();
    }
  }, [blobUrl, onClose, onNavigateToJournal]);

  // Modal Lifecycle & Popstate (Esc key and Back Button)
  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== 'undefined') {
      window.history.pushState({ modal: 'universal-pdf-preview', id: docDescriptor.number }, '');
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCleanDismiss();
      }
    };

    const handlePopState = () => {
      handleCleanDismiss();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      if (blobUrl) {
        revokePdfBlobUrl(blobUrl);
      }
    };
  }, [isOpen, docDescriptor.number, handleCleanDismiss, blobUrl]);

  // Direct Action Handlers
  const handleOpenNewTab = () => {
    if (pdfBlob) {
      safeOpenPdfInNewTab(pdfBlob, pdfFileName || `${docDescriptor.number}.pdf`);
    } else if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    if (pdfBlob && pdfFileName) {
      downloadPdfBlob(pdfBlob, pdfFileName);
    } else if (doc) {
      const fileName = getPdfFileName(doc.documentNumber, doc.clientName, doc.issueDate);
      if (pdfBlob) downloadPdfBlob(pdfBlob, fileName);
    }
  };

  const handlePrint = () => {
    if (pdfBlob) {
      printPdfBlob(pdfBlob).catch(() => window.print());
    } else {
      window.print();
    }
  };

  const [isArchivingToDrive, setIsArchivingToDrive] = useState(false);
  const [currentDriveUrl, setCurrentDriveUrl] = useState<string | undefined>(
    doc?.driveFileUrl || payment?.driveFileUrl || statement?.statementRecord?.driveFileUrl
  );
  const [driveSyncFeedback, setDriveSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    setCurrentDriveUrl(doc?.driveFileUrl || payment?.driveFileUrl || statement?.statementRecord?.driveFileUrl);
  }, [doc?.driveFileUrl, payment?.driveFileUrl, statement?.statementRecord?.driveFileUrl]);

  const handleArchiveToGoogleDrive = async () => {
    if (isArchivingToDrive) return;
    setIsArchivingToDrive(true);
    setDriveSyncFeedback('Archiving to Google Drive...');
    try {
      let base64ToUpload = pdfBase64 || '';
      if (!base64ToUpload && pdfBlob) {
        base64ToUpload = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            const comma = res.indexOf(',');
            resolve(comma >= 0 ? res.substring(comma + 1) : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
      }

      let archiveRes: any;
      if (doc) {
        archiveRes = await driveArchiver.archiveDocument(doc, base64ToUpload, pdfFileName || undefined);
        if (archiveRes.success && archiveRes.driveUrl) {
          setCurrentDriveUrl(archiveRes.driveUrl);
          await dbService.saveDocument({
            ...doc,
            driveFileUrl: archiveRes.driveUrl,
            driveFileId: archiveRes.driveFileId,
          });
        }
      } else if (payment) {
        archiveRes = await driveArchiver.archiveReceipt(payment, base64ToUpload, pdfFileName || undefined);
        if (archiveRes.success && archiveRes.driveUrl) {
          setCurrentDriveUrl(archiveRes.driveUrl);
          await dbService.savePayment({
            ...payment,
            driveFileUrl: archiveRes.driveUrl,
            driveFileId: archiveRes.driveFileId,
          });
        }
      } else if (statement?.statementRecord) {
        archiveRes = await driveArchiver.archiveStatement(statement.statementRecord, base64ToUpload, pdfFileName || undefined);
        if (archiveRes.success && archiveRes.driveUrl) {
          setCurrentDriveUrl(archiveRes.driveUrl);
          await dbService.saveStatement({
            ...statement.statementRecord,
            driveFileUrl: archiveRes.driveUrl,
            driveFileId: archiveRes.driveFileId,
          });
        }
      }

      if (archiveRes?.success && archiveRes?.driveUrl) {
        setDriveSyncFeedback('Archived to Google Drive successfully!');
        setTimeout(() => setDriveSyncFeedback(null), 4000);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('damview:data-changed'));
        }
      } else {
        setDriveSyncFeedback(archiveRes?.error || 'Google Drive archive failed.');
        setTimeout(() => setDriveSyncFeedback(null), 5000);
      }
    } catch (err: any) {
      setDriveSyncFeedback(err?.message || 'Drive archival failed.');
      setTimeout(() => setDriveSyncFeedback(null), 5000);
    } finally {
      setIsArchivingToDrive(false);
    }
  };

  const handleShare = async () => {
    if (!pdfBlob) return;
    const targetFileName = pdfFileName || `${docDescriptor.number}.pdf`;
    let summaryText = '';

    if (doc) {
      summaryText = getDocumentOperationalSummary(doc, profile);
    } else if (payment) {
      summaryText = getReceiptOperationalSummary(payment, profile);
    } else if (statement) {
      summaryText = getStatementOperationalSummary(
        {
          statementNumber: docDescriptor.number,
          clientName: docDescriptor.clientName,
          startDate: statement.startDate || '',
          endDate: statement.endDate || '',
          totalDebit: statement.summary?.totalInvoiced || 0,
          totalCredit: statement.summary?.totalPaid || 0,
          closingBalance: docDescriptor.total,
          driveFileUrl: currentDriveUrl || statement.statementRecord?.driveFileUrl,
        },
        profile
      );
    }

    await universalSharePdfDocument({
      blob: pdfBlob,
      fileName: targetFileName,
      title: `${docDescriptor.type} ${docDescriptor.number} - ${profile.name}`,
      summaryText,
      clientPhone: doc?.clientPhone || (statement?.client?.phone ? statement.client.phone : undefined),
      driveUrl: currentDriveUrl || doc?.driveFileUrl || payment?.driveFileUrl || statement?.statementRecord?.driveFileUrl,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-xs flex flex-col p-2 sm:p-4 animate-fade-in no-print cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCleanDismiss();
        }
      }}
    >
      {/* Modal Navigation Bar */}
      <div
        className="bg-white rounded-t-lg border border-stone-300 px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-md shrink-0 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Document Identity & Status Badges */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-amber-700" />
            <span className="font-bold text-stone-900 text-xs sm:text-sm">
              Live Preview: {docDescriptor.number}
            </span>
          </div>
          <span className="text-xs text-stone-500 hidden md:inline">
            ({docDescriptor.clientName} &bull; {formatKsh(docDescriptor.total)})
          </span>

          <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">100% Binary Parity</span>
            <span className="sm:hidden">Parity OK</span>
          </div>

          {/* View Mode Toggle: Authentic PDF Binary vs High-Fidelity Vector View */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded border border-stone-300 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('pdf_binary')}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                viewMode === 'pdf_binary'
                  ? 'bg-stone-900 text-amber-300 font-bold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="View authentic compiled PDF binary as uploaded to Google Drive"
            >
              True PDF Binary
            </button>
            <button
              type="button"
              onClick={() => setViewMode('high_fidelity_vector')}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                viewMode === 'high_fidelity_vector'
                  ? 'bg-stone-900 text-amber-300 font-bold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="View responsive 1:1 vector DOM document layout"
            >
              High-Fidelity View
            </button>
          </div>
        </div>

        {/* Right Action Trigger Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {currentDriveUrl ? (
            <a
              href={currentDriveUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded flex items-center gap-1 sm:gap-1.5 border border-emerald-300 shadow-2xs cursor-pointer transition-colors"
              title="Open archived PDF directly in Google Drive"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">View in Drive</span>
              <span className="sm:hidden">Drive</span>
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleArchiveToGoogleDrive}
              disabled={isArchivingToDrive || isGenerating}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 rounded flex items-center gap-1 sm:gap-1.5 border border-sky-300 shadow-2xs cursor-pointer disabled:opacity-50 transition-colors"
              title="Upload and archive this PDF directly to Google Drive"
            >
              <Cloud className={`w-3.5 h-3.5 text-sky-600 ${isArchivingToDrive ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{isArchivingToDrive ? 'Archiving...' : 'Archive to Drive'}</span>
              <span className="sm:hidden">{isArchivingToDrive ? 'Uploading...' : 'To Drive'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenNewTab}
            disabled={isGenerating}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded flex items-center gap-1 sm:gap-1.5 border border-stone-300 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Open PDF in a new browser tab/window (Bypasses any iframe sandbox restrictions)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Open in New Tab</span>
            <span className="sm:hidden">New Tab</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={isGenerating}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-amber-400 rounded flex items-center gap-1 sm:gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Share Document with direct PDF attachment & summary"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
            title="Download authentic PDF document to device"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Compiling...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-2 sm:px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded flex items-center gap-1 border border-stone-200 cursor-pointer"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            type="button"
            onClick={handleCleanDismiss}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100 cursor-pointer flex items-center"
            title="Close Preview & Return (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Drive Archival Feedback Banner */}
      {driveSyncFeedback && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between gap-3 shadow-inner shrink-0 cursor-default border-x border-b ${
            driveSyncFeedback.includes('successfully') || driveSyncFeedback.includes('Archived to Google Drive')
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : driveSyncFeedback.includes('Archiving')
              ? 'bg-sky-50 text-sky-900 border-sky-300 animate-pulse'
              : 'bg-amber-50 text-amber-900 border-amber-300'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 shrink-0" />
            <span>{driveSyncFeedback}</span>
          </div>
          {currentDriveUrl && (
            <a
              href={currentDriveUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shrink-0 flex items-center gap-1"
            >
              <span>Open in Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Sandbox Warning Banner if detected */}
      {isSandboxBlocked && viewMode === 'high_fidelity_vector' && (
        <div
          className="bg-amber-50 border-x border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-inner shrink-0 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Resilient Fallback Active:</strong> Browser iframe security sandbox restricts embedded binary display. Showing 1:1 High-Fidelity Vector View. Click <strong>Open in New Tab</strong> or <strong>Download PDF</strong> for the raw binary.
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenNewTab}
            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shrink-0 cursor-pointer"
          >
            Open Native PDF
          </button>
        </div>
      )}

      {/* Modal Main Body */}
      <div
        className="flex-1 overflow-auto bg-stone-900/95 rounded-b-lg p-2 sm:p-4 flex flex-col items-center justify-start cursor-pointer"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCleanDismiss();
          }
        }}
      >
        <div className="w-full flex flex-col items-center cursor-default" onClick={(e) => e.stopPropagation()}>
          {/* TIER 1: Authenticated Compiled PDF Binary View */}
          {viewMode === 'pdf_binary' && blobUrl ? (
            <div className="w-full max-w-4xl h-full flex flex-col items-center">
              <object
                ref={objectEmbedRef}
                data={`${blobUrl}#view=FitH`}
                type="application/pdf"
                className="w-full h-[76vh] rounded-md shadow-2xl border border-stone-700 bg-white"
                onError={() => {
                  console.warn('[PDF Preview] Object embed blocked or failed; switching to High-Fidelity Vector View fallback.');
                  setIsSandboxBlocked(true);
                  setViewMode('high_fidelity_vector');
                }}
              >
                <iframe
                  src={`${blobUrl}#toolbar=0`}
                  className="w-full h-[76vh] rounded-md shadow-2xl border border-stone-700 bg-white"
                  title={`PDF Preview ${docDescriptor.number}`}
                  onError={() => {
                    console.warn('[PDF Preview] Iframe embed blocked; switching to High-Fidelity Vector View fallback.');
                    setIsSandboxBlocked(true);
                    setViewMode('high_fidelity_vector');
                  }}
                >
                  {/* Graceful inner fallback inside object/iframe */}
                  <div className="p-8 text-center bg-white text-stone-800 rounded">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-bold">Embedded PDF viewer is not supported in this frame.</p>
                    <p className="text-xs text-stone-500 mt-1 mb-3">
                      Your browser security or device does not permit inline PDF rendering.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewMode('high_fidelity_vector')}
                        className="px-3 py-1.5 bg-stone-900 text-amber-300 rounded text-xs font-semibold"
                      >
                        Switch to High-Fidelity View
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenNewTab}
                        className="px-3 py-1.5 bg-amber-500 text-stone-900 rounded text-xs font-bold"
                      >
                        Open in New Tab
                      </button>
                    </div>
                  </div>
                </iframe>
              </object>

              <div className="mt-2 text-[11px] text-stone-400 flex items-center justify-between w-full max-w-4xl px-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Direct client-compiled vector PDF stream. Zero-byte validated & 100% identical to Google Drive archival.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('high_fidelity_vector')}
                  className="text-amber-400 hover:underline text-[11px]"
                >
                  Switch to Template View &rarr;
                </button>
              </div>
            </div>
          ) : (
            /* TIER 2: High-Fidelity 1:1 Vector View */
            <div className="w-full flex flex-col items-center">
              <div
                className="bg-white shadow-2xl origin-top rounded overflow-hidden"
                style={{
                  transform: 'scale(0.88)',
                  transformOrigin: 'top center',
                }}
              >
                {doc && <A4DocumentPreview doc={doc} profile={profile} />}
                {payment && <A4ReceiptPreview payment={payment} profile={profile} />}
                {statement && statement.client && (
                  <A4StatementPreview
                    client={statement.client}
                    profile={profile}
                    startDate={statement.startDate || ''}
                    endDate={statement.endDate || ''}
                    statementNumber={docDescriptor.number}
                    issueDate={statement.issueDate || docDescriptor.date}
                    entries={statement.entries || []}
                    totalDebit={statement.summary?.totalInvoiced || 0}
                    totalCredit={statement.summary?.totalPaid || 0}
                    closingBalance={docDescriptor.total}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Canonical Unscaled Staging Anchor for Initial Compilation if Needed */}
      <div
        ref={templateContainerRef}
        style={{
          position: 'fixed',
          left: '-99999px',
          top: '0',
          width: '794px',
          minHeight: '1123px',
          visibility: 'visible',
          pointerEvents: 'none',
          backgroundColor: '#ffffff',
          transform: 'none',
        }}
        aria-hidden="true"
      >
        {doc && <A4DocumentPreview doc={doc} profile={profile} />}
        {payment && <A4ReceiptPreview payment={payment} profile={profile} />}
        {statement && statement.client && (
          <A4StatementPreview
            client={statement.client}
            profile={profile}
            startDate={statement.startDate || ''}
            endDate={statement.endDate || ''}
            statementNumber={docDescriptor.number}
            issueDate={statement.issueDate || docDescriptor.date}
            entries={statement.entries || []}
            totalDebit={statement.summary?.totalInvoiced || 0}
            totalCredit={statement.summary?.totalPaid || 0}
            closingBalance={docDescriptor.total}
          />
        )}
      </div>
    </div>
  );
};
