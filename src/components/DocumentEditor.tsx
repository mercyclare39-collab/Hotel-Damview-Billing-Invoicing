import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Printer,
  Download,
  Share2,
  Eye,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  RotateCcw,
  X,
  ChevronRight,
  HelpCircle,
  Users,
  ShieldCheck,
  Lock,
  Unlock,
  Edit3,
  ChevronUp,
  ChevronDown,
  Columns,
  Rows,
} from 'lucide-react';
import { BillingDocument, DocumentType, LineItem, Client, HotelProfile } from '../types';
import { ClientModal } from './ClientModal';
import {
  calculateLineItemAmount,
  calculateTotals,
  calculateDueDate,
  formatDate,
  formatKsh,
  getPdfFileName,
  normalizeLineItemParticulars,
  normalizeKenyanPhone,
  validateKraPin,
  parseCurrencyInput,
} from '../utils/formatters';
import { generatePdfFromElement, shareDocumentPdf, validatePdfBlob } from '../utils/pdfGenerator';
import { dbService } from '../services/db';
import { syncManager } from '../services/sync';
import { localBackupService } from '../services/localBackupService';
import { A4DocumentPreview } from './A4DocumentPreview';
import { AutoScalingA4Container } from './AutoScalingA4Container';

interface DocumentEditorProps {
  initialDocument?: BillingDocument | null;
  defaultType: DocumentType;
  clients: Client[];
  profile: HotelProfile;
  existingDocuments?: BillingDocument[];
  onSave: (doc: BillingDocument) => void;
  onCancel: () => void;
  onConvert?: (sourceDoc: BillingDocument, targetType: DocumentType) => void;
  onAddNewClient?: () => void;
}

