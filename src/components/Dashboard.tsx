import React from 'react';
import {
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  ArrowRight,
  ShieldCheck,
  Calendar,
  CreditCard,
  Building,
  BookOpen,
} from 'lucide-react';
import { BillingDocument, Client, PaymentRecord, HotelProfile } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { DailyRevenueChart } from './DailyRevenueChart';

interface DashboardProps {
  documents: BillingDocument[];
  clients: Client[];
  payments: PaymentRecord[];
  profile: HotelProfile;
  onNavigateToNewDoc: (type: 'QUOTATION' | 'PROFORMA' | 'INVOICE') => void;
  onNavigateToClients: () => void;
  onNavigateToJournal: () => void;
  onNavigateToStatement: () => void;
  onRecordPayment: () => void;
  onEditDocument?: (doc: BillingDocument) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  documents,
  clients,
  payments,
  profile,
  onNavigateToNewDoc,
  onNavigateToClients,
  onNavigateToJournal,
  onNavigateToStatement,
  onRecordPayment,
  onEditDocument,
}) => {
  // Current month & year
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYearStr = `${now.getFullYear()}`;

  // 1. Active Quotations
  const activeQuotations = documents.filter(
    (d) => d.documentType === 'QUOTATION' && d.status !== 'Paid'
  );
  const activeQuotationsValue = activeQuotations.reduce((sum, d) => sum + d.grandTotal, 0);

  // 2. Pending Invoices (Accounts Receivable)
  const pendingInvoices = documents.filter(
    (d) => d.documentType === 'INVOICE' && (d.balanceDue || 0) > 0
  );
  const pendingInvoicesValue = pendingInvoices.reduce((sum, d) => sum + (d.balanceDue || 0), 0);

  // 3. Settled Payments MTD & YTD
  const settledMTD = payments
    .filter((p) => p.date.startsWith(currentMonthStr))
    .reduce((sum, p) => sum + p.amount, 0);

  const settledYTD = payments
    .filter((p) => p.date.startsWith(currentYearStr))
    .reduce((sum, p) => sum + p.amount, 0);

  // 4. Overdue Invoices
  const todayStr = formatDate();
  const overdueInvoices = pendingInvoices.filter((d) => d.dueDate < todayStr);

  // 5. Monthly Revenue Trends (Last 6 months)
  const monthLabels: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    monthLabels.push({ key, label });
  }

  const monthlyData = monthLabels.map(({ key, label }) => {
    const invoiced = documents
      .filter((d) => d.documentType === 'INVOICE' && d.issueDate.startsWith(key))
      .reduce((sum, d) => sum + d.grandTotal, 0);
    const collected = payments
      .filter((p) => p.date.startsWith(key))
      .reduce((sum, p) => sum + p.amount, 0);
    return { month: label, invoiced, collected };
  });

  const maxChartValue = Math.max(
    ...monthlyData.map((m) => Math.max(m.invoiced, m.collected)),
    100000
  );

  // 6. Client Distribution (Top 4 clients by invoiced volume)
  const clientRevenueMap: Record<string, number> = {};
  documents
    .filter((d) => d.documentType === 'INVOICE')
    .forEach((d) => {
      clientRevenueMap[d.clientName] = (clientRevenueMap[d.clientName] || 0) + d.grandTotal;
    });

  const totalInvoicedAll = Object.values(clientRevenueMap).reduce((a, b) => a + b, 0) || 1;
  const topClients = Object.entries(clientRevenueMap)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: Math.round((amount / totalInvoicedAll) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  // Colors for donut & legend
  const donutColors = ['#b45309', '#0284c7', '#059669', '#6366f1'];

  // Recent 5 documents
  const recentDocuments = documents.slice(0, 5);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 text-stone-100 p-5 rounded-lg border border-stone-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">
              Hotel Damview Management System
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Billing & Invoicing Command Dashboard
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            {profile.physicalLocation} &bull; KRA PIN: {profile.kraPin}
          </p>
        </div>

        {/* Standardized Direct Workspace Action Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateToNewDoc('QUOTATION')}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded flex items-center gap-1.5 border border-stone-700 transition-colors shadow-2xs"
            title="Create and open new Quotation form"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            New Quotation
          </button>
          <button
            type="button"
            onClick={() => onNavigateToNewDoc('PROFORMA')}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded flex items-center gap-1.5 border border-stone-700 transition-colors shadow-2xs"
            title="Create and open new Proforma Invoice form"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            New Proforma
          </button>
          <button
            type="button"
            onClick={() => onNavigateToNewDoc('INVOICE')}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors"
            title="Create and open new Tax Invoice form (16% VAT)"
          >
            <Plus className="w-3.5 h-3.5 text-stone-950" />
            New Invoice
          </button>
          <button
            type="button"
            onClick={onRecordPayment}
            className="px-3 py-2 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-xs font-semibold rounded flex items-center gap-1.5 border border-emerald-700/60 transition-colors shadow-2xs"
            title="Record guest or corporate payment settlement"
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            Record Payment
          </button>
          <button
            type="button"
            onClick={onNavigateToStatement}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded flex items-center gap-1.5 border border-stone-700 transition-colors shadow-2xs"
            title="Generate client Statement of Account"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            Statement of Account
          </button>
          <button
            type="button"
            onClick={onNavigateToClients}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded flex items-center gap-1.5 border border-stone-700 transition-colors shadow-2xs"
            title="Register new corporate or private client"
          >
            <Users className="w-3.5 h-3.5 text-stone-400" />
            Register Client
          </button>
        </div>
      </div>

      {/* 4-METRICS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Quotations */}
        <div className="bg-white border border-stone-200 rounded p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Active Quotations</span>
            <span className="p-1 bg-amber-50 text-amber-800 rounded">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-stone-900 tracking-tight">
            {formatKsh(activeQuotationsValue)}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-stone-500">
            <span>{activeQuotations.length} quotes pending client LPO</span>
            <span className="text-amber-700 font-semibold cursor-pointer" onClick={onNavigateToJournal}>
              View &rarr;
            </span>
          </div>
        </div>

        {/* Metric 2: Accounts Receivable (Pending Invoices) */}
        <div className="bg-white border border-stone-200 rounded p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Accounts Receivable</span>
            <span className="p-1 bg-rose-50 text-rose-800 rounded">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-rose-700 tracking-tight">
            {formatKsh(pendingInvoicesValue)}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-stone-500">
            <span>{pendingInvoices.length} invoices ({overdueInvoices.length} overdue)</span>
            <span className="text-rose-700 font-semibold cursor-pointer" onClick={onNavigateToJournal}>
              Collect &rarr;
            </span>
          </div>
        </div>

        {/* Metric 3: Total Settled MTD */}
        <div className="bg-white border border-stone-200 rounded p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Settled (MTD)</span>
            <span className="p-1 bg-emerald-50 text-emerald-800 rounded">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-emerald-800 tracking-tight">
            {formatKsh(settledMTD)}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-stone-500">
            <span>Month-to-Date receipts</span>
            <span className="text-emerald-700 font-semibold cursor-pointer" onClick={onNavigateToStatement}>
              Statements &rarr;
            </span>
          </div>
        </div>

        {/* Metric 4: Total Settled YTD */}
        <div className="bg-white border border-stone-200 rounded p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Settled (YTD)</span>
            <span className="p-1 bg-stone-100 text-stone-800 rounded">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-stone-900 tracking-tight">
            {formatKsh(settledYTD)}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-stone-500">
            <span>Year {currentYearStr} Total collections</span>
            <span className="font-semibold text-stone-700">{clients.length} Clients</span>
          </div>
        </div>
      </div>

      {/* DAILY REVENUE TRENDS & UNPAID INVOICES CHART (RECHARTS) */}
      <DailyRevenueChart documents={documents} payments={payments} />

      {/* VISUAL ANALYTICS: Monthly Revenue Trends (Bar) + Client Distribution (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Monthly Revenue Trends Bar Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-sm text-stone-900">Monthly Revenue & Collection Trends</h3>
              <p className="text-xs text-stone-500">Invoiced vs Collected over the past 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-stone-800 rounded-xs"></span>
                <span className="text-stone-600">Invoiced</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-amber-500 rounded-xs"></span>
                <span className="text-stone-600">Collected</span>
              </div>
            </div>
          </div>

          {/* SVG/CSS Bar Chart */}
          <div className="h-56 flex items-end justify-between gap-3 px-2 pt-4">
            {monthlyData.map((m, idx) => {
              const invoicedHeight = Math.max(8, Math.round((m.invoiced / maxChartValue) * 160));
              const collectedHeight = Math.max(8, Math.round((m.collected / maxChartValue) * 160));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    {/* Invoiced Bar */}
                    <div
                      style={{ height: `${invoicedHeight}px` }}
                      className="w-1/2 max-w-[24px] bg-stone-800 rounded-t-sm hover:opacity-85 transition-all group relative"
                    >
                      <div className="hidden group-hover:block absolute -top-7 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                        {formatKsh(m.invoiced)}
                      </div>
                    </div>

                    {/* Collected Bar */}
                    <div
                      style={{ height: `${collectedHeight}px` }}
                      className="w-1/2 max-w-[24px] bg-amber-500 rounded-t-sm hover:opacity-85 transition-all group relative"
                    >
                      <div className="hidden group-hover:block absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                        {formatKsh(m.collected)}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-stone-600 mt-1">{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Client Distribution (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded p-4 shadow-xs flex flex-col justify-between">
          <div className="border-b border-stone-200 pb-3 mb-3">
            <h3 className="font-bold text-sm text-stone-900">Client Revenue Distribution</h3>
            <p className="text-xs text-stone-500">Top organizations by billing volume</p>
          </div>

          <div className="flex items-center gap-4 py-2">
            {/* SVG Donut Chart */}
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {/* Background track */}
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f4f4f5" strokeWidth="18" />
                {(() => {
                  let accumulatedPercent = 0;
                  const circumference = 2 * Math.PI * 40; // ~251.3
                  return topClients.map((client, i) => {
                    const strokeDasharray = `${(client.percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                    accumulatedPercent += client.percentage;
                    return (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={donutColors[i % donutColors.length]}
                        strokeWidth="18"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-stone-500 uppercase font-semibold">Total</span>
                <span className="text-xs font-bold text-stone-900">Top 4</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2 text-xs">
              {topClients.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: donutColors[i % donutColors.length] }}
                    ></span>
                    <span className="text-stone-700 truncate font-medium">{c.name}</span>
                  </div>
                  <span className="font-bold text-stone-900 shrink-0">{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-stone-100 flex justify-between text-xs text-stone-500">
            <span>Corporate Account Share</span>
            <span className="font-bold text-stone-800">{formatKsh(totalInvoicedAll)}</span>
          </div>
        </div>
      </div>

      {/* RECENT DOCUMENTS ACTIVITY TABLE */}
      <div className="bg-white border border-stone-200 rounded p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
          <div>
            <h3 className="font-bold text-sm text-stone-900">Recent Billing Transactions</h3>
            <p className="text-xs text-stone-500">Latest generated Quotations and Invoices</p>
          </div>
          <button
            type="button"
            onClick={onNavigateToJournal}
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
          >
            Full Journal <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-stone-500 border-b border-stone-200">
                <th className="py-2 px-2">Type</th>
                <th className="py-2 px-2">Doc #</th>
                <th className="py-2 px-2">Client Name</th>
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2 text-right">Amount (Ksh)</th>
                <th className="py-2 px-2 text-right">Balance (Ksh)</th>
                <th className="py-2 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => onEditDocument?.(doc)}
                  className="hover:bg-amber-50/40 cursor-pointer transition-colors group"
                  title="Click to view and edit document in editor"
                >
                  <td className="py-2.5 px-2 font-bold text-slate-700">{doc.documentType}</td>
                  <td className="py-2.5 px-2 font-mono font-bold text-slate-900 group-hover:text-amber-800 flex items-center gap-1">
                    {doc.documentNumber}
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-600 transition-opacity" />
                  </td>
                  <td className="py-2.5 px-2 font-medium text-slate-800">{doc.clientName}</td>
                  <td className="py-2.5 px-2 text-slate-600 font-mono text-[11px]">{doc.issueDate}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-900 tabular-nums">
                    {formatKsh(doc.grandTotal)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold tabular-nums text-slate-700">
                    {doc.documentType === 'QUOTATION' ? '-' : formatKsh(doc.balanceDue || 0)}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        doc.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : doc.status === 'Sent'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {doc.status}
                    </span>
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
