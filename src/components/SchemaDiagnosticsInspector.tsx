import React, { useState, useMemo } from 'react';
import {
  BillingDocument,
  Client,
  PaymentRecord,
  Reservation,
  POSOrder,
  ExpenseRecord,
} from '../types';
import {
  CANONICAL_ENTITY_SCHEMAS,
  SupportedEntityType,
  verifyDocumentSchema,
  verifyClientSchema,
  verifyPaymentSchema,
  verifySheetHeadersAgainstSchema,
  verifyBidirectionalSyncKeys,
  runComprehensiveSchemaAudit,
  ComprehensiveSchemaAuditReport,
  SchemaVerificationReport,
} from '../services/schemaDiagnostics';
import { SpreadsheetDataPayload } from '../services/sync';
import {
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Download,
  Copy,
  Check,
  ShieldCheck,
  ArrowDownUp,
  Layers,
  Code2,
  Cpu,
  Info,
} from 'lucide-react';

interface SchemaDiagnosticsInspectorProps {
  documents: BillingDocument[];
  clients: Client[];
  payments: PaymentRecord[];
  reservations?: Reservation[];
  posOrders?: POSOrder[];
  expenses?: ExpenseRecord[];
  liveSheetData?: SpreadsheetDataPayload | null;
  onRefreshLiveSheet?: () => Promise<void>;
}

