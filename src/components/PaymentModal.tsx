import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CreditCard,
  X,
  CheckCircle,
  AlertCircle,
  Download,
  Printer,
  Share2,
  Eye,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { BillingDocument, Client, PaymentRecord, HotelProfile } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { dbService } from '../services/db';
import { A4ReceiptPreview } from './A4ReceiptPreview';
import { AutoScalingA4Container } from './AutoScalingA4Container';
import { generatePdfFromElement, shareDocumentPdf, validatePdfBlob } from '../utils/pdfGenerator';
import { localBackupService } from '../services/localBackupService';

interface PaymentModalProps {
  document?: BillingDocument | null;
  clients: Client[];
  profile?: HotelProfile;
  initialClientId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (payment: PaymentRecord) => void;
}

const DEFAULT_PROFILE: HotelProfile = {
  name: 'HOTEL DAMVIEW',
  physicalLocation: 'MARIAKANI',
  postalAddress: 'P.O. BOX 42491-80100, Mombasa, Kenya',
  phone: '+25472524262',
  email: 'hoteldamview@gmail.com',
  kraPin: 'P051453023Q',
  logoBase64: '',
  bankName: '',
  bankBranch: '',
  accountHolder: '',
  accountNumber: '',
  mpesaTillNumber: '',
  vatRate: 16,
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  document: doc,
  clients,
  profile = DEFAULT_PROFILE,
  initialClientId,
  isOpen,
  onClose,
  onSavePayment,
}) => {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [clientId, setClientId] = useState(doc?.clientId || initialClientId || (clients[0]?.id ?? ''));
  const [date, setDate] = useState(formatDate());
  const [amount, setAmount] = useState<number>(doc?.balanceDue || 0);
  const [paymentMode, setPaymentMode] = useState<PaymentRecord['paymentMode']>('M-Pesa');
  const [referenceNote, setReferenceNote] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const previewReceiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      dbService.getNextReceiptNumber().then(setReceiptNumber);
      if (doc) {
        setClientId(doc.clientId);
        setAmount(doc.balanceDue > 0 ? doc.balanceDue : doc.grandTotal);
        setReferenceNote(doc.documentNumber ? `Settlement for ${doc.documentNumber}` : '');
      } else if (initialClientId) {
        setClientId(initialClientId);
        setAmount(0);
        setReferenceNote('');
      } else {
        setAmount(0);
        setReferenceNote('');
      }
    }
  }, [isOpen, doc, initialClientId]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId) || clients[0];
  }, [clients, clientId]);

  // Live preview payment object
  const currentLivePayment: PaymentRecord = useMemo(() => {
    return {
      id: 'pay-live-preview',
      receiptNumber: receiptNumber || 'REC-0001',
      documentId: doc?.id || '',
      documentNumber: doc?.documentNumber || '',
      clientId: selectedClient ? selectedClient.id : '',
      clientName: selectedClient ? selectedClient.name : 'Walk-In Customer',
      date: date || formatDate(),
      amount: Number(amount) || 0,
      paymentMode,
      referenceNote: referenceNote.trim(),
      createdAt: new Date().toISOString(),
    };
  }, [receiptNumber, doc, selectedClient, date, amount, paymentMode, referenceNote, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }

    setIsSaving(true);
    try {
      const newPayment: PaymentRecord = {
        id: 'pay-' + Date.now(),
        receiptNumber: receiptNumber || 'REC-' + Date.now(),
        documentId: doc?.id || '',
        documentNumber: doc?.documentNumber || '',
        clientId: selectedClient ? selectedClient.id : '',
        clientName: selectedClient ? selectedClient.name : 'Walk-In Customer',
        date,
        amount: Number(amount),
        paymentMode,
        referenceNote: referenceNote.trim(),
        createdAt: new Date().toISOString(),
      };

      onSavePayment(newPayment);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!previewReceiptRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const res = await generatePdfFromElement(
        previewReceiptRef.current,
        currentLivePayment.receiptNumber,
        currentLivePayment.clientName,
        currentLivePayment.date,
        { download: true }
      );
      const validation = validatePdfBlob(res.blob, res.base64);
      if (validation.isValid) {
        localBackupService
          .mirrorDocumentDualLocalBackup(
            res.blob,
            res.fileName,
            currentLivePayment,
            currentLivePayment.receiptNumber
          )
          .catch((err) => console.warn('Receipt dual local backup error:', err));
      }
    } catch (err: any) {
      alert('Failed to generate receipt PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (!previewReceiptRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const res = await generatePdfFromElement(
        previewReceiptRef.current,
        currentLivePayment.receiptNumber,
        currentLivePayment.clientName,
        currentLivePayment.date,
        { download: false }
      );
      const shared = await shareDocumentPdf(
        res.blob,
        res.fileName,
        `Payment Receipt: ${currentLivePayment.receiptNumber} - ${profile.name}`,
        `Payment receipt ${currentLivePayment.receiptNumber} for ${currentLivePayment.clientName} of ${formatKsh(currentLivePayment.amount)}.`
      );
      if (!shared) {
        handleDownloadPdf();
      }
    } catch (err: any) {
      console.warn('Share error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full border border-stone-300 flex flex-col max-h-[94vh] overflow-hidden">
        {/* HEADER BAR WITH ACTION TRIGGERS */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-stone-900 text-white shrink-0 gap-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
                Record Payment & Live Receipt Generator
              </h3>
              <p className="text-[11px] text-stone-400">
                Interactive payment entry with live synchronized vector A4 PDF receipt preview
              </p>
            </div>
          </div>

          {/* Action triggers top right */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded border border-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 py-1.5 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-amber-400 rounded border border-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="Download PDF Receipt"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Generating...' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={isGeneratingPdf}
              className="px-2.5 py-1.5 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded border border-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="Share Receipt"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Back / Cancel trigger alongside Save */}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 flex items-center gap-1 transition-colors cursor-pointer ml-1"
              title="Cancel and close editor"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cancel / Back</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Save payment settlement"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save & Record Payment'}</span>
            </button>
          </div>
        </div>

        {/* TWO-COLUMN WORKSPACE: FORM ON LEFT (42%), LIVE STATIC A4 PREVIEW ON RIGHT (58%) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 bg-stone-100 divide-y lg:divide-y-0 lg:divide-x divide-stone-200">
          {/* LEFT COLUMN: INTERACTIVE FORM */}
          <div className="lg:col-span-5 p-4 sm:p-5 overflow-y-auto space-y-4 bg-white">
            {doc && (
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-lg p-3 text-stone-800 text-xs shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-amber-950 border-b border-amber-200/70 pb-1">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    Settling Invoice:
                  </span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-900">
                    {doc.documentNumber}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-stone-500 block font-medium">Invoice Total:</span>
                    <span className="font-semibold text-stone-900">{formatKsh(doc.grandTotal)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-500 block font-medium">Outstanding Balance:</span>
                    <span className="font-bold text-rose-700">{formatKsh(doc.balanceDue || doc.grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 block">
                  Receipt Particulars
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Receipt Number</label>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      className="w-full border border-stone-300 rounded px-2.5 py-1.5 font-mono font-bold text-stone-900 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Client / Guest</label>
                  <select
                    value={clientId}
                    disabled={!!doc}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-medium bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-stone-100"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.kraPin ? `(${c.kraPin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 block">
                  Payment Mode & Amount
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="M-Pesa">M-Pesa (Buy Goods)</option>
                      <option value="Bank Transfer">Bank Transfer / RTGS</option>
                      <option value="Cash">Cash</option>
                      <option value="Credit Card">Credit / Debit Card</option>
                      <option value="Cheque">Bank Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Amount (Ksh) *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={amount || ''}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-bold text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Quick settlement helper buttons */}
                {doc && doc.balanceDue > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setAmount(doc.balanceDue)}
                      className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 hover:bg-emerald-200 font-semibold transition-colors border border-emerald-300"
                    >
                      Pay Full Balance ({formatKsh(doc.balanceDue)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(Math.round(doc.grandTotal * 0.5))}
                      className="text-[11px] px-2 py-0.5 rounded bg-stone-200 text-stone-800 hover:bg-stone-300 font-medium transition-colors"
                    >
                      50% Deposit ({formatKsh(Math.round(doc.grandTotal * 0.5))})
                    </button>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Reference / Transaction Code / Remittance Note
                  </label>
                  <input
                    type="text"
                    value={referenceNote}
                    onChange={(e) => setReferenceNote(e.target.value)}
                    placeholder="e.g. M-Pesa Code: QHD8899201 or KCB Ref: 994827"
                    className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Bottom Triggers (Back/Cancel alongside Save) */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-100 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-stone-500" />
                  <span>Cancel / Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{isSaving ? 'Saving...' : 'Save & Record Payment'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: LIVE STATIC A4 PDF RECEIPT PREVIEW */}
          <div className="lg:col-span-7 p-4 sm:p-5 overflow-y-auto bg-stone-200/70 flex flex-col items-center justify-start">
            <div className="w-full max-w-xl">
              <AutoScalingA4Container
                title={`Live Static A4 Receipt Preview`}
                subtitle="Real-time synchronized official Hotel Damview payment receipt"
                documentNumber={currentLivePayment.receiptNumber}
                actions={
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={isGeneratingPdf}
                      className="px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded flex items-center gap-1 transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-2.5 py-1 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-stone-200 rounded flex items-center gap-1 transition-colors shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                }
              >
                <div ref={previewReceiptRef}>
                  <A4ReceiptPreview payment={currentLivePayment} profile={profile} />
                </div>
              </AutoScalingA4Container>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
