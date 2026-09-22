import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Layers,
  BarChart3,
  Activity,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { BillingDocument, PaymentRecord } from '../types';
import { formatKsh } from '../utils/formatters';

interface DailyRevenueChartProps {
  documents: BillingDocument[];
  payments: PaymentRecord[];
  className?: string;
}

export const DailyRevenueChart: React.FC<DailyRevenueChartProps> = ({
  documents,
  payments,
  className = '',
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-indexed

  // Month selector state: defaults to current month
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => {
    return `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
  });

  const [chartView, setChartView] = useState<'composed' | 'area' | 'cumulative'>('composed');

  // Generate list of available months (last 6 months) for selector
  const availableMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(currentYear, currentMonthIndex - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      months.push({ value: ym, label });
    }
    return months;
  }, [currentYear, currentMonthIndex]);

  // Extract selected year and month
  const [selYear, selMonth] = useMemo(() => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    return [y, m];
  }, [selectedYearMonth]);

  // Compute number of days in the selected month
  const daysInMonth = useMemo(() => {
    return new Date(selYear, selMonth, 0).getDate();
  }, [selYear, selMonth]);

  // Selected month label
  const monthName = useMemo(() => {
    const d = new Date(selYear, selMonth - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selYear, selMonth]);

  // Generate daily data series for the entire month
  const {
    dailyData,
    totalRevenueMTD,
    totalInvoicedMTD,
    totalUnpaidMTD,
    unpaidCountMTD,
    collectionRate,
    peakRevenueDay,
    peakRevenueAmount,
  } = useMemo(() => {
    // Filter invoices in the selected month
    const monthInvoices = documents.filter(
      (d) => d.documentType === 'INVOICE' && d.issueDate.startsWith(selectedYearMonth)
    );

    // Filter payments in the selected month
    const monthPayments = payments.filter((p) => p.date.startsWith(selectedYearMonth));

    let runningRevenue = 0;
    let runningUnpaid = 0;
    let peakDay = 1;
    let peakAmt = 0;

    const data = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayFormatted = String(day).padStart(2, '0');
      const dateKey = `${selectedYearMonth}-${dayFormatted}`;

      // Invoices issued on this day
      const dayInvoices = monthInvoices.filter((d) => d.issueDate === dateKey);
      const dayInvoiced = dayInvoices.reduce((sum, d) => sum + (d.grandTotal || 0), 0);
      const dayUnpaid = dayInvoices.reduce((sum, d) => sum + (d.balanceDue || 0), 0);
      const dayPaidOnInvoice = dayInvoices.reduce((sum, d) => sum + (d.amountPaid || 0), 0);

      // Payments collected on this day (actual cash/m-pesa/bank revenue)
      const dayPaymentsList = monthPayments.filter((p) => p.date === dateKey);
      const dayRevenue = dayPaymentsList.reduce((sum, p) => sum + (p.amount || 0), 0);

      if (dayRevenue > peakAmt) {
        peakAmt = dayRevenue;
        peakDay = day;
      }

      runningRevenue += dayRevenue;
      runningUnpaid += dayUnpaid;

      data.push({
        dayNumber: day,
        dayLabel: `Day ${day}`,
        shortDate: `${day} ${new Date(selYear, selMonth - 1, day).toLocaleDateString('en-US', {
          month: 'short',
        })}`,
        fullDate: dateKey,
        revenue: dayRevenue, // Settled cash collection
        invoiced: dayInvoiced, // Total invoiced
        unpaid: dayUnpaid, // Unpaid portion of invoices
        settledInvoices: dayPaidOnInvoice,
        cumulativeRevenue: runningRevenue,
        cumulativeUnpaid: runningUnpaid,
        invoiceCount: dayInvoices.length,
        paymentCount: dayPaymentsList.length,
      });
    }

    const totalRev = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalInv = monthInvoices.reduce((sum, d) => sum + (d.grandTotal || 0), 0);
    const totalUnp = monthInvoices.reduce((sum, d) => sum + (d.balanceDue || 0), 0);
    const unpCount = monthInvoices.filter((d) => (d.balanceDue || 0) > 0).length;

    const rate = totalInv > 0 ? Math.min(100, Math.round((totalRev / totalInv) * 1000) / 10) : 0;

    return {
      dailyData: data,
      totalRevenueMTD: totalRev,
      totalInvoicedMTD: totalInv,
      totalUnpaidMTD: totalUnp,
      unpaidCountMTD: unpCount,
      collectionRate: rate,
      peakRevenueDay: peakDay,
      peakRevenueAmount: peakAmt,
    };
  }, [documents, payments, selectedYearMonth, daysInMonth, selYear, selMonth]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      if (!dataPoint) return null;

      return (
        <div className="bg-stone-900 border border-stone-700 text-stone-100 p-3 rounded-lg shadow-xl text-xs space-y-2 max-w-[260px]">
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 font-bold text-white">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              {dataPoint.shortDate} ({dataPoint.fullDate})
            </span>
            <span className="text-[10px] text-stone-400 font-normal">Day {dataPoint.dayNumber}</span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Daily Revenue Collected:
              </span>
              <span className="font-bold text-white tabular-nums">
                {formatKsh(dataPoint.revenue)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-rose-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                Unpaid Invoices Total:
              </span>
              <span className="font-bold text-rose-300 tabular-nums">
                {formatKsh(dataPoint.unpaid)}
              </span>
            </div>

            <div className="flex items-center justify-between text-stone-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-stone-500"></span>
                Invoiced on Day:
              </span>
              <span className="font-medium text-stone-300 tabular-nums">
                {formatKsh(dataPoint.invoiced)}
              </span>
            </div>

            {chartView === 'cumulative' && (
              <div className="border-t border-stone-800 pt-1.5 text-[11px] space-y-1">
                <div className="flex justify-between text-amber-300">
                  <span>MTD Cumulative Revenue:</span>
                  <span className="font-bold">{formatKsh(dataPoint.cumulativeRevenue)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>MTD Cumulative Unpaid:</span>
                  <span className="font-semibold">{formatKsh(dataPoint.cumulativeUnpaid)}</span>
                </div>
              </div>
            )}

            <div className="border-t border-stone-800/80 pt-1 flex items-center justify-between text-[10px] text-stone-400">
              <span>{dataPoint.paymentCount} receipt(s)</span>
              <span>{dataPoint.invoiceCount} invoice(s)</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="daily-revenue-trends-container"
      className={`bg-white border border-stone-200 rounded-lg p-5 shadow-xs space-y-5 ${className}`}
    >
      {/* Header with Title, Month Filter & View Mode Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 bg-amber-50 text-amber-700 rounded border border-amber-200">
              <Activity className="w-4 h-4" />
            </span>
            <h2 className="font-bold text-base text-stone-900 tracking-tight">
              Daily Revenue Trends & Unpaid Invoices
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Day-by-day revenue collections vs outstanding invoice balances for {monthName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month selector dropdown */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-300 rounded px-2.5 py-1 text-xs text-stone-700">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <select
              id="revenue-chart-month-select"
              value={selectedYearMonth}
              onChange={(e) => setSelectedYearMonth(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-medium text-stone-800 cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chart View Modes */}
          <div className="inline-flex rounded-md shadow-2xs border border-stone-200 bg-stone-50 p-0.5">
            <button
              type="button"
              onClick={() => setChartView('composed')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                chartView === 'composed'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Daily Bar & Trend View"
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Daily</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView('area')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                chartView === 'area'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Smooth Area Curves"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Area</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView('cumulative')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                chartView === 'cumulative'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Month-to-Date Cumulative Growth"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Cumulative</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary for Selected Month */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Total Revenue Collected (MTD) */}
        <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-lg">
          <div className="flex items-center justify-between text-[11px] text-emerald-900 font-semibold mb-0.5">
            <span>Revenue Collected</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base font-bold text-emerald-950 tabular-nums">
            {formatKsh(totalRevenueMTD)}
          </div>
          <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
            {collectionRate}% of invoiced settled
          </p>
        </div>

        {/* Metric 2: Unpaid Invoice Totals (MTD) */}
        <div className="p-3 bg-rose-50/60 border border-rose-200/80 rounded-lg">
          <div className="flex items-center justify-between text-[11px] text-rose-900 font-semibold mb-0.5">
            <span>Unpaid Invoices Total</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-base font-bold text-rose-950 tabular-nums">
            {formatKsh(totalUnpaidMTD)}
          </div>
          <p className="text-[10px] text-rose-700 mt-0.5 font-medium">
            {unpaidCountMTD} {unpaidCountMTD === 1 ? 'invoice' : 'invoices'} pending payment
          </p>
        </div>

        {/* Metric 3: Total Invoiced Volume (MTD) */}
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
          <div className="flex items-center justify-between text-[11px] text-stone-700 font-semibold mb-0.5">
            <span>Total Invoiced</span>
            <DollarSign className="w-3.5 h-3.5 text-stone-500" />
          </div>
          <div className="text-base font-bold text-stone-900 tabular-nums">
            {formatKsh(totalInvoicedMTD)}
          </div>
          <p className="text-[10px] text-stone-500 mt-0.5 font-medium">
            Gross billable for {monthName}
          </p>
        </div>

        {/* Metric 4: Peak Revenue Day */}
        <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg">
          <div className="flex items-center justify-between text-[11px] text-amber-900 font-semibold mb-0.5">
            <span>Peak Collection Day</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base font-bold text-amber-950 tabular-nums">
            {peakRevenueAmount > 0 ? formatKsh(peakRevenueAmount) : 'Ksh 0.00'}
          </div>
          <p className="text-[10px] text-amber-800 mt-0.5 font-medium">
            {peakRevenueAmount > 0 ? `Day ${peakRevenueDay} of ${monthName}` : 'No revenue recorded'}
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization */}
      <div className="w-full h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartView === 'composed' ? (
            <ComposedChart
              data={dailyData}
              margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="unpaidBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="dayNumber"
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval={Math.ceil(daysInMonth / 15)}
                tickFormatter={(val) => `D${val}`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                  return `${val}`;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: '11px' }}
                formatter={(value) => {
                  if (value === 'revenue') return <span className="text-emerald-700 font-semibold">Daily Revenue (Collected)</span>;
                  if (value === 'unpaid') return <span className="text-rose-600 font-semibold">Unpaid Invoice Balance</span>;
                  if (value === 'invoiced') return <span className="text-stone-700 font-medium">Daily Invoiced</span>;
                  return value;
                }}
              />
              {/* Daily Revenue Bar */}
              <Bar
                name="revenue"
                dataKey="revenue"
                fill="url(#revenueBarGrad)"
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              {/* Unpaid Invoice Bar */}
              <Bar
                name="unpaid"
                dataKey="unpaid"
                fill="url(#unpaidBarGrad)"
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              {/* Line for Daily Invoiced */}
              <Line
                name="invoiced"
                type="monotone"
                dataKey="invoiced"
                stroke="#1c1917"
                strokeWidth={2}
                dot={{ r: 2, fill: '#1c1917' }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          ) : chartView === 'area' ? (
            <ComposedChart
              data={dailyData}
              margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="areaUnpaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="dayNumber"
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval={Math.ceil(daysInMonth / 15)}
                tickFormatter={(val) => `D${val}`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                  return `${val}`;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: '11px' }}
                formatter={(value) => {
                  if (value === 'revenue') return <span className="text-emerald-700 font-semibold">Daily Revenue</span>;
                  if (value === 'unpaid') return <span className="text-rose-600 font-semibold">Unpaid Total</span>;
                  return value;
                }}
              />
              <Area
                name="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#areaRevenue)"
              />
              <Area
                name="unpaid"
                type="monotone"
                dataKey="unpaid"
                stroke="#e11d48"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#areaUnpaid)"
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={dailyData}
              margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="cumulRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="dayNumber"
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval={Math.ceil(daysInMonth / 15)}
                tickFormatter={(val) => `D${val}`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                  return `${val}`;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: '11px' }}
                formatter={(value) => {
                  if (value === 'cumulativeRevenue') return <span className="text-amber-700 font-semibold">Cumulative Revenue</span>;
                  if (value === 'cumulativeUnpaid') return <span className="text-rose-600 font-semibold">Cumulative Unpaid Invoices</span>;
                  return value;
                }}
              />
              <Area
                name="cumulativeRevenue"
                type="monotone"
                dataKey="cumulativeRevenue"
                stroke="#b45309"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#cumulRev)"
              />
              <Line
                name="cumulativeUnpaid"
                type="monotone"
                dataKey="cumulativeUnpaid"
                stroke="#e11d48"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Insight bar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Green bars: Settled payments</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Red bars: Unpaid invoice balances</span>
          </span>
          <span className="flex items-center gap-1.5 hidden sm:flex">
            <span className="w-3 h-0.5 bg-stone-900"></span>
            <span>Black line: Invoices issued</span>
          </span>
        </div>
        <span className="font-medium text-stone-600">
          Showing 1 to {daysInMonth} {monthName}
        </span>
      </div>
    </div>
  );
};
