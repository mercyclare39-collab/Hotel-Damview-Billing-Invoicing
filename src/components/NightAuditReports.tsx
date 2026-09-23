import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  FileSpreadsheet,
  Printer,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Building,
  Bed,
  Utensils,
  Plus,
  Trash2,
  Edit2,
  X,
} from 'lucide-react';
import {
  BillingDocument,
  PaymentRecord,
  Reservation,
  POSOrder,
  ExpenseRecord,
  HotelProfile,
  Client,
} from '../types';
import { dbService } from '../services/db';

interface NightAuditReportsProps {
  documents: BillingDocument[];
  payments: PaymentRecord[];
  clients: Client[];
  profile: HotelProfile;
}

export const NightAuditReports: React.FC<NightAuditReportsProps> = ({
  documents,
  payments,
  clients,
  profile,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'aging' | 'vat' | 'expenses'>('audit');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [posOrders, setPOSOrders] = useState<POSOrder[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);

  // Expense modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expCategory, setExpCategory] = useState<ExpenseRecord['category']>('Kitchen & Food Supplies');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expPaymentMode, setExpPaymentMode] = useState<ExpenseRecord['paymentMode']>('M-Pesa');
  const [expReceiptRef, setExpReceiptRef] = useState('');

  const loadData = async () => {
    const res = await dbService.getReservations();
    const pos = await dbService.getPOSOrders();
    const exp = await dbService.getExpenses();
    setReservations(res);
    setPOSOrders(pos);
    setExpenses(exp);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Financial Computations ---
  // Invoices issued
  const totalInvoiced = documents
    .filter((d) => d.documentType === 'INVOICE')
    .reduce((sum, d) => sum + d.grandTotal, 0);

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  const totalOutstanding = documents
    .filter((d) => d.documentType === 'INVOICE')
    .reduce((sum, d) => sum + d.balanceDue, 0);

  // POS Sales
  const totalPOSSales = posOrders.reduce((sum, p) => sum + p.grandTotal, 0);

  // Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Net Operating Cash
  const netCashFlow = totalCollected + totalPOSSales - totalExpenses;

  // VAT Computations
  const totalVATInvoiced = documents
    .filter((d) => d.documentType === 'INVOICE')
    .reduce((sum, d) => sum + d.vatAmount, 0);

  const totalPOSVAT = posOrders.reduce((sum, p) => sum + p.vatAmount, 0);
  const totalVATLiability = totalVATInvoiced + totalPOSVAT;

  // Aging Analysis
  const now = new Date().getTime();
  const agingBands = {
    current: 0, // 0-30 days
    days31to60: 0,
    days61to90: 0,
    days90Plus: 0,
  };

  documents
    .filter((d) => d.documentType === 'INVOICE' && d.balanceDue > 0)
    .forEach((doc) => {
      const docDate = new Date(doc.issueDate).getTime();
      const ageDays = Math.floor((now - docDate) / (1000 * 60 * 60 * 24));
      if (ageDays <= 30) agingBands.current += doc.balanceDue;
      else if (ageDays <= 60) agingBands.days31to60 += doc.balanceDue;
      else if (ageDays <= 90) agingBands.days61to90 += doc.balanceDue;
      else agingBands.days90Plus += doc.balanceDue;
    });

  // Daily Audit Calculations (for selected auditDate)
  const dailyPayments = payments.filter((p) => p.date === auditDate);
  const dailyPOS = posOrders.filter((p) => p.createdAt.startsWith(auditDate));
  const dailyExpenses = expenses.filter((e) => e.date === auditDate);

  const dailyMpesa =
    dailyPayments
      .filter((p) => p.paymentMode === 'M-Pesa')
      .reduce((sum, p) => sum + p.amount, 0) +
    dailyPOS
      .filter((p) => p.paymentMode === 'M-Pesa')
      .reduce((sum, p) => sum + p.grandTotal, 0);

  const dailyCash =
    dailyPayments
      .filter((p) => p.paymentMode === 'Cash')
      .reduce((sum, p) => sum + p.amount, 0) +
    dailyPOS
      .filter((p) => p.paymentMode === 'Cash')
      .reduce((sum, p) => sum + p.grandTotal, 0);

  const dailyBank = dailyPayments
    .filter((p) => p.paymentMode === 'Bank Transfer' || p.paymentMode === 'Cheque')
    .reduce((sum, p) => sum + p.amount, 0);

  const dailyTotalInflow = dailyMpesa + dailyCash + dailyBank;
  const dailyTotalOutflow = dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const dailyNetCash = dailyTotalInflow - dailyTotalOutflow;

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextExpNum = await dbService.getNextExpenseNumber();
    const newExp: ExpenseRecord = {
      id: 'exp-' + Date.now(),
      expenseNumber: nextExpNum,
      category: expCategory,
      description: expDescription.trim(),
      amount: expAmount,
      date: new Date().toISOString().split('T')[0],
      paidTo: expPaidTo.trim(),
      paymentMode: expPaymentMode,
      receiptRef: expReceiptRef.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await dbService.saveExpense(newExp);
    await loadData();
    setIsExpenseModalOpen(false);
    setExpDescription('');
    setExpAmount(0);
    setExpPaidTo('');
    setExpReceiptRef('');
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Delete this expense record?')) {
      await dbService.deleteExpense(id);
      await loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-stone-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Night Audit & Financial Intelligence</h2>
            <p className="text-xs text-stone-500">
              End-of-day managerial closure, 30-90 day debtor aging ledger, KRA 16% VAT & expense audits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            {(
              [
                { key: 'audit', label: 'Daily Night Audit' },
                { key: 'aging', label: 'Debtor Aging' },
                { key: 'vat', label: 'KRA 16% VAT' },
                { key: 'expenses', label: 'Expenses & Petty Cash' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-white shadow-xs text-stone-900 font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Global KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Total Invoiced Turnover
          </span>
          <div className="text-xl font-bold text-stone-900 mt-1 font-mono">
            Ksh {totalInvoiced.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">Official Tax Invoices</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
            Total Collections (Receipts)
          </span>
          <div className="text-xl font-bold text-emerald-900 mt-1 font-mono">
            Ksh {totalCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Settled funds</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-rose-200 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
            Total Unpaid Debtors
          </span>
          <div className="text-xl font-bold text-rose-900 mt-1 font-mono">
            Ksh {totalOutstanding.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-700 mt-0.5">Pending corporate collection</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-purple-200 bg-purple-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider">
            Operating Net Flow
          </span>
          <div className="text-xl font-bold text-purple-900 mt-1 font-mono">
            Ksh {netCashFlow.toLocaleString()}
          </div>
          <div className="text-[11px] text-purple-700 mt-0.5">Inflows less total expenses</div>
        </div>
      </div>

      {/* TAB 1: DAILY NIGHT AUDIT */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Daily Night Audit & Managerial Closure Report
              </h3>
              <p className="text-xs text-stone-500">
                Cross-reconciliation of front-desk receipts, restaurant till collections, bank deposits and petty cash vouchers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-stone-700">Audit Date:</label>
              <input
                type="date"
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className="px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded font-semibold text-stone-800"
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Audit Summary</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Inflows breakdown */}
            <div className="border border-stone-200 rounded-lg p-4 space-y-3 bg-stone-50/50">
              <div className="flex items-center justify-between font-bold text-xs text-stone-900 border-b border-stone-200 pb-2">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  Daily Cash & Digital Inflows
                </span>
                <span className="font-mono">Ksh {dailyTotalInflow.toLocaleString()}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-stone-700">
                  <span>M-Pesa Buy Goods Collections:</span>
                  <span className="font-mono font-semibold">Ksh {dailyMpesa.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Cash Collections (Front Desk & POS):</span>
                  <span className="font-mono font-semibold">Ksh {dailyCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Bank Transfers / Cheques:</span>
                  <span className="font-mono font-semibold">Ksh {dailyBank.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-500 text-[11px] pt-2 border-t border-stone-200">
                  <span>Processed Receipts Count:</span>
                  <span className="font-mono font-bold">{dailyPayments.length + dailyPOS.length}</span>
                </div>
              </div>
            </div>

            {/* Outflows breakdown */}
            <div className="border border-stone-200 rounded-lg p-4 space-y-3 bg-stone-50/50">
              <div className="flex items-center justify-between font-bold text-xs text-stone-900 border-b border-stone-200 pb-2">
                <span className="flex items-center gap-1.5 text-rose-800">
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  Daily Operating Expenses & Vouchers
                </span>
                <span className="font-mono">Ksh {dailyTotalOutflow.toLocaleString()}</span>
              </div>

              <div className="space-y-2 text-xs">
                {dailyExpenses.length === 0 ? (
                  <p className="text-stone-400 italic text-center py-4">
                    No petty cash or purchases recorded for {auditDate}.
                  </p>
                ) : (
                  dailyExpenses.map((exp) => (
                    <div key={exp.id} className="flex justify-between text-stone-700">
                      <span className="truncate max-w-[160px]">{exp.category}:</span>
                      <span className="font-mono font-semibold">
                        Ksh {exp.amount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Net Closure reconciliation */}
            <div className="border border-amber-300 rounded-lg p-4 space-y-3 bg-amber-50/40 flex flex-col justify-between">
              <div>
                <div className="font-bold text-xs text-stone-900 border-b border-amber-200 pb-2 flex items-center justify-between">
                  <span>Net Daily Drawer Balance</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-stone-700">
                    <span>Total Day Collections:</span>
                    <span className="font-mono font-bold text-emerald-800">
                      + Ksh {dailyTotalInflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-700">
                    <span>Total Day Outflows:</span>
                    <span className="font-mono font-bold text-rose-800">
                      - Ksh {dailyTotalOutflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-amber-200 flex justify-between font-bold text-sm text-stone-900">
                    <span>Net Closing Cash:</span>
                    <span className="font-mono text-base text-amber-800">
                      Ksh {dailyNetCash.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-amber-200/60 text-[11px] text-stone-600 flex justify-between">
                <span>Audited By: Duty Manager</span>
                <span>Status: Reconciled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEBTOR AGING */}
      {activeTab === 'aging' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Corporate Debtor Aging Analysis (Ksh)
            </h3>
            <p className="text-xs text-stone-500">
              Categorization of outstanding balances by chronological overdue aging bands.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase">
                Current (0 - 30 Days)
              </span>
              <div className="text-xl font-bold text-emerald-950 font-mono mt-1">
                Ksh {agingBands.current.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-700">Within statutory credit terms</span>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-800 uppercase">31 - 60 Days</span>
              <div className="text-xl font-bold text-amber-950 font-mono mt-1">
                Ksh {agingBands.days31to60.toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-700">Follow-up reminder due</span>
            </div>

            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
              <span className="text-[11px] font-bold text-orange-800 uppercase">61 - 90 Days</span>
              <div className="text-xl font-bold text-orange-950 font-mono mt-1">
                Ksh {agingBands.days61to90.toLocaleString()}
              </div>
              <span className="text-[11px] text-orange-700">Overdue demand notice</span>
            </div>

            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200">
              <span className="text-[11px] font-bold text-rose-800 uppercase">Over 90 Days</span>
              <div className="text-xl font-bold text-rose-950 font-mono mt-1">
                Ksh {agingBands.days90Plus.toLocaleString()}
              </div>
              <span className="text-[11px] text-rose-700">Escalated debt recovery</span>
            </div>
          </div>

          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                  <th className="p-3 font-bold">Client / Company</th>
                  <th className="p-3 font-bold">KRA PIN</th>
                  <th className="p-3 font-bold text-right">0-30 Days</th>
                  <th className="p-3 font-bold text-right">31-60 Days</th>
                  <th className="p-3 font-bold text-right">61-90 Days</th>
                  <th className="p-3 font-bold text-right">90+ Days</th>
                  <th className="p-3 font-bold text-right">Total Debt (Ksh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {clients.map((cli) => {
                  const clientDocs = documents.filter(
                    (d) => d.clientId === cli.id && d.documentType === 'INVOICE' && d.balanceDue > 0
                  );
                  if (clientDocs.length === 0) return null;

                  let b0 = 0,
                    b31 = 0,
                    b61 = 0,
                    b90 = 0;
                  clientDocs.forEach((doc) => {
                    const docDate = new Date(doc.issueDate).getTime();
                    const age = Math.floor((now - docDate) / (1000 * 60 * 60 * 24));
                    if (age <= 30) b0 += doc.balanceDue;
                    else if (age <= 60) b31 += doc.balanceDue;
                    else if (age <= 90) b61 += doc.balanceDue;
                    else b90 += doc.balanceDue;
                  });

                  const totalDebt = b0 + b31 + b61 + b90;

                  return (
                    <tr key={cli.id} className="hover:bg-stone-50">
                      <td className="p-3 font-semibold text-stone-900">{cli.name}</td>
                      <td className="p-3 font-mono text-stone-600 uppercase">{cli.kraPin || '—'}</td>
                      <td className="p-3 text-right font-mono text-stone-700">
                        {b0 > 0 ? b0.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700 font-semibold">
                        {b31 > 0 ? b31.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right font-mono text-orange-700 font-semibold">
                        {b61 > 0 ? b61.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-700 font-bold">
                        {b90 > 0 ? b90.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-stone-900">
                        {totalDebt.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: KRA 16% VAT */}
      {activeTab === 'vat' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Kenya Revenue Authority (KRA) 16% VAT Statutory Report
              </h3>
              <p className="text-xs text-stone-500">
                Hotel Damview KRA PIN: <strong className="font-mono">{profile.kraPin}</strong> • VAT Rate: 16%
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export Tax Schedule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-semibold text-stone-500 uppercase">
                Gross Taxable Turnover
              </span>
              <div className="text-xl font-bold text-stone-900 font-mono mt-1">
                Ksh {(totalInvoiced - totalVATInvoiced).toLocaleString()}
              </div>
              <span className="text-[11px] text-stone-500">Net of 16% VAT</span>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-300">
              <span className="text-[11px] font-bold text-amber-900 uppercase">
                16% Output VAT Liability
              </span>
              <div className="text-xl font-bold text-amber-900 font-mono mt-1">
                Ksh {totalVATLiability.toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-700">Payable on iTax 20th deadline</span>
            </div>

            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase">
                Gross Invoiced Total
              </span>
              <div className="text-xl font-bold text-emerald-900 font-mono mt-1">
                Ksh {(totalInvoiced + totalPOSSales).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-700">Combined Hospitality & Dining</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXPENSES & PETTY CASH */}
      {activeTab === 'expenses' && (
        <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Hotel Operating Expenses & Petty Cash Vouchers
              </h3>
              <p className="text-xs text-stone-500">
                Track butchery purchases, fresh market supplies, diesel generator fuel, laundry and KPLC tokens.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense Voucher</span>
            </button>
          </div>

          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                  <th className="p-3 font-bold">Voucher #</th>
                  <th className="p-3 font-bold">Category</th>
                  <th className="p-3 font-bold">Description</th>
                  <th className="p-3 font-bold">Paid To (Vendor)</th>
                  <th className="p-3 font-bold">Payment Mode</th>
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 font-bold text-right">Amount (Ksh)</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-stone-50">
                    <td className="p-3 font-mono font-bold text-amber-700">{exp.expenseNumber}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3 text-stone-800">{exp.description}</td>
                    <td className="p-3 font-medium text-stone-900">{exp.paidTo}</td>
                    <td className="p-3 text-stone-600">{exp.paymentMode}</td>
                    <td className="p-3 text-stone-600">{exp.date}</td>
                    <td className="p-3 text-right font-mono font-bold text-rose-700">
                      {exp.amount.toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Record Operating Expense Voucher</h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Expense Category *</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-semibold text-stone-900"
                >
                  <option value="Kitchen & Food Supplies">Kitchen & Food Supplies</option>
                  <option value="Beverages & Bar Restock">Beverages & Bar Restock</option>
                  <option value="Utilities (Water/Power)">Utilities (Water/Power)</option>
                  <option value="Housekeeping & Laundry">Housekeeping & Laundry</option>
                  <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                  <option value="Staff & Casual Wages">Staff & Casual Wages</option>
                  <option value="Administrative & Other">Administrative & Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="e.g. Fresh butchery meat & vegetables from Machakos Market"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Amount (Ksh) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Payment Method</label>
                  <select
                    value={expPaymentMode}
                    onChange={(e) => setExpPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Cash">Cash (Petty Cash)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Paid To (Vendor Name)</label>
                <input
                  type="text"
                  required
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  placeholder="e.g. Machakos Farmers Fresh Produce"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Vendor Receipt / Invoice Ref (Optional)
                </label>
                <input
                  type="text"
                  value={expReceiptRef}
                  onChange={(e) => setExpReceiptRef(e.target.value)}
                  placeholder="e.g. REC-88741 or M-Pesa Code"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded text-stone-700 hover:bg-stone-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded shadow-xs"
                >
                  Save Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