export const SchemaDiagnosticsInspector: React.FC<SchemaDiagnosticsInspectorProps> = ({
  documents,
  clients,
  payments,
  reservations = [],
  posOrders = [],
  expenses = [],
  liveSheetData,
  onRefreshLiveSheet,
}) => {
  const [selectedEntityType, setSelectedEntityType] = useState<SupportedEntityType>('INVOICE');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditReport, setAuditReport] = useState<ComprehensiveSchemaAuditReport | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('sample');
  const [customJsonInput, setCustomJsonInput] = useState<string>('');
  const [playgroundResult, setPlaygroundResult] = useState<SchemaVerificationReport | null>(null);

  // Active Schema Definition
  const currentSchema = CANONICAL_ENTITY_SCHEMAS[selectedEntityType];

  // Filtered fields in current schema
  const filteredFields = useMemo(() => {
    if (!searchTerm.trim()) return currentSchema.fields;
    const q = searchTerm.toLowerCase();
    return currentSchema.fields.filter(
      (f) =>
        f.localKey.toLowerCase().includes(q) ||
        f.expectedSheetHeader.toLowerCase().includes(q) ||
        f.gasCanonicalKey.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.supportedAliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [currentSchema, searchTerm]);

  // Live Google Sheet Parity Check for current schema's tab
  const liveSheetTabParity = useMemo(() => {
    if (!liveSheetData?.discoveredTabs || liveSheetData.discoveredTabs.length === 0) return null;
    const tab = liveSheetData.discoveredTabs.find(
      (t) => t.name.toLowerCase() === currentSchema.tabName.toLowerCase()
    );
    if (!tab) return null;
    return verifySheetHeadersAgainstSchema(tab.name, tab.headers);
  }, [liveSheetData, currentSchema]);

  // Run comprehensive schema audit across all local records
  const handleRunAudit = () => {
    setIsRunningAudit(true);
    setTimeout(() => {
      try {
        const report = runComprehensiveSchemaAudit(
          { documents, clients, payments, reservations, posOrders, expenses },
          liveSheetData
        );
        setAuditReport(report);
      } catch (err) {
        console.error('Schema audit error:', err);
      } finally {
        setIsRunningAudit(false);
      }
    }, 150);
  };

  // Inspect specific selected record
  const selectedRecordVerification = useMemo(() => {
    if (selectedRecordId === 'sample') {
      if (selectedEntityType === 'INVOICE' || selectedEntityType === 'QUOTATION' || selectedEntityType === 'PROFORMA') {
        const doc = documents.find((d) => d.documentType === selectedEntityType) || documents[0];
        if (doc) return verifyDocumentSchema(doc, selectedEntityType);
      } else if (selectedEntityType === 'CLIENT') {
        if (clients[0]) return verifyClientSchema(clients[0]);
      } else if (selectedEntityType === 'RECEIPT') {
        if (payments[0]) return verifyPaymentSchema(payments[0]);
      }
      return null;
    }

    if (selectedEntityType === 'INVOICE' || selectedEntityType === 'QUOTATION' || selectedEntityType === 'PROFORMA') {
      const doc = documents.find((d) => d.id === selectedRecordId || d.documentNumber === selectedRecordId);
      if (doc) return verifyDocumentSchema(doc, selectedEntityType);
    } else if (selectedEntityType === 'CLIENT') {
      const cli = clients.find((c) => c.id === selectedRecordId || c.name === selectedRecordId);
      if (cli) return verifyClientSchema(cli);
    } else if (selectedEntityType === 'RECEIPT') {
      const pay = payments.find((p) => p.id === selectedRecordId || p.receiptNumber === selectedRecordId);
      if (pay) return verifyPaymentSchema(pay);
    }
    return null;
  }, [selectedRecordId, selectedEntityType, documents, clients, payments]);

  // Bidirectional serialization test for selected record
  const bidirectionalTest = useMemo(() => {
    let targetPayload: any = null;
    if (selectedEntityType === 'INVOICE' || selectedEntityType === 'QUOTATION' || selectedEntityType === 'PROFORMA') {
      targetPayload = documents.find((d) => d.documentType === selectedEntityType) || documents[0];
    } else if (selectedEntityType === 'CLIENT') {
      targetPayload = clients[0];
    } else if (selectedEntityType === 'RECEIPT') {
      targetPayload = payments[0];
    }

    if (!targetPayload) return null;

    const pushRes = verifyBidirectionalSyncKeys(targetPayload, 'OUTBOUND_PUSH', selectedEntityType);
    const pullRes = verifyBidirectionalSyncKeys(targetPayload, 'INBOUND_PULL', selectedEntityType);

    return { pushRes, pullRes };
  }, [selectedEntityType, documents, clients, payments]);

  // Handle custom playground verification
  const handleVerifyCustomJson = () => {
    try {
      const parsed = JSON.parse(customJsonInput);
      if (selectedEntityType === 'INVOICE' || selectedEntityType === 'QUOTATION' || selectedEntityType === 'PROFORMA') {
        setPlaygroundResult(verifyDocumentSchema(parsed, selectedEntityType));
      } else if (selectedEntityType === 'CLIENT') {
        setPlaygroundResult(verifyClientSchema(parsed));
      } else if (selectedEntityType === 'RECEIPT') {
        setPlaygroundResult(verifyPaymentSchema(parsed));
      }
    } catch (err: any) {
      setPlaygroundResult({
        entityType: selectedEntityType,
        targetTab: currentSchema.tabName,
        checkedAt: new Date().toISOString(),
        isFullyCompliant: false,
        parityScore: 0,
        totalFieldsCount: currentSchema.fields.length,
        matchedFieldsCount: 0,
        missingRequiredCount: 0,
        missingOptionalCount: 0,
        typeMismatchesCount: 0,
        unknownExtraKeysCount: 0,
        mismatches: [
          {
            fieldKey: 'JSON_SYNTAX',
            expectedHeader: 'Valid JSON',
            issueType: 'MISSING_IN_LOCAL',
            severity: 'CRITICAL',
            expectedType: 'JSON Object',
            suggestion: `Invalid JSON syntax: ${err.message}`,
            autoHealable: false,
          },
        ],
        summaryMessage: `Failed to parse JSON string: ${err.message}`,
      });
    }
  };

  // Export full JSON audit report
  const handleDownloadReport = () => {
    const reportToExport = auditReport || runComprehensiveSchemaAudit({ documents, clients, payments }, liveSheetData);
    const blob = new Blob([JSON.stringify(reportToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_parity_diagnostic_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Markdown Summary
  const handleCopyMarkdown = () => {
    const report = auditReport || runComprehensiveSchemaAudit({ documents, clients, payments }, liveSheetData);
    let md = `# Hotel Damview ERP - Schema Parity & Diagnostic Report\n`;
    md += `*Generated: ${new Date(report.timestamp).toLocaleString()}*\n\n`;
    md += `## 1. Executive Parity Summary\n`;
    md += `- **Overall Schema Parity Score**: ${report.overallParityScore}%\n`;
    md += `- **Total Entities Audited**: ${report.totalEntitiesAudited}\n`;
    md += `- **Compliant Records**: ${report.passedEntitiesCount}\n`;
    md += `- **Non-Compliant / Flagged Records**: ${report.failedEntitiesCount}\n`;
    md += `- **Google Sheets Tabs Audited**: ${report.sheetsAudited}\n\n`;

    md += `## 2. Canonical Schema Specifications\n`;
    md += `| Entity | Target Sheet Tab | Total Fields | Primary Key |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const [key, schema] of Object.entries(CANONICAL_ENTITY_SCHEMAS)) {
      md += `| ${key} | ${schema.tabName} | ${schema.fields.length} | \`${schema.primaryKey}\` |\n`;
    }

    if (report.sheetParityReports.length > 0) {
      md += `\n## 3. Live Google Sheets Header Alignment\n`;
      md += `| Tab Name | Expected Columns | Matched | Missing Columns | Status |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      for (const sh of report.sheetParityReports) {
        md += `| ${sh.tabName} | ${sh.expectedHeaders.length} | ${sh.matchedHeaders.length} | ${sh.missingHeaders.join(', ') || 'None'} | ${sh.status} |\n`;
      }
    }

    md += `\n## 4. Remediation Plan\n`;
    for (const step of report.remediationPlan) {
      md += `- ${step}\n`;
    }

    navigator.clipboard.writeText(md);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="space-y-4 font-sans text-stone-800 animate-fade-in">
      {/* 1. TOP EXECUTIVE HEADER BANNER */}
      <div className="bg-stone-900 text-stone-100 rounded-lg p-4 border border-stone-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Document JSON Schema & Google Sheets Parity Engine
                </h3>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold rounded">
                  v4.9.0 Schema
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1 max-w-2xl leading-relaxed">
                Bi-directional schema validator and field drift diagnostic utility. Verifies exact parity between local IndexedDB document models, Google Apps Script canonical keys, and Google Sheets column headers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleRunAudit}
              disabled={isRunningAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              title="Audit all local documents, clients, and payments against canonical schemas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningAudit ? 'animate-spin' : ''}`} />
              <span>{isRunningAudit ? 'Auditing Schema...' : 'Run Full Schema Audit'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded text-xs font-semibold transition-colors cursor-pointer"
              title="Copy markdown diagnostic report"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded text-xs font-semibold transition-colors cursor-pointer"
              title="Export complete JSON diagnostic report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Audit Metrics Banner */}
        {auditReport && (
          <div className="mt-4 pt-4 border-t border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-stone-950/60 p-2.5 rounded border border-stone-800/80">
              <span className="text-[11px] text-stone-400 block">Overall Schema Parity</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {auditReport.overallParityScore}%
              </span>
            </div>
            <div className="bg-stone-950/60 p-2.5 rounded border border-stone-800/80">
              <span className="text-[11px] text-stone-400 block">Audited Records</span>
              <span className="text-base font-bold text-stone-200 font-mono">
                {auditReport.totalEntitiesAudited}
              </span>
            </div>
            <div className="bg-stone-950/60 p-2.5 rounded border border-stone-800/80">
              <span className="text-[11px] text-stone-400 block">Compliant Entities</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {auditReport.passedEntitiesCount}
              </span>
            </div>
            <div className="bg-stone-950/60 p-2.5 rounded border border-stone-800/80">
              <span className="text-[11px] text-stone-400 block">Drift Discrepancies</span>
              <span className={`text-base font-bold font-mono ${auditReport.failedEntitiesCount > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
                {auditReport.failedEntitiesCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. SCHEMA SELECTOR TABS */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {(Object.keys(CANONICAL_ENTITY_SCHEMAS) as SupportedEntityType[]).map((key) => {
            const schema = CANONICAL_ENTITY_SCHEMAS[key];
            const isActive = selectedEntityType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedEntityType(key);
                  setSelectedRecordId('sample');
                  setPlaygroundResult(null);
                }}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-stone-900 text-amber-400 shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                <span>{key}</span>
                <span className="ml-1.5 text-[10px] opacity-75 font-mono">({schema.tabName})</span>
              </button>
            );
          })}
        </div>

        {/* Field Search Filter */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search schema fields or aliases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-white border border-stone-200 rounded text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* 3. CURRENT SCHEMA OVERVIEW & LIVE GOOGLE SHEET STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-xs space-y-2 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{currentSchema.entityType} Schema Blueprint</span>
            </h4>
            <span className="text-[11px] font-mono text-stone-500">
              Target Tab: <strong className="text-stone-800">{currentSchema.tabName}</strong>
            </span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            {currentSchema.description}
          </p>
          <div className="pt-2 border-t border-stone-100 flex items-center gap-4 text-xs text-stone-500 flex-wrap">
            <span>Primary Key: <strong className="font-mono text-stone-800">{currentSchema.primaryKey}</strong></span>
            <span>Total Defined Fields: <strong className="font-mono text-stone-800">{currentSchema.fields.length}</strong></span>
            <span>Required Fields: <strong className="font-mono text-stone-800">{currentSchema.fields.filter((f) => f.required).length}</strong></span>
          </div>
        </div>

        {/* Live Sheet Parity Status */}
        <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Live Sheet Parity</span>
            </h4>
            {onRefreshLiveSheet && (
              <button
                type="button"
                onClick={onRefreshLiveSheet}
                className="text-[11px] text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                title="Refresh Google Sheet headers"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Check</span>
              </button>
            )}
          </div>

          {liveSheetTabParity ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Column Parity:</span>
                <span className={`font-mono font-bold ${liveSheetTabParity.parityPercentage === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {liveSheetTabParity.parityPercentage}% ({liveSheetTabParity.matchedHeaders.length}/{liveSheetTabParity.expectedHeaders.length})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Status:</span>
                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  liveSheetTabParity.status === 'PERFECT'
                    ? 'bg-emerald-100 text-emerald-800'
                    : liveSheetTabParity.status === 'COMPLIANT_WITH_EXTRAS'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {liveSheetTabParity.status}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 leading-tight pt-1">
                {liveSheetTabParity.remedyAction}
              </p>
            </div>
          ) : (
            <div className="text-[11px] text-stone-400 py-2 leading-relaxed">
              No live headers fetched yet. Connect Google Sheets Web App URL in settings to verify live column alignment.
            </div>
          )}
        </div>
      </div>

      {/* 4. FIELD-BY-FIELD MAPPING MATRIX TABLE */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
        <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-600" />
            <span className="text-xs font-bold text-stone-800">
              Bidirectional Field Mapping &amp; Alias Resolution Matrix ({filteredFields.length} fields)
            </span>
          </div>
          <span className="text-[11px] text-stone-500">
            Local Property ⇄ Canonical Key ⇄ Expected Header ⇄ Aliases
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-stone-600">
            <thead className="bg-stone-900 text-stone-100 uppercase text-[10px] font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Local JSON Key</th>
                <th className="py-2.5 px-3">TypeScript Type</th>
                <th className="py-2.5 px-3">Google Sheet Header</th>
                <th className="py-2.5 px-3">Apps Script Key &amp; Aliases</th>
                <th className="py-2.5 px-3">Requirement</th>
                <th className="py-2.5 px-3">Normalization &amp; Shields</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-mono">
              {filteredFields.map((field) => (
                <tr key={field.localKey} className="hover:bg-amber-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-stone-900">
                    {field.localKey}
                  </td>
                  <td className="py-2.5 px-3 text-stone-700 font-sans">
                    <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[11px] border border-stone-200 font-mono">
                      {field.localType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-emerald-800">
                    {field.expectedSheetHeader}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                      <span className="text-stone-900 font-bold">{field.gasCanonicalKey}</span>
                      <span className="text-[10px] text-stone-400 truncate max-w-xs font-sans" title={field.supportedAliases.join(', ')}>
                        Aliases: {field.supportedAliases.join(', ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    {field.required ? (
                      <span className="inline-block px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                        Required
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[10px]">
                        Optional
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-stone-700 text-[11px]">
                    {field.normalizerRule || field.defensiveShieldRule ? (
                      <div className="space-y-0.5">
                        {field.normalizerRule && (
                          <div className="text-sky-700">⚡ {field.normalizerRule}</div>
                        )}
                        {field.defensiveShieldRule && (
                          <div className="text-emerald-700">🛡️ {field.defensiveShieldRule}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-400 font-sans">Standard pass-through</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. BIDIRECTIONAL KEY PARITY & LIVE RECORD INSPECTOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Outbound & Inbound Key Resolution Inspector */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
              <ArrowDownUp className="w-4 h-4 text-amber-600" />
              <span>Bidirectional Key Parity Test</span>
            </h4>
            <span className="text-[11px] text-stone-500 font-mono">
              Active Record: <strong className="text-stone-800">{selectedEntityType}</strong>
            </span>
          </div>

          {bidirectionalTest ? (
            <div className="space-y-3 text-xs">
              {/* Push Direction */}
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Outbound Push (Local JSON ➔ Google Sheets Rows)
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    bidirectionalTest.pushRes.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {bidirectionalTest.pushRes.passed ? 'PARITY 100%' : 'MISSING KEYS'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Successfully maps {Object.keys(bidirectionalTest.pushRes.resolvedTargetKeys).length} local keys to Sheet columns.
                </p>
                {bidirectionalTest.pushRes.coercedFields.length > 0 && (
                  <div className="text-[11px] text-sky-800 bg-sky-50 p-2 rounded border border-sky-100 space-y-1">
                    <span className="font-bold block">Sanitization Transforms Applied:</span>
                    {bidirectionalTest.pushRes.coercedFields.map((c, i) => (
                      <div key={i} className="font-mono text-[10px]">
                        {c.field}: {JSON.stringify(c.from)} ➔ {JSON.stringify(c.to)} ({c.rule})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pull Direction */}
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Inbound Pull (Google Sheets ➔ Local JSON Model)
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    bidirectionalTest.pullRes.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {bidirectionalTest.pullRes.passed ? 'HYDRATION 100%' : 'UNRESOLVED KEYS'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Maps remote column values back into typed local JSON schema with non-destructive fallback shields.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-stone-400 text-xs">
              No local records found to run bidirectional mapping test. Create a document or client to inspect.
            </div>
          )}
        </div>

        {/* Custom JSON Playground & Mismatch Verifier */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-sky-600" />
              <span>Interactive JSON Schema Playground</span>
            </h4>
            <span className="text-[11px] text-stone-500">
              Test Custom JSON against <strong className="text-stone-800">{selectedEntityType}</strong>
            </span>
          </div>

          <div className="space-y-2">
            <textarea
              rows={4}
              placeholder={`Paste any JSON object here to test against ${selectedEntityType} schema...`}
              value={customJsonInput}
              onChange={(e) => setCustomJsonInput(e.target.value)}
              className="w-full p-2 bg-stone-50 border border-stone-200 rounded text-xs font-mono text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleVerifyCustomJson}
                disabled={!customJsonInput.trim()}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                Validate JSON Parity
              </button>

              <button
                type="button"
                onClick={() => {
                  const sampleDoc = documents[0] || {
                    documentNumber: 'INV-2026-0001',
                    documentType: 'INVOICE',
                    issueDate: '2026-09-25',
                    dueDate: '2026-10-25',
                    clientName: 'Sample Client',
                    subtotal: 10000,
                    vatAmount: 1600,
                    grandTotal: 11600,
                    amountPaid: 0,
                    balanceDue: 11600,
                    status: 'Draft',
                    id: 'doc-sample-123',
                  };
                  setCustomJsonInput(JSON.stringify(sampleDoc, null, 2));
                }}
                className="text-[11px] text-stone-600 hover:text-stone-900 underline cursor-pointer"
              >
                Load Local Sample Record
              </button>
            </div>
          </div>

          {/* Playground Verification Result */}
          {playgroundResult && (
            <div className="p-3 bg-stone-50 rounded border border-stone-200 text-xs space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800">Parity Score:</span>
                <span className={`font-mono font-bold ${playgroundResult.isFullyCompliant ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {playgroundResult.parityScore}% {playgroundResult.isFullyCompliant ? '(Compliant)' : '(Discrepancies Found)'}
                </span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                {playgroundResult.summaryMessage}
              </p>

              {playgroundResult.mismatches.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {playgroundResult.mismatches.map((m, idx) => (
                    <div key={idx} className="p-1.5 bg-white border border-stone-200 rounded text-[11px] flex items-start gap-2">
                      {m.severity === 'CRITICAL' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <strong className="font-mono text-stone-900">{m.fieldKey}</strong>: {m.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
