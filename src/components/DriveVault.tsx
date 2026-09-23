import React, { useState } from 'react';
import {
  FolderGit2,
  FileText,
  Download,
  Share2,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  Filter,
  Receipt,
  FileSpreadsheet,
  Building,
  Calendar,
  Cloud,
  HardDrive,
  MessageCircle,
} from 'lucide-react';
import { BillingDocument, PaymentRecord, StatementRecord, HotelProfile } from '../types';

interface DriveVaultProps {
  documents: BillingDocument[];
  payments: PaymentRecord[];
  statements: StatementRecord[];
  profile: HotelProfile;
  onViewDocument: (doc: BillingDocument) => void;
  onSyncToDrive?: () => void;
  isSyncing?: boolean;
}

export const DriveVault: React.FC<DriveVaultProps> = ({
  documents,
  payments,
  statements,
  profile,
  onViewDocument,
  onSyncToDrive,
  isSyncing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<BillingDocument | null>(null);

  // Grouped Vault Documents
  const allVaultItems = [
    ...documents.map((d) => ({
      id: d.id,
      docType: d.documentType,
      number: d.documentNumber,
      clientName: d.clientName,
      clientPhone: d.clientPhone,
      date: d.issueDate,
      amount: d.grandTotal,
      balance: d.balanceDue,
      driveUrl: d.driveFileUrl,
      rawDoc: d,
      category: 'Billing Document',
    })),
    ...statements.map((s) => ({
      id: s.id,
      docType: 'STATEMENT' as const,
      number: s.statementNumber,
      clientName: s.clientName,
      clientPhone: '',
      date: s.issueDate,
      amount: s.closingBalance,
      balance: s.closingBalance,
      driveUrl: s.driveFileUrl,
      rawDoc: null,
      category: 'Statement of Account',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredItems = allVaultItems.filter((item) => {
    const matchSearch =
      item.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = selectedType === 'ALL' || item.docType === selectedType;
    return matchSearch && matchType;
  });

  const handleDownloadPdf = (item: (typeof allVaultItems)[0]) => {
    if (item.rawDoc) {
      onViewDocument(item.rawDoc);
    } else {
      window.print();
    }
  };

  const handleWhatsAppShare = (item: (typeof allVaultItems)[0]) => {
    let phone = item.clientPhone ? item.clientPhone.replace(/[^0-9]/g, '') : '';
    if (phone.startsWith('0')) {
      phone = '254' + phone.substring(1);
    } else if (phone.startsWith('7') || phone.startsWith('1')) {
      phone = '254' + phone;
    }

    const tillInfo = profile?.mpesaTillNumber ? `via M-Pesa Buy Goods Till ${profile.mpesaTillNumber}` : 'via M-Pesa or Bank Transfer';
    const phoneInfo = profile?.phone || 'Hotel Damview';
    const message = encodeURIComponent(
      `Dear ${item.clientName},\n\nPlease find your official ${item.docType} (${item.number}) from Hotel Damview.\nTotal Amount: Ksh ${item.amount.toLocaleString()}.\n\nFor queries or payments ${tillInfo}, contact ${phoneInfo}.\nThank you for choosing Hotel Damview.`
    );

    const url = phone
      ? `https://wa.me/${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-stone-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-stone-900 text-amber-400 rounded-lg">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Google Drive & Document Vault</h2>
            <p className="text-xs text-stone-500">
              Central repository of all generated PDF archives, automated cloud backup & WhatsApp dispatch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSyncToDrive && (
            <button
              type="button"
              onClick={onSyncToDrive}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing to Drive...' : 'Run Cloud Vault Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Cloud Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
              Indexed Vault Records
            </span>
            <div className="text-lg font-bold text-stone-900">{allVaultItems.length} Files</div>
            <span className="text-[11px] text-emerald-600 font-medium">100% Offline Accessible</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
              Google Drive Target
            </span>
            <div className="text-xs font-bold text-stone-900 truncate max-w-[180px]">
              {profile.googleSheetsSpreadsheetId
                ? 'Hotel Damview Google Drive'
                : 'Linked Workspace Vault'}
            </div>
            <span className="text-[11px] text-sky-600 font-medium">Cloud Mirroring Active</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
              Direct WhatsApp Dispatch
            </span>
            <div className="text-xs font-bold text-stone-900">+254 Kenya Integration</div>
            <span className="text-[11px] text-amber-600 font-medium">1-Click Client Delivery</span>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vault files by document number or client name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-300 rounded-md px-3 py-2 text-stone-700 focus:outline-hidden"
          >
            <option value="ALL">All Types</option>
            <option value="INVOICE">Tax Invoices</option>
            <option value="PROFORMA">Proforma Invoices</option>
            <option value="QUOTATION">Quotations</option>
            <option value="STATEMENT">Statements of Account</option>
          </select>
        </div>
      </div>

      {/* Document Grid / Table */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                <th className="p-3 font-bold">Document Serial</th>
                <th className="p-3 font-bold">Type</th>
                <th className="p-3 font-bold">Client / Recipient</th>
                <th className="p-3 font-bold">Date Issued</th>
                <th className="p-3 font-bold text-right">Total (Ksh)</th>
                <th className="p-3 font-bold">Drive Cloud State</th>
                <th className="p-3 font-bold text-right">Vault Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-amber-700">{item.number}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                      {item.docType}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-stone-900">{item.clientName}</td>
                  <td className="p-3 text-stone-600">{item.date}</td>
                  <td className="p-3 text-right font-mono font-bold text-stone-900">
                    {item.amount.toLocaleString()}
                  </td>
                  <td className="p-3">
                    {item.driveUrl ? (
                      <a
                        href={item.driveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-[11px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>In Google Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-stone-500 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>Local Vault (Offline)</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.rawDoc && (
                        <button
                          type="button"
                          onClick={() => onViewDocument(item.rawDoc!)}
                          title="Open Document"
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(item)}
                        title="Download High-Res PDF"
                        className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded font-bold"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWhatsAppShare(item)}
                        title="Share via WhatsApp"
                        className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