const HOSPITALITY_PRESETS = [
  { particulars: 'Executive Boardroom Conference Hire (Full Day with PA & Smart TV)', qty: 1, days: 1, rate: 20000 },
  { particulars: 'Full Day Delegate Package (Buffet Lunch, 2x Tea/Coffee & Pastries)', qty: 25, days: 1, rate: 2800 },
  { particulars: 'Half Day Delegate Package (Buffet Lunch & 1x Tea/Coffee Break)', qty: 20, days: 1, rate: 2200 },
  { particulars: 'Deluxe Lake View Suite (Bed & Breakfast, Single Occupancy)', qty: 1, days: 2, rate: 8500 },
  { particulars: 'Standard Room Accommodation (Bed & Breakfast)', qty: 1, days: 1, rate: 5500 },
  { particulars: 'Damview Gardens Grounds Hire for Team Building / Photo Shoot', qty: 1, days: 1, rate: 30000 },
  { particulars: 'Maruba Dam Boat Ride & Nature Walk Facilitation', qty: 15, days: 1, rate: 800 },
  { particulars: 'Barbecue Dinner Buffet with Live Station (Per Person)', qty: 30, days: 1, rate: 2500 },
];

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  initialDocument,
  defaultType,
  clients,
  profile,
  existingDocuments,
  onSave,
  onCancel,
  onConvert,
  onAddNewClient,
}) => {
  const [docType, setDocType] = useState<DocumentType>(initialDocument?.documentType || defaultType);

  // Auto-focus primary input on mount
  const primaryInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      primaryInputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  // Loaded documents for uniqueness validation
  const [localDocs, setLocalDocs] = useState<BillingDocument[]>(existingDocuments || []);

  useEffect(() => {
    if (!existingDocuments || existingDocuments.length === 0) {
      dbService.getDocuments().then((docs) => setLocalDocs(docs));
    } else {
      setLocalDocs(existingDocuments);
    }
  }, [existingDocuments]);

  // Prefix extraction & locked prefix handling
  const getEnforcedPrefix = (type: DocumentType): string => {
    if (type === 'QUOTATION') return 'Q-';
    if (type === 'PROFORMA') return 'PI-';
    return 'INV-';
  };

  const parseInitialSuffix = (fullNumber?: string, type?: DocumentType): string => {
    if (!fullNumber) return '0001';
    const prefix = getEnforcedPrefix(type || defaultType);
    if (fullNumber.startsWith(prefix)) {
      return fullNumber.slice(prefix.length);
    }
    // Try to strip other known prefixes
    return fullNumber.replace(/^(Q-|PI-|INV-)/, '');
  };

  const [numberSuffix, setNumberSuffix] = useState<string>(
    parseInitialSuffix(initialDocument?.documentNumber, initialDocument?.documentType || defaultType)
  );

  const [selectedClientId, setSelectedClientId] = useState(initialDocument?.clientId || '');
  const [clientName, setClientName] = useState(initialDocument?.clientName || '');
  const [clientKraPin, setClientKraPin] = useState(initialDocument?.clientKraPin || '');
  const [clientAddress, setClientAddress] = useState(initialDocument?.clientAddress || '');
  const [clientPhone, setClientPhone] = useState(initialDocument?.clientPhone || '');
  const [clientEmail, setClientEmail] = useState(initialDocument?.clientEmail || '');
  const [issueDate, setIssueDate] = useState(initialDocument?.issueDate || formatDate());
  const [validityDays, setValidityDays] = useState(initialDocument?.validityDays || 14);
  const [dueDate, setDueDate] = useState(
    initialDocument?.dueDate || calculateDueDate(initialDocument?.issueDate || formatDate(), 14)
  );
  const [status, setStatus] = useState<BillingDocument['status']>(initialDocument?.status || 'Draft');
  const [notes, setNotes] = useState(initialDocument?.notes || '');
  const [terms, setTerms] = useState(initialDocument?.terms || '');
  const [discount, setDiscount] = useState<number>(initialDocument?.discount || 0);
  const [relatedDocNumber, setRelatedDocNumber] = useState(initialDocument?.relatedDocNumber || '');
  const [relatedDocId, setRelatedDocId] = useState(initialDocument?.relatedDocId || '');

  // Guarded Client Profile Editing State
  const [isClientLocked, setIsClientLocked] = useState<boolean>(
    Boolean(initialDocument?.clientId || initialDocument?.clientName)
  );
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientModalTarget, setClientModalTarget] = useState<Client | null>(null);

  // Scrolling Ref
  const formScrollRef = useRef<HTMLDivElement>(null);

  // Spreadsheet Line Items: always begin with a clean blank slate when creating a new document
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialDocument?.lineItems && initialDocument.lineItems.length > 0
      ? [
          ...initialDocument.lineItems,
          // Add empty trailing row for quick continuation if the last row is filled
          ...(initialDocument.lineItems[initialDocument.lineItems.length - 1].particulars?.trim()
            ? [
                {
                  id: 'li-new-' + Date.now(),
                  particulars: '',
                  quantity: 1,
                  days: 1,
                  rate: 0,
                  discount: 0,
                  amount: 0,
                },
              ]
            : []),
        ]
      : [
          {
            id: 'li-1',
            particulars: '',
            quantity: 1,
            days: 1,
            rate: 0,
            discount: 0,
            amount: 0,
          },
        ]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);

  // Hidden DOM ref for offscreen rendering if preview pane is collapsed
  const a4PreviewRef = useRef<HTMLDivElement>(null);
  const modalA4PreviewRef = useRef<HTMLDivElement>(null);

  // Full derived document number: Enforced Prefix + Editable Numerical Suffix
  const activePrefix = getEnforcedPrefix(docType);
  const fullDocumentNumber = `${activePrefix}${numberSuffix.trim()}`;

  // Real-time Collision detection & uniqueness check against existing documents
  const collisionDoc = useMemo(() => {
    if (!numberSuffix.trim()) return null;
    const cleanCurrent = fullDocumentNumber.trim().toUpperCase();
    return localDocs.find(
      (d) =>
        d.documentNumber.trim().toUpperCase() === cleanCurrent &&
        d.id !== initialDocument?.id
    );
  }, [fullDocumentNumber, localDocs, initialDocument?.id, numberSuffix]);

  // Suggested next sequential number if collision occurs
  const suggestedNextSuffix = useMemo(() => {
    const pfx = activePrefix.toUpperCase();
    const sameTypeDocs = localDocs.filter((d) =>
      d.documentNumber.toUpperCase().startsWith(pfx)
    );
    let maxNum = 0;
    sameTypeDocs.forEach((d) => {
      const numPart = d.documentNumber.slice(pfx.length).replace(/[^0-9]/g, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    });
    return String(maxNum + 1).padStart(4, '0');
  }, [activePrefix, localDocs]);

  // Real-time KRA PIN validation status
  const kraValidation = useMemo(() => validateKraPin(clientKraPin), [clientKraPin]);

  // Auto-generate document number sequential suffix when creating new
  useEffect(() => {
    if (!initialDocument) {
      dbService.getNextDocumentNumber(docType).then((num) => {
        const pfx = getEnforcedPrefix(docType);
        if (num.startsWith(pfx)) {
          setNumberSuffix(num.slice(pfx.length));
        } else {
          setNumberSuffix(num.replace(/^(Q-|PI-|INV-)/, ''));
        }
      });
    }
  }, [docType, initialDocument]);

  // Update due date when issueDate or validityDays changes
  const handleValidityChange = (days: number) => {
    setValidityDays(days);
    setDueDate(calculateDueDate(issueDate, days));
  };

  const handleIssueDateChange = (newDate: string) => {
    setIssueDate(newDate);
    setDueDate(calculateDueDate(newDate, validityDays));
  };

  // Client Selection Handler
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setClientName(client.name);
      setClientKraPin(client.kraPin || '');
      setClientAddress(client.address || '');
      setClientPhone(client.phone || '');
      setClientEmail(client.email || '');
      setIsClientLocked(true);
    } else {
      setIsClientLocked(false);
    }
  };

  const handleOpenEditClientModal = () => {
    const target = clients.find((c) => c.id === selectedClientId) || {
      id: selectedClientId || 'cli-' + Date.now(),
      name: clientName,
      contactPerson: '',
      kraPin: clientKraPin,
      phone: clientPhone,
      email: clientEmail,
      address: clientAddress,
      createdAt: formatDate(),
    };
    setClientModalTarget(target);
    setIsClientModalOpen(true);
  };

  const handleOpenCreateClientModal = () => {
    setClientModalTarget(null);
    setIsClientModalOpen(true);
  };

  const handleSaveClientFromModal = async (savedClient: Client) => {
    try {
      await dbService.saveClient(savedClient);
      syncManager.triggerImmediatePush();
    } catch (err) {
      console.warn('Could not persist client locally:', err);
    }
    setSelectedClientId(savedClient.id);
    setClientName(savedClient.name);
    setClientKraPin(savedClient.kraPin || '');
    setClientPhone(savedClient.phone || '');
    setClientEmail(savedClient.email || '');
    setClientAddress(savedClient.address || '');
    setIsClientLocked(true);
    setIsClientModalOpen(false);
  };

  // Dynamic Spreadsheet Line Item Handlers
  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    let processedValue = value;

    if (field === 'particulars') {
      let strVal = String(value);
      // Auto-capitalize first character as user starts typing
      if (strVal.length === 1 && /[a-z]/.test(strVal)) {
        strVal = strVal.toUpperCase();
      }
      processedValue = strVal;
    } else if (field === 'rate' || field === 'discount') {
      processedValue = typeof value === 'number' ? value : parseCurrencyInput(value);
    } else if (field === 'quantity' || field === 'days') {
      const num = Number(value);
      processedValue = isNaN(num) || num < 0 ? 1 : num;
    }

    const current = { ...updated[index], [field]: processedValue };
    current.amount = calculateLineItemAmount(current);
    updated[index] = current;

    // Dynamic Row Addition: Automatically append a new empty row whenever the user types into the last available row
    if (index === lineItems.length - 1 && field === 'particulars' && String(processedValue).trim().length > 0) {
      updated.push({
        id: 'li-' + Date.now(),
        particulars: '',
        quantity: 1,
        days: 1,
        rate: 0,
        discount: 0,
        amount: 0,
      });
    }

    setLineItems(updated);
  };

  // Focus on last row automatically appends row if last row has particulars
  const handleCellFocus = (index: number) => {
    if (index === lineItems.length - 1 && lineItems[index].particulars.trim().length > 0) {
      setLineItems([
        ...lineItems,
        {
          id: 'li-' + Date.now(),
          particulars: '',
          quantity: 1,
          days: 1,
          rate: 0,
          discount: 0,
          amount: 0,
        },
      ]);
    }
  };

  // Keyboard navigation for spreadsheet grid
  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If pressing Enter on the last row, or Enter on amount/discount, move to next row or add row
      if (index === lineItems.length - 1) {
        setLineItems([
          ...lineItems,
          {
            id: 'li-' + Date.now(),
            particulars: '',
            quantity: 1,
            days: 1,
            rate: 0,
            discount: 0,
            amount: 0,
          },
        ]);
      }
    }
  };

  const handleAddItem = () => {
    const newItem: LineItem = {
      id: 'li-' + Date.now(),
      particulars: '',
      quantity: 1,
      days: 1,
      rate: 0,
      discount: 0,
      amount: 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (lineItems.length <= 1) {
      setLineItems([
        {
          id: 'li-' + Date.now(),
          particulars: '',
          quantity: 1,
          days: 1,
          rate: 0,
          discount: 0,
          amount: 0,
        },
      ]);
      return;
    }
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
  };

  const handleAddPreset = (preset: (typeof HOSPITALITY_PRESETS)[0]) => {
    const amount = calculateLineItemAmount({
      quantity: preset.qty,
      days: preset.days,
      rate: preset.rate,
    });
    const newItem: LineItem = {
      id: 'li-' + Date.now(),
      particulars: preset.particulars,
      quantity: preset.qty,
      days: preset.days,
      rate: preset.rate,
      discount: 0,
      amount,
    };

    // Replace the last empty row if empty, else append
    const lastIdx = lineItems.length - 1;
    if (lastIdx >= 0 && !lineItems[lastIdx].particulars.trim()) {
      const updated = [...lineItems];
      updated[lastIdx] = newItem;
      // Add a fresh empty row
      updated.push({
        id: 'li-' + Date.now(),
        particulars: '',
        quantity: 1,
        days: 1,
        rate: 0,
        discount: 0,
        amount: 0,
      });
      setLineItems(updated);
    } else {
      setLineItems([
        ...lineItems,
        newItem,
        {
          id: 'li-' + Date.now(),
          particulars: '',
          quantity: 1,
          days: 1,
          rate: 0,
          discount: 0,
          amount: 0,
        },
      ]);
    }
    setShowPresetsMenu(false);
  };

  // PDF Filtering Rule: Rows where Particulars is empty or whitespace-only must be dynamically excluded from totals and preview
  const activeLineItems = lineItems.filter((item) => item.particulars && item.particulars.trim().length > 0);
  const totals = calculateTotals(activeLineItems, discount, profile.vatRate);
  const amountPaid = initialDocument?.amountPaid || 0;
  const balanceDue = Math.max(0, Math.round((totals.grandTotal - amountPaid) * 100) / 100);

  // Construct active document object
  const currentDoc: BillingDocument = {
    id: initialDocument?.id || 'doc-new-' + Date.now(),
    documentType: docType,
    documentNumber: fullDocumentNumber || 'DRAFT',
    clientId: selectedClientId,
    clientName: clientName || 'Client Name / Walk-in Guest',
    clientKraPin,
    clientAddress,
    clientPhone,
    clientEmail,
    issueDate,
    validityDays,
    dueDate,
    lineItems: activeLineItems.length > 0 ? activeLineItems : lineItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    vatAmount: totals.vatAmount,
    grandTotal: totals.grandTotal,
    amountPaid,
    balanceDue: docType === 'QUOTATION' ? totals.grandTotal : balanceDue,
    status,
    notes,
    terms,
    relatedDocId,
    relatedDocNumber,
    createdAt: initialDocument?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    driveFileUrl: initialDocument?.driveFileUrl,
    driveFileId: initialDocument?.driveFileId,
  };

  // =========================================================================
  // 1. TRIGGER AUTOMATION PIPELINE & ACTION WORKFLOWS
  // Base Pipeline: [Save & Record]
  // 1. Validate inputs, compute running balances, persist record to IndexedDB
  // 2. Drive Archival (Zero-Auth): Render clean PDF blob, upload to shared Drive folder
  // 3. Sheet Ledger Sync: Push/update record row in Google Sheet
  // =========================================================================
  const runSaveAndRecordPipeline = async (silent = false): Promise<BillingDocument | null> => {
    if (!clientName.trim()) {
      alert('Please enter or select a client name.');
      return null;
    }

    if (!numberSuffix.trim()) {
      alert('Please enter a document reference number.');
      return null;
    }

    let finalNumber = fullDocumentNumber;
    if (collisionDoc) {
      const confirmUseNext = window.confirm(
        `Collision Warning:\nDocument reference "${fullDocumentNumber}" is already in use by ${collisionDoc.clientName}.\n\nWould you like to auto-assign the next available number "${activePrefix}${suggestedNextSuffix}" instead?`
      );
      if (confirmUseNext) {
        setNumberSuffix(suggestedNextSuffix);
        finalNumber = `${activePrefix}${suggestedNextSuffix}`;
      } else {
        return null;
      }
    }

    if (activeLineItems.length === 0) {
      alert('Please enter at least one line item with a service description.');
      return null;
    }

    setIsSaving(true);
    try {
      // 1. Prepare clean persisted document
      const docToPersist: BillingDocument = {
        ...currentDoc,
        documentNumber: finalNumber,
        lineItems: activeLineItems,
        subtotal: totals.subtotal,
        discount: totals.discount,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        balanceDue: docType === 'QUOTATION' ? totals.grandTotal : balanceDue,
        updatedAt: new Date().toISOString(),
      };

      // 2. Instant Local Journal Record (L1 Cache & IndexedDB in < 1ms)
      await dbService.saveDocument(docToPersist);
      onSave(docToPersist);

      if (!silent) {
        setSaveNotification('Document recorded in local journal! Syncing to Google Drive in background...');
        setTimeout(() => setSaveNotification(null), 4000);
      }

      // 3. Asynchronous Non-Blocking Drive Archival & Sheet Ledger Sync
      const targetElement = a4PreviewRef.current;
      const executeBackgroundSync = async () => {
        let pdfBase64: string | undefined;
        let pdfFileName: string | undefined;

        if (targetElement) {
          try {
            const pdfRes = await generatePdfFromElement(
              targetElement,
              docToPersist.documentNumber,
              docToPersist.clientName,
              docToPersist.issueDate,
              { download: false }
            );

            const validation = validatePdfBlob(pdfRes.blob, pdfRes.base64);
            if (validation.isValid) {
              pdfBase64 = pdfRes.base64;
              pdfFileName = pdfRes.fileName;

              // Background Local Machine Filesystem Backup
              localBackupService
                .savePdfToLocalArchive(pdfRes.blob, pdfRes.fileName, {
                  documentNumber: docToPersist.documentNumber,
                })
                .catch((bkErr) => console.warn('Local machine filesystem archival warning:', bkErr));
            }
          } catch (pdfErr) {
            console.warn('Background PDF generation for drive archival deferred:', pdfErr);
          }
        }

        // Background Google Apps Script Push
        try {
          const syncResult = await syncManager.syncDocument(docToPersist, pdfBase64, pdfFileName);
          if (syncResult.success && !silent) {
            setSaveNotification(
              syncResult.uploadVerified
                ? 'Document verified in Google Drive & archived!'
                : 'Document recorded & archived to Google Drive successfully!'
            );
            setTimeout(() => setSaveNotification(null), 3500);
          }
        } catch (syncErr) {
          console.warn('Background sync warning:', syncErr);
        }
      };

      // Dispatch to browser idle queue or macro-task to prevent input freeze
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          executeBackgroundSync();
        }, { timeout: 1000 });
      } else {
        setTimeout(executeBackgroundSync, 10);
      }

      return docToPersist;
    } catch (err: any) {
      alert('Failed to save document: ' + err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // =========================================================================
  // ACTION CHAINING RULES:
  // - Direct Trigger ([Save & Record]): Runs pipeline, then automatically launches Full-Screen Live PDF Preview Modal!
  // - Chained Triggers ([Convert], [Preview Modal], [Download PDF], [Direct Print], [Share]):
  //   Step 1: Automatically invoke Save & Record pipeline in background
  //   Step 2: Once committed, immediately execute requested secondary action!
  // =========================================================================

  // Direct Trigger: Save & Record
  const handleSaveAndRecordDirect = async () => {
    const saved = await runSaveAndRecordPipeline(false);
    if (saved) {
      // Automatically launch Full-Screen Live PDF Preview Modal!
      setShowFullPreviewModal(true);
    }
  };

  // Chained Trigger: Live PDF Preview Modal
  const handleLivePreviewModalChained = async () => {
    const saved = await runSaveAndRecordPipeline(true);
    if (saved) {
      setShowFullPreviewModal(true);
    }
  };

  // Chained Trigger: Download PDF
  const handleDownloadPdfChained = async () => {
    const saved = await runSaveAndRecordPipeline(true);
    if (!saved) return;
    const targetElement = a4PreviewRef.current;
    if (!targetElement) return;

    setIsGeneratingPdf(true);
    try {
      await generatePdfFromElement(
        targetElement,
        saved.documentNumber,
        saved.clientName,
        saved.issueDate,
        { download: true }
      );
    } catch (err: any) {
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Chained Trigger: Direct Print
  const handleDirectPrintChained = async () => {
    const saved = await runSaveAndRecordPipeline(true);
    if (!saved) return;
    window.print();
  };

  // Chained Trigger: Web Share
  const handleShareChained = async () => {
    const saved = await runSaveAndRecordPipeline(true);
    if (!saved) return;
    const targetElement = a4PreviewRef.current;
    if (!targetElement) return;

    setIsGeneratingPdf(true);
    try {
      const { blob, fileName } = await generatePdfFromElement(
        targetElement,
        saved.documentNumber,
        saved.clientName,
        saved.issueDate,
        { download: false }
      );
      const shared = await shareDocumentPdf(
        blob,
        fileName,
        `${saved.documentType}: ${saved.documentNumber} - Hotel Damview`,
        `Please find attached ${saved.documentType} ${saved.documentNumber} for ${saved.clientName} amounting to ${formatKsh(saved.grandTotal)}.`
      );
      if (!shared) {
        handleDownloadPdfChained();
      }
    } catch (err: any) {
      console.warn('Share error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Chained Trigger: Conversion Trigger (e.g. Quotation -> Proforma -> Invoice)
  const handleConvertChained = async (targetType: DocumentType) => {
    const saved = await runSaveAndRecordPipeline(true);
    if (!saved) return;
    if (onConvert) {
      onConvert(saved, targetType);
    } else {
      setDocType(targetType);
      dbService.getNextDocumentNumber(targetType).then((nextNum) => {
        const pfx = getEnforcedPrefix(targetType);
        setNumberSuffix(nextNum.replace(/^(Q-|PI-|INV-)/, ''));
        setRelatedDocNumber(saved.documentNumber);
        setRelatedDocId(saved.id);
        setStatus('Draft');
      });
    }
  };

  // Clear Form Handler
  const handleClearForm = () => {
    if (confirm('Clear all input fields and start with a blank slate?')) {
      setLineItems([
        {
          id: 'li-' + Date.now(),
          particulars: '',
          quantity: 1,
          days: 1,
          rate: 0,
          discount: 0,
          amount: 0,
        },
      ]);
      setSelectedClientId('');
      setClientName('');
      setClientKraPin('');
      setClientAddress('');
      setClientPhone('');
      setClientEmail('');
      setDiscount(0);
      setNotes('');
      setTerms('');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-stone-100">
      {/* TOP WORKSPACE ACTION TOOLBAR */}
      <div className="no-print bg-white border-b border-stone-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
        <div className="flex items-center space-x-2.5">
          <span className="font-bold text-stone-900 text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-700" />
            {initialDocument ? `Editing ${fullDocumentNumber}` : 'Document Workspace'}
          </span>
          <span className="text-stone-300">|</span>

          {/* Document Type Badge (Single Workspace View - No Switching Tabs) */}
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-stone-900 text-amber-400 border border-stone-800 tracking-wide font-mono">
            {docType === 'QUOTATION' ? 'QUOTATION' : docType === 'PROFORMA' ? 'PROFORMA INVOICE' : 'INVOICE'}
          </span>

          {/* Contextual Chained Conversion Triggers */}
          {docType === 'QUOTATION' && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleConvertChained('PROFORMA')}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded hover:bg-amber-100 transition-colors"
                title="Saves Quotation, then converts to Proforma Invoice"
              >
                <ArrowRightLeft className="w-3 h-3" />
                Convert to Proforma
              </button>
              <button
                type="button"
                onClick={() => handleConvertChained('INVOICE')}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded hover:bg-emerald-100 transition-colors"
                title="Saves Quotation, then converts to Invoice"
              >
                <ArrowRightLeft className="w-3 h-3" />
                Convert to Invoice
              </button>
            </div>
          )}

          {docType === 'PROFORMA' && (
            <button
              type="button"
              onClick={() => handleConvertChained('INVOICE')}
              className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded hover:bg-emerald-100 transition-colors"
              title="Saves Proforma, then converts to Invoice"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Convert to Invoice
            </button>
          )}
        </div>

        {/* Primary Action Triggers (Event-Chained Architecture) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {saveNotification && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded flex items-center gap-1 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saveNotification}
            </span>
          )}

            {/* Shortcut: Jump to Live A4 Preview */}
            <button
              type="button"
              onClick={() => {
                document.getElementById('editor-live-a4-preview')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-700 rounded bg-white hover:bg-stone-50 transition-colors"
              title="Scroll directly down to Live A4 PDF Preview"
            >
              <Eye className="w-3.5 h-3.5 text-amber-700" />
              <span>Live A4 Preview</span>
            </button>

          {/* Chained Trigger: Full Screen Live Preview Modal */}
          <button
            type="button"
            onClick={handleLivePreviewModalChained}
            disabled={isSaving}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-700 rounded bg-white hover:bg-stone-50 transition-colors"
            title="Saves & opens live full-screen A4 PDF preview modal"
          >
            <Eye className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden sm:inline">Preview Modal</span>
          </button>

          {/* Chained Trigger: Direct Print */}
          <button
            type="button"
            onClick={handleDirectPrintChained}
            disabled={isSaving}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-700 rounded bg-white hover:bg-stone-50 transition-colors"
            title="Saves & triggers browser print dialog"
          >
            <Printer className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden sm:inline">Direct Print</span>
          </button>

          {/* Chained Trigger: Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPdfChained}
            disabled={isSaving || isGeneratingPdf}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-700 rounded bg-white hover:bg-stone-50 transition-colors disabled:opacity-50"
            title="Saves & generates vector-accurate A4 PDF download"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
          </button>

          {/* Chained Trigger: Share */}
          <button
            type="button"
            onClick={handleShareChained}
            disabled={isSaving || isGeneratingPdf}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border border-stone-300 text-stone-700 rounded bg-white hover:bg-stone-50 transition-colors"
            title="Saves & triggers Web Share API"
          >
            <Share2 className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden md:inline">Share</span>
          </button>

          {/* Clear Form */}
          <button
            type="button"
            onClick={handleClearForm}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border border-stone-300 text-stone-600 rounded bg-white hover:bg-stone-50 transition-colors"
            title="Reset particulars and line items"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden md:inline">Clear</span>
          </button>

          {/* Cancel / Back trigger alongside Save & Record */}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-stone-300 text-stone-700 rounded bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer ml-1"
            title="Discard unsaved changes and return"
          >
            <X className="w-3.5 h-3.5 text-stone-600" />
            <span>Cancel / Back</span>
          </button>

          {/* Direct Base Pipeline Trigger: [Save & Record] */}
          <button
            type="button"
            onClick={handleSaveAndRecordDirect}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            title="Atomically records to IndexedDB, archives PDF to Drive, syncs to Sheets, and opens preview modal"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save & Record Document'}</span>
          </button>
        </div>
      </div>

      {/* UNIFIED CONTINUOUS-SCROLL WORKSPACE (SINGLE-SCREEN VERTICAL FLOW) */}
      <div
        ref={formScrollRef}
        className="flex-1 overflow-y-auto bg-stone-100/60 p-3 sm:p-4 md:p-6 space-y-6"
      >
        {/* TOP INTERACTIVE DOCUMENT FORM CARD */}
        <div className="max-w-5xl mx-auto bg-white border border-stone-200 rounded-lg p-4 md:p-5 shadow-xs space-y-5">
          {/* 1. DOCUMENT IDENTITY & METADATA SECTION */}
          <div id="editor-document-identity" className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-3.5 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Document Identity & Details
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                  {docType}
                </span>
              </div>

              {/* Numbering Constraints & Uniqueness Availability Indicator */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Reference:</span>
                  <div
                    className="inline-flex items-center border border-slate-300 rounded overflow-hidden shadow-2xs bg-white"
                    title="Prefix is locked; sequential numerical suffix is editable"
                  >
                    <span className="bg-slate-200 text-slate-800 font-mono font-bold px-2.5 py-1 text-xs select-none border-r border-slate-300">
                      {activePrefix}
                    </span>
                    <input
                      type="text"
                      value={numberSuffix}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9A-Za-z-]/g, '');
                        setNumberSuffix(clean);
                      }}
                      placeholder="0001"
                      className="px-2 py-1 text-xs font-mono font-bold text-slate-900 bg-white w-24 focus:outline-none focus:bg-amber-50/50"
                    />
                  </div>
                </div>

                {/* Real-time Uniqueness / Availability Status Badge */}
                {collisionDoc ? (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="font-semibold">Already Taken</span>
                    <button
                      type="button"
                      onClick={() => setNumberSuffix(suggestedNextSuffix)}
                      className="ml-1 text-[11px] font-bold text-rose-950 underline hover:text-black cursor-pointer"
                      title={`Assign next available: ${activePrefix}${suggestedNextSuffix}`}
                    >
                      Use {activePrefix}{suggestedNextSuffix}
                    </button>
                  </div>
                ) : numberSuffix.trim() ? (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold">Available</span>
                    <span className="text-[10px] text-emerald-600 font-mono hidden md:inline">(Unique ID)</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => handleIssueDateChange(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Validity (Days)</label>
                <select
                  value={validityDays}
                  onChange={(e) => handleValidityChange(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days (Standard)</option>
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  {docType === 'QUOTATION' ? 'Valid Until' : 'Due Date'}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Document Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BillingDocument['status'])}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent to Client</option>
                  <option value="Paid">Paid in Full</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>

            {relatedDocNumber && (
              <div className="pt-1 text-xs text-slate-500 flex items-center gap-1.5">
                <span className="font-medium">Originating Document:</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded">
                  {relatedDocNumber}
                </span>
              </div>
            )}
          </div>

          {/* 2. RECIPIENT / BILLING PARTICULARS SECTION */}
          <div id="editor-client-particulars" className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-3.5 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recipient & Billing Particulars
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(selectedClientId || clientName) && (
                  <button
                    type="button"
                    onClick={handleOpenEditClientModal}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded font-semibold transition-colors shadow-2xs cursor-pointer"
                    title="Open client editor modal to safely mutate master profile"
                  >
                    <Edit3 className="w-3 h-3 text-amber-600" />
                    <span>Edit Selected Client</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenCreateClientModal}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold rounded transition-colors shadow-2xs cursor-pointer"
                  title="Register new client profile into local database"
                >
                  <Plus className="w-3 h-3 text-stone-950" />
                  <span>Add New Client</span>
                </button>
              </div>
            </div>

            {/* Guarded Read-Only Lock Banner */}
            {isClientLocked ? (
              <div className="flex items-center justify-between bg-slate-100/95 border border-slate-200 px-2.5 py-1.5 rounded text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Guarded Client Profile</span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    (Locked in read-only mode to prevent accidental billing overwrites)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenEditClientModal}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-medium text-[11px] shadow-2xs cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3 text-amber-600" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClientLocked(false)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 text-[11px] cursor-pointer"
                    title="Unlock fields to edit particulars directly for this document only"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>Unlock for Walk-in</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 px-2.5 py-1.5 rounded text-xs">
                <div className="flex items-center gap-1.5 text-amber-800">
                  <Unlock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-semibold">Direct Editing Enabled</span>
                  <span className="text-[11px] text-amber-700 hidden sm:inline">
                    (Edits apply to this document only)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClientLocked(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-300 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                >
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Lock Profile</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">Select Existing Client Profile</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Choose registered corporate client or walk-in guest --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.kraPin ? `(PIN: ${c.kraPin})` : ''} {c.phone ? `• ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Client / Organization Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  ref={primaryInputRef}
                  value={clientName}
                  readOnly={isClientLocked}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Kenya Wildlife Service"
                  className={`w-full border rounded px-2.5 py-1.5 font-medium transition-colors ${
                    isClientLocked
                      ? 'bg-slate-100/90 text-slate-700 cursor-not-allowed border-slate-200 select-none'
                      : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 font-medium">Client KRA Tax PIN</label>
                  {clientKraPin && (
                    kraValidation.isValid ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-medium flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Valid PIN
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-medium flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {kraValidation.message}
                      </span>
                    )
                  )}
                </div>
                <input
                  type="text"
                  value={clientKraPin}
                  readOnly={isClientLocked}
                  onChange={(e) => setClientKraPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. P051234567Z"
                  maxLength={11}
                  className={`w-full border rounded px-2.5 py-1.5 font-mono uppercase transition-colors ${
                    isClientLocked
                      ? 'bg-slate-100/90 text-slate-700 cursor-not-allowed border-slate-200 select-none'
                      : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Telephone / Mobile</label>
                <input
                  type="text"
                  value={clientPhone}
                  readOnly={isClientLocked}
                  onChange={(e) => setClientPhone(e.target.value)}
                  onBlur={(e) => setClientPhone(normalizeKenyanPhone(e.target.value))}
                  placeholder="e.g. 0712 345 678 or +254 712 345 678"
                  className={`w-full border rounded px-2.5 py-1.5 font-mono transition-colors ${
                    isClientLocked
                      ? 'bg-slate-100/90 text-slate-700 cursor-not-allowed border-slate-200 select-none'
                      : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={clientEmail}
                  readOnly={isClientLocked}
                  onChange={(e) => setClientEmail(e.target.value.trim().toLowerCase())}
                  placeholder="e.g. accounts@client.co.ke"
                  className={`w-full border rounded px-2.5 py-1.5 transition-colors ${
                    isClientLocked
                      ? 'bg-slate-100/90 text-slate-700 cursor-not-allowed border-slate-200 select-none'
                      : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">Physical / Postal Address</label>
                <input
                  type="text"
                  value={clientAddress}
                  readOnly={isClientLocked}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="e.g. P.O. Box 40241 - 00100 Nairobi / Machakos Road"
                  className={`w-full border rounded px-2.5 py-1.5 transition-colors ${
                    isClientLocked
                      ? 'bg-slate-100/90 text-slate-700 cursor-not-allowed border-slate-200 select-none'
                      : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 3. LINE-ITEM SPREADSHEET DATA GRID */}
          <div id="editor-line-items" className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Line Items & Hospitality Services
                </span>
                <span className="text-[10px] text-slate-500 italic hidden sm:inline">
                  (Auto-appends row on focus / Enter &bull; Case normalized)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Presets Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                    className="text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-2 py-1 rounded flex items-center gap-1 font-medium shadow-xs"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Hotel Presets
                  </button>

                  {showPresetsMenu && (
                    <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded shadow-lg z-20 py-1 text-xs">
                      <div className="px-3 py-1.5 font-bold text-slate-800 border-b border-slate-100">
                        Standard Damview Services
                      </div>
                      {HOSPITALITY_PRESETS.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAddPreset(p)}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 border-b border-slate-100 last:border-b-0 flex justify-between items-center"
                        >
                          <span className="truncate pr-2">{p.particulars}</span>
                          <span className="font-semibold text-slate-900 shrink-0">{formatKsh(p.rate)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Item Button */}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-2.5 py-1 rounded flex items-center gap-1 font-medium shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  Add Row
                </button>
              </div>
            </div>

            {/* High-Fidelity Spreadsheet Data Table */}
            <div className="overflow-x-auto border border-slate-300 rounded bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                    <th className="px-2.5 py-2 text-center w-8">#</th>
                    <th className="px-2.5 py-2">Particulars</th>
                    <th className="px-2 py-2 text-center w-16">Qty</th>
                    <th className="px-2 py-2 text-center w-16">Days</th>
                    <th className="px-2 py-2 text-right w-24">Rate (Ksh)</th>
                    <th className="px-2.5 py-2 text-right w-28">Amount (Ksh)</th>
                    <th className="px-2 py-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lineItems.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className={`hover:bg-amber-50/30 transition-colors ${
                        !item.particulars.trim() ? 'bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 text-center text-slate-400 font-mono font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          type="text"
                          value={item.particulars}
                          onFocus={() => handleCellFocus(idx)}
                          onChange={(e) => handleItemChange(idx, 'particulars', e.target.value)}
                          onBlur={(e) => {
                            const normalized = normalizeLineItemParticulars(e.target.value);
                            if (normalized !== e.target.value) {
                              handleItemChange(idx, 'particulars', normalized);
                            }
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 'particulars')}
                          placeholder={
                            idx === lineItems.length - 1 && !item.particulars
                              ? 'Type particulars here...'
                              : 'Particulars...'
                          }
                          className="w-full border border-transparent hover:border-slate-300 focus:border-amber-500 rounded px-2 py-1 text-xs text-slate-900 bg-transparent focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onFocus={() => handleCellFocus(idx)}
                          onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 'quantity')}
                          className="w-full border border-transparent hover:border-stone-300 focus:border-stone-500 rounded px-1.5 py-1 text-xs text-center text-stone-800 bg-transparent focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="1"
                          value={item.days}
                          onFocus={() => handleCellFocus(idx)}
                          onChange={(e) => handleItemChange(idx, 'days', Number(e.target.value))}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 'days')}
                          className="w-full border border-transparent hover:border-stone-300 focus:border-stone-500 rounded px-1.5 py-1 text-xs text-center text-stone-800 bg-transparent focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={item.rate}
                          onFocus={() => handleCellFocus(idx)}
                          onChange={(e) => handleItemChange(idx, 'rate', Number(e.target.value))}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 'rate')}
                          className="w-full border border-transparent hover:border-stone-300 focus:border-stone-500 rounded px-1.5 py-1 text-xs text-right font-mono text-stone-800 bg-transparent focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono font-bold text-stone-900">
                        {formatKsh(item.amount).replace('Ksh ', '')}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-stone-300 hover:text-rose-600 p-1 rounded transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 4. FINANCIAL SUMMARY CALCULATION PANEL */}
            <div id="editor-totals-breakdown" className="bg-slate-50/90 border border-slate-200/90 rounded-lg p-4 flex flex-col items-end space-y-2 text-xs shadow-2xs">
              <div className="flex justify-between items-center w-80 text-slate-600">
                <span className="font-medium">Gross Subtotal (Excl. VAT):</span>
                <span className="font-mono font-semibold text-slate-900">{formatKsh(totals.grossSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center w-80 text-slate-600">
                <span className="text-emerald-800 font-medium">Negotiated Discount (Ksh):</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-mono text-[11px]">-</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={discount === 0 ? '' : discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="w-28 text-right font-mono font-semibold border border-slate-300 rounded px-2.5 py-1 bg-white text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between items-center w-80 text-slate-600">
                  <span className="font-medium">Net Taxable Base:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatKsh(totals.subtotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center w-80 text-slate-600">
                <span className="font-medium">VAT (16% Kenya Standard):</span>
                <span className="font-mono font-semibold text-slate-900">{formatKsh(totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between items-center w-80 text-slate-950 font-bold border-t border-slate-300 pt-2 text-sm">
                <span>Grand Total:</span>
                <span className="font-mono text-base text-slate-950 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200/80">
                  {formatKsh(totals.grandTotal)}
                </span>
              </div>
              {docType === 'INVOICE' && (
                <>
                  <div className="flex justify-between items-center w-80 text-slate-600 pt-1">
                    <span className="font-medium">Amount Settled / Paid:</span>
                    <span className="font-mono font-semibold text-emerald-700">{formatKsh(amountPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center w-80 text-rose-800 font-bold border-t border-slate-200 pt-1.5">
                    <span>Balance Due:</span>
                    <span className={`font-mono px-2 py-0.5 rounded ${balanceDue > 0 ? 'bg-rose-50 border border-rose-200 text-rose-900' : 'text-emerald-700'}`}>
                      {formatKsh(balanceDue)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 5. NOTES & TERMS SECTION */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-3.5 space-y-3 shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
              Terms, Conditions & Instructions
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Notes / Special Instructions</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Settlement & Payment Terms</label>
                <textarea
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>
            </div>

            {/* Bottom Primary Action Trigger Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-300 text-slate-600 rounded bg-white hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clear Form</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-stone-300 text-stone-700 bg-stone-100 hover:bg-stone-200 rounded shadow-2xs transition-colors cursor-pointer"
                  title="Discard changes and return"
                >
                  <X className="w-3.5 h-3.5 text-stone-600" />
                  <span>Cancel / Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndRecordDirect}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  title="Save document, record in database, archive PDF & sync"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save & Record Document'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subtle Ambient Contextual Scroll Navigator */}
          <div className="sticky bottom-2 flex justify-end pointer-events-none z-10 pr-2">
            <div className="pointer-events-auto bg-stone-900/85 hover:bg-stone-900 text-stone-200 backdrop-blur-xs shadow-lg border border-stone-700/70 rounded-full px-2.5 py-1 flex items-center gap-1.5 text-[11px] transition-all opacity-85 hover:opacity-100">
              <button
                type="button"
                onClick={() => formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-1.5 py-0.5 rounded hover:bg-stone-800 text-stone-300 hover:text-white flex items-center gap-0.5 cursor-pointer font-medium"
                title="Scroll to Top of Document"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Top</span>
              </button>
              <span className="text-stone-600">|</span>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('editor-client-particulars')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-1.5 py-0.5 rounded hover:bg-stone-800 text-stone-300 hover:text-amber-400 flex items-center gap-0.5 cursor-pointer font-medium"
                title="Jump to Client Particulars"
              >
                <span>Client</span>
              </button>
              <span className="text-stone-600">|</span>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('editor-line-items')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-1.5 py-0.5 rounded hover:bg-stone-800 text-stone-300 hover:text-amber-400 flex items-center gap-0.5 cursor-pointer font-medium"
                title="Jump to Spreadsheet Line Items"
              >
                <span>Items</span>
              </button>
              <span className="text-stone-600">|</span>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('editor-totals-breakdown')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-1.5 py-0.5 rounded hover:bg-stone-800 text-stone-300 hover:text-amber-400 flex items-center gap-0.5 cursor-pointer font-medium"
                title="Jump to Financial Totals"
              >
                <span>Totals</span>
              </button>
              <span className="text-stone-600">|</span>
              <button
                type="button"
                onClick={() => formScrollRef.current?.scrollTo({ top: formScrollRef.current.scrollHeight, behavior: 'smooth' })}
                className="px-1.5 py-0.5 rounded hover:bg-stone-800 text-stone-300 hover:text-white flex items-center gap-0.5 cursor-pointer font-medium"
                title="Scroll to Bottom (Terms & Notes)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">End</span>
              </button>
            </div>
          </div>
        </div>

        {/* 6. DYNAMIC VIEWPORT AUTO-SCALING A4 PDF PREVIEW SECTION (CONTINUOUS VERTICAL FLOW) */}
        <div id="editor-live-a4-preview" className="max-w-5xl mx-auto pt-2">
          <AutoScalingA4Container
            title={`Live Static A4 ${docType} Preview`}
            subtitle="Accurate 210mm × 297mm print & PDF output • Dynamic viewport auto-scaling"
            documentNumber={fullDocumentNumber}
            actions={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadPdfChained}
                  disabled={isSaving || isGeneratingPdf}
                  className="px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded flex items-center gap-1 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDirectPrintChained}
                  disabled={isSaving}
                  className="px-2.5 py-1 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded flex items-center gap-1 transition-colors border border-stone-700 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            }
          >
            <div ref={a4PreviewRef}>
              <A4DocumentPreview doc={currentDoc} profile={profile} />
            </div>
          </AutoScalingA4Container>
        </div>
      </div>

      {/* FULL-SCREEN LIVE PDF PREVIEW MODAL */}
      {showFullPreviewModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-4 animate-fade-in no-print">
          {/* Modal Header */}
          <div className="bg-white rounded-t-lg border border-stone-300 px-4 py-3 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-stone-900 text-sm">
                Full-Screen Live A4 PDF Preview: {fullDocumentNumber}
              </span>
              <span className="text-xs text-stone-500 hidden sm:inline">
                ({currentDoc.clientName} - {formatKsh(totals.grandTotal)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdfChained}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-amber-400 rounded flex items-center gap-1 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handleDirectPrintChained}
                className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded flex items-center gap-1 border border-stone-200"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleShareChained}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded flex items-center gap-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFullPreviewModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal A4 Preview Body */}
          <div className="flex-1 overflow-auto bg-stone-800/90 rounded-b-lg p-6 flex justify-center items-start">
            <div
              ref={modalA4PreviewRef}
              className="bg-white shadow-2xl origin-top"
              style={{
                transform: 'scale(0.85)',
                transformOrigin: 'top center',
              }}
            >
              <A4DocumentPreview doc={currentDoc} profile={profile} />
            </div>
          </div>
        </div>
      )}

      {/* Standalone Client Management Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        client={clientModalTarget}
        onClose={() => setIsClientModalOpen(false)}
        onSaveClient={handleSaveClientFromModal}
      />
    </div>
  );
};
