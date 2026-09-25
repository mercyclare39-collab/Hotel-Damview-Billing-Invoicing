import React, { useState, useRef, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  Download,
  ExternalLink,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  CreditCard,
  Building,
  User,
  X,
  FileText,
  Share2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { PaymentRecord, HotelProfile, Client, BillingDocument } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { A4ReceiptPreview } from './A4ReceiptPreview';
import { AutoScalingA4Container } from './AutoScalingA4Container';
import {
  generatePdfFromElement,
  universalSharePdfDocument,
  getReceiptOperationalSummary,
  validatePdfBlob,
  printPdfBlob,
} from '../utils/pdfGenerator';
import { exportTableToXlsx } from '../utils/excelExporter';
import { localBackupService } from '../services/localBackupService';
import { usePersistentSort, SortableHeader } from '../hooks/usePersistentSort';

interface ReceiptsManagerProps {
  payments: PaymentRecord[];
  clients: Client[];
  documents: BillingDocument[];
  profile: HotelProfile;
  onRecordNewPayment: () => void;
  onViewDocument?: (docId: string) => void;
  onDeletePayment?: (
    payment: PaymentRecord,
    options?: { cascadeSheet?: boolean; cascadeDrive?: boolean }
  ) => Promise<void>;
}

export const ReceiptsManager: React.FC<ReceiptsManagerProps> = ({
  payments,
  clients,
  documents,
  profile,
  onRecordNewPayment,
  onViewDocument,
  onDeletePayment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(
    payments.length > 0 ? payments[0] : null
  );
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentRecord | null>(null);
  const [cascadeSheet, setCascadeSheet] = useState(true);
  const [cascadeDrive, setCascadeDrive] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  const handleConfirmDelete = async () => {
    if (!paymentToDelete) return;
    setIsDeleting(true);
    try {
      if (onDeletePayment) {
        await onDeletePayment(paymentToDelete, { cascadeSheet, cascadeDrive });
      }
      if (selectedPayment?.id === paymentToDelete.id) {
        const remaining = payments.filter((p) => p.id !== paymentToDelete.id);
        setSelectedPayment(remaining.length > 0 ? remaining[0] : null);
      }
      setIsPreviewModalOpen(false);
      setPaymentToDelete(null);
    } catch (err) {
      console.error('Failed to delete payment receipt:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Persistent multi-column table sorting hook
  const { sortConfig, toggleSort, sortData } = usePersistentSort<PaymentRecord>(
    'receipts_register',
    'date',
    'desc'
  );

  // Filtered payments
  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.documentNumber && p.documentNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.referenceNote && p.referenceNote.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMode = paymentModeFilter === 'ALL' || p.paymentMode === paymentModeFilter;

    return matchesSearch && matchesMode;
  });

  // Sort filtered payments with persistent multi-column comparator
  const sortedPayments = useMemo(() => {
    return sortData(filteredPayments, {
      amount: (p) => p.amount,
      date: (p) => p.date,
      receiptNumber: (p) => p.receiptNumber,
      clientName: (p) => p.clientName,
      paymentMode: (p) => p.paymentMode,
    });
  }, [filteredPayments, sortData]);

  const totalRevenueCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const handlePrint = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsPreviewModalOpen(true);
    setTimeout(async () => {
      const el =
        document.getElementById(`modal-a4-receipt-${payment.receiptNumber}`) ||
        document.getElementById(`a4-receipt-${payment.receiptNumber}`);
      if (el) {
        try {
          const res = await generatePdfFromElement(
            el,
            payment.receiptNumber,
            payment.clientName,
            payment.date,
            { download: false }
          );
          await printPdfBlob(res.blob);
        } catch {
          window.print();
        }
      } else {
        window.print();
      }
    }, 250);
  };

  const handleDownloadPdf = async (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsPreviewModalOpen(true);
    setIsGeneratingPdf(true);
    setTimeout(async () => {
      const el =
        document.getElementById(`modal-a4-receipt-${payment.receiptNumber}`) ||
        document.getElementById(`a4-receipt-${payment.receiptNumber}`);
      if (el) {
        try {
          const res = await generatePdfFromElement(
            el,
            payment.receiptNumber,
            payment.clientName,
            payment.date,
            { download: true }
          );
          const validation = validatePdfBlob(res.blob, res.base64);
          if (validation.isValid) {
            localBackupService
              .savePdfToLocalArchive(res.blob, res.fileName, {
                documentNumber: payment.receiptNumber,
              })
              .catch((err) => console.warn('Receipt local backup error:', err));
          }
        } catch (err) {
          console.error('Failed to generate receipt PDF:', err);
          window.print();
        }
      } else {
        window.print();
      }
      setIsGeneratingPdf(false);
    }, 250);
  };

  const handleSharePdf = async (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsPreviewModalOpen(true);
    setIsGeneratingPdf(true);
    setTimeout(async () => {
      const el =
        document.getElementById(`modal-a4-receipt-${payment.receiptNumber}`) ||
        document.getElementById(`a4-receipt-${payment.receiptNumber}`);
      if (el) {
        try {
          const res = await generatePdfFromElement(
            el,
            payment.receiptNumber,
            payment.clientName,
            payment.date,
            { download: false }
          );
          const summaryText = getReceiptOperationalSummary(payment, profile);
          const client = clients.find(
            (c) => c.id === payment.clientId || c.name.toLowerCase() === payment.clientName.toLowerCase()
          );
          await universalSharePdfDocument({
            blob: res.blob,
            fileName: res.fileName,
            title: `Receipt ${payment.receiptNumber} - ${profile.name}`,
            summaryText,
            clientPhone: client?.phone,
            driveUrl: payment.driveFileUrl,
          });
        } catch (err) {
          console.error('Failed to share receipt PDF:', err);
        }
      }
      setIsGeneratingPdf(false);
    }, 250);
  };

  const handleExportXlsx = async () => {
    if (filteredPayments.length === 0) {
      alert('No receipt records to export in the current view.');
      return;
    }

    const columns = [
      { header: 'Receipt #', key: 'receiptNumber', type: 'code' as const, width: 14 },
      { header: 'Date', key: 'date', type: 'date' as const, width: 13 },
      { header: 'Payer / Guest Name', key: 'clientName', type: 'text' as const, width: 26 },
      { header: 'Settled Doc #', key: 'documentNumber', type: 'code' as const, width: 15 },
      { header: 'Payment Mode', key: 'paymentMode', type: 'text' as const, width: 16 },
      { header: 'Amount Paid (Ksh)', key: 'amount', type: 'currency' as const, width: 18 },
      { header: 'Reference / M-Pesa Code', key: 'referenceNote', type: 'text' as const, width: 22 },
    ];

    const data = filteredPayments.map((p) => ({
      receiptNumber: p.receiptNumber,
      date: p.date,
      clientName: p.clientName,
      documentNumber: p.documentNumber || '-',
      paymentMode: p.paymentMode,
      amount: p.amount,
      referenceNote: p.referenceNote || '-',
    }));

    await exportTableToXlsx({
      title: 'Payment Receipts & Settlements Register',
      sheetName: 'Receipts_Journal',
      profile,
      columns,
      data,
      filename: `HotelDamview_Receipts_Register_${formatDate()}.xlsx`,
    });
  };

  return (
    <div className="flex flex-col h-full bg-stone-100/70 overflow-hidden">
      {/* Top Action Bar */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-stone-900 font-bold text-lg">
            <Receipt className="w-5 h-5 text-amber-600" />
            <span>Payment Receipts Journal</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
              {payments.length} Recorded
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time receipt issuance, settlements registry, and printable A4 compliance vouchers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block pr-3 border-r border-stone-200">
            <div className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">Total Settlements</div>
            <div className="text-base font-bold text-emerald-700">{formatKsh(totalRevenueCollected)}</div>
          </div>

          <button
            type="button"
            onClick={handleExportXlsx}
            className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs px-3.5 py-2 rounded-lg border border-stone-300 transition-colors cursor-pointer"
            title="Export receipts register to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={onRecordNewPayment}
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Settlement</span>
          </button>
        </div>
      </header>

      {/* Unified Continuous-Scroll Receipts Workspace */}
      <div className="flex-1 overflow-y-auto bg-stone-100/60 p-4 md:p-6 space-y-6">
        {/* Top Section: Search, Filters & Receipts Table Card */}
        <div className="max-w-6xl mx-auto bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search receipts by #, guest name, invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <select
                value={paymentModeFilter}
                onChange={(e) => setPaymentModeFilter(e.target.value)}
                className="text-xs bg-white border border-stone-300 rounded-md px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">All Payment Modes</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Receipts Table */}
          <div className="overflow-x-auto divide-y divide-stone-200">
            {sortedPayments.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-100 text-stone-700 font-semibold sticky top-0 z-10">
                  <tr>
                    <SortableHeader column="receiptNumber" label="Receipt #" currentSort={sortConfig} onSort={toggleSort} />
                    <SortableHeader column="date" label="Date" currentSort={sortConfig} onSort={toggleSort} defaultDirection="desc" />
                    <SortableHeader column="clientName" label="Guest / Client" currentSort={sortConfig} onSort={toggleSort} />
                    <SortableHeader column="paymentMode" label="Mode" currentSort={sortConfig} onSort={toggleSort} />
                    <SortableHeader column="amount" label="Amount" currentSort={sortConfig} onSort={toggleSort} align="right" defaultDirection="desc" />
                    <th className="px-4 py-2.5 text-center">Sync / Remote</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sortedPayments.map((payment) => {
                    const isSelected = selectedPayment?.id === payment.id;
                    return (
                      <tr
                        key={payment.id}
                        onClick={() => {
                          setSelectedPayment(payment);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50/90 font-medium' : 'hover:bg-stone-50/80'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-stone-900 whitespace-nowrap">
                          {payment.receiptNumber}
                        </td>
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                          {formatDate(payment.date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-stone-900 truncate max-w-[200px]">
                            {payment.clientName}
                          </div>
                          {payment.documentNumber && (
                            <div className="text-[10px] text-stone-500 font-mono flex items-center gap-1">
                              <span>For:</span>
                              <span className="text-amber-800 font-semibold">{payment.documentNumber}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                            <CreditCard className="w-2.5 h-2.5" />
                            {payment.paymentMode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-stone-900 tabular-decimal whitespace-nowrap">
                          {formatKsh(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {payment.driveFileUrl ? (
                            <a
                              href={payment.driveFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors"
                              title="Open archived PDF in Google Drive"
                            >
                              <ExternalLink className="w-3 h-3 text-amber-700" />
                              <span>Drive PDF</span>
                            </a>
                          ) : payment.syncedToGoogle ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Synced</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400 italic">Local</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleSharePdf(payment)}
                              className="p-1.5 text-stone-600 hover:text-stone-900 rounded hover:bg-stone-200/60 transition-colors cursor-pointer"
                              title="Share Receipt (Vector PDF & Summary)"
                            >
                              <Share2 className="w-3.5 h-3.5 text-stone-700" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setIsPreviewModalOpen(true);
                              }}
                              className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200/60"
                              title="Full Screen Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrint(payment)}
                              className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200/60"
                              title="Print Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentToDelete(payment)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="Delete Receipt Voucher"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-16 text-stone-500">
                <Receipt className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <p className="font-semibold text-stone-700">No Receipts Found</p>
                <p className="text-xs text-stone-400 mt-1">
                  {searchQuery ? 'Try modifying your search or filter' : 'Record a new settlement to issue a receipt'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Live Static Auto-Scaling A4 Receipt Preview */}
        {selectedPayment && (
          <div className="max-w-6xl mx-auto">
            <AutoScalingA4Container
              title={`Live Static A4 Receipt Voucher Preview: ${selectedPayment.receiptNumber}`}
              subtitle="Official Hotel Damview Receipt Voucher • Auto-scaled vector print output"
              documentNumber={selectedPayment.receiptNumber}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedPayment)}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint(selectedPayment)}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-amber-400 rounded transition-colors shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSharePdf(selectedPayment)}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded transition-colors shadow-2xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentToDelete(selectedPayment)}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded transition-colors shadow-2xs"
                    title="Delete Receipt Voucher"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              }
            >
              <A4ReceiptPreview
                ref={receiptPrintRef}
                payment={selectedPayment}
                profile={profile}
              />
            </AutoScalingA4Container>
          </div>
        )}
      </div>

      {/* Full-Screen PDF Preview Modal */}
      {isPreviewModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-4 animate-fade-in no-print">
          <div className="bg-white rounded-t-lg border border-stone-300 px-4 py-3 flex items-center justify-between shadow-md max-w-4xl mx-auto w-full shrink-0">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-stone-900 text-sm">
                Receipt Voucher: {selectedPayment.receiptNumber}
              </span>
              <span className="text-xs text-stone-500 hidden sm:inline">
                ({selectedPayment.clientName} - {formatKsh(selectedPayment.amount)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPdf(selectedPayment)}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrint(selectedPayment)}
                className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded flex items-center gap-1 border border-stone-200 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => handleSharePdf(selectedPayment)}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded flex items-center gap-1 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentToDelete(selectedPayment)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-600 border border-stone-300 rounded flex items-center gap-1 transition-colors"
                title="Delete Receipt"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100 transition-colors ml-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-stone-800/90 rounded-b-lg max-w-4xl mx-auto w-full">
            <div id={`modal-a4-receipt-${selectedPayment.receiptNumber}`} className="scale-[0.75] sm:scale-[0.88] origin-top bg-white shadow-2xl">
              <A4ReceiptPreview payment={selectedPayment} profile={profile} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Receipt Confirmation Modal */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 animate-fade-in border border-stone-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900">Delete Payment Receipt?</h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              You are about to delete receipt{' '}
              <strong className="text-stone-900 font-mono">{paymentToDelete.receiptNumber}</strong> for{' '}
              <strong className="text-stone-900">{paymentToDelete.clientName}</strong> ({formatKsh(paymentToDelete.amount)}).
            </p>

            <div className="bg-stone-50 border border-stone-200 rounded p-3 space-y-2.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                <input type="checkbox" checked disabled className="rounded text-stone-900" />
                <span>
                  Remove from Local Database (IndexedDB)
                  <span className="text-[11px] text-stone-500 block font-normal">
                    Automatically recalculates the outstanding balance on the linked invoice.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                <input
                  type="checkbox"
                  checked={cascadeSheet}
                  onChange={(e) => setCascadeSheet(e.target.checked)}
                  className="rounded text-stone-900"
                />
                <span>
                  Delete corresponding row in Google Sheets ledger
                  <span className="text-[11px] text-stone-500 block font-normal">
                    Purges receipt from Receipts tab and reconciles remote invoice balance.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                <input
                  type="checkbox"
                  checked={cascadeDrive}
                  onChange={(e) => setCascadeDrive(e.target.checked)}
                  className="rounded text-stone-900"
                />
                <span>Purge &amp; trash PDF voucher in Google Drive</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded bg-white hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Receipt...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Receipt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
