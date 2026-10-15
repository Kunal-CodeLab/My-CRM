import React, { useState } from 'react';
import { csvApi } from '../auth/api-client';
import { ImportJob, ExportDownloadResponse } from '@crm/shared-types';
import { useToast } from './Toast';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  FileText,
} from 'lucide-react';

export const CsvEngineView: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export State
  const [exportEntity, setExportEntity] = useState<'contacts' | 'deals'>('contacts');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportDownloadResponse | null>(null);

  // Import State
  const [deduplicationMode, setDeduplicationMode] = useState<'SKIP' | 'UPDATE' | 'CREATE_ALL'>('SKIP');
  const [csvInput, setCsvInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const initRes = exportEntity === 'contacts'
        ? await csvApi.exportContacts()
        : await csvApi.exportDeals();

      const snapshot = await csvApi.getExport(initRes.id);
      setExportResult(snapshot);
      toast.success(`Export generated (${snapshot.rowCount} records)`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!exportResult?.csvContent) return;
    const blob = new Blob([exportResult.csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportEntity}_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSampleCsv = () => {
    const sample = `firstName,lastName,email,phone,jobTitle
Alice,Walker,alice.walker@example.com,+1-555-0101,VP Engineering
=HYPERLINK("http://evil.com"),Smith,bob.smith@example.com,+1-555-0102,Product Lead
+123456,Johnson,charlie.j@example.com,+1-555-0103,Account Executive
Diana,Prince,diana.p@example.com,+1-555-0104,General Counsel`;
    setCsvInput(sample);
  };

  const handleStartImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvInput.trim()) return;

    setImporting(true);
    try {
      // 1. Initialize import job
      const job = await csvApi.createImport({
        deduplicationMode,
        csvData: csvInput,
      });
      setCurrentJob(job);

      // 2. Progressively process chunks
      let activeJob = job;
      while (activeJob.status !== 'COMPLETED' && activeJob.status !== 'FAILED') {
        activeJob = await csvApi.processImportChunk(activeJob.id, 50);
        setCurrentJob({ ...activeJob });
        if (activeJob.processedRows >= activeJob.totalRows) break;
      }
      if (activeJob.status === 'COMPLETED') {
        toast.success(`CSV Import finished (${activeJob.processedRows} rows processed)`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleResumeImport = async () => {
    if (!currentJob) return;
    setImporting(true);
    try {
      let activeJob = currentJob;
      while (activeJob.status !== 'COMPLETED' && activeJob.status !== 'FAILED') {
        activeJob = await csvApi.processImportChunk(activeJob.id, 50);
        setCurrentJob({ ...activeJob });
        if (activeJob.processedRows >= activeJob.totalRows) break;
      }
      if (activeJob.status === 'COMPLETED') {
        toast.success(`CSV Import resumed and finished (${activeJob.processedRows} rows processed)`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Resume failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <span>CSV Import & Export Engine (Phase 4)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Two-phase immutable snapshot exports with spreadsheet formula neutralization and chunked resumable contact ingestion.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'export' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Snapshot Export
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'import' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Resumable Import
          </button>
        </div>
      </div>

      {/* EXPORT TAB */}
      {activeTab === 'export' && (
        <div className="max-w-2xl bg-slate-900/50 p-6 rounded-2xl border border-slate-700/60 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-400" />
              <span>Generate Immutable Snapshot Export</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Enforces background worker authorization rechecks (Admin/Owner only), computes SHA-256 chunked persistence,
              and neutralizes CSV formula injection vulnerabilities (<code className="text-indigo-300 font-mono">= + - @</code> prefixed with apostrophe <code className="text-indigo-300 font-mono">'</code>).
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Export Target</label>
              <select
                value={exportEntity}
                onChange={(e) => setExportEntity(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="contacts">Contacts (Includes Names, Emails, Phones, Job Titles)</option>
                <option value="deals">Deals (Includes Values, Currencies, Pipeline & Stages)</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Spreadsheet Injection Defense Active:</strong> Cells containing spreadsheet formulas will be safely escaped to prevent remote code execution or exfiltration when opened in Microsoft Excel or Google Sheets.
              </span>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{exporting ? 'Generating Snapshot...' : `Export ${exportEntity.toUpperCase()} Snapshot`}</span>
            </button>
          </div>

          {exportResult && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/80 space-y-3 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Snapshot Built Successfully!</span>
                </span>
                <button
                  onClick={handleDownloadCsv}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px] font-mono">
                <div>Chunks: {exportResult.totalChunks}</div>
                <div>Size: {exportResult.byteLength} bytes</div>
                <div className="col-span-2 truncate">SHA-256: {exportResult.sha256Checksum}</div>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 max-h-32 overflow-y-auto font-mono text-[10px] text-slate-300">
                <pre>{exportResult.csvContent}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IMPORT TAB */}
      {activeTab === 'import' && (
        <div className="max-w-3xl bg-slate-900/50 p-6 rounded-2xl border border-slate-700/60 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              <span>Chunked Resumable Contact Ingestion</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Upload or paste CSV contact records with configurable deduplication modes. Jobs maintain row-pointer state and can safely resume after network interruptions.
            </p>
          </div>

          <form onSubmit={handleStartImport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Deduplication Mode</label>
                <select
                  value={deduplicationMode}
                  onChange={(e) => setDeduplicationMode(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="SKIP">SKIP — Ignore rows matching existing emails</option>
                  <option value="UPDATE">UPDATE — Update existing contact fields</option>
                  <option value="CREATE_ALL">CREATE_ALL — Ingest all rows as new contacts</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleLoadSampleCsv}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Load Sample Contacts CSV</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">CSV Raw Content</label>
              <textarea
                required
                rows={6}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="firstName,lastName,email,phone,jobTitle&#10;John,Doe,john.doe@example.com,+1-555-0100,VP Sales"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={importing}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{importing ? 'Processing Ingestion Chunks...' : 'Start Resumable Ingestion'}</span>
            </button>
          </form>

          {/* Progress & Results Card */}
          {currentJob && (
            <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-700/80 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">Import Job Status: </span>
                  <span className="font-mono text-indigo-300 uppercase font-bold">{currentJob.status}</span>
                </div>
                {currentJob.status !== 'COMPLETED' && (
                  <button
                    onClick={handleResumeImport}
                    disabled={importing}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Resume Chunk</span>
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>Processed: {currentJob.processedRows} / {currentJob.totalRows} rows</span>
                  <span>{Math.round((currentJob.processedRows / (currentJob.totalRows || 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-indigo-500 h-2 transition-all duration-300"
                    style={{ width: `${(currentJob.processedRows / (currentJob.totalRows || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-slate-300">
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
                  <span className="text-emerald-400 font-semibold">Successful:</span> {currentJob.successfulRows}
                </div>
                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/20">
                  <span className="text-rose-400 font-semibold">Failed:</span> {currentJob.failedRows}
                </div>
              </div>

              {currentJob.errorSummary && currentJob.errorSummary.length > 0 && (
                <div className="space-y-1">
                  <span className="font-semibold text-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Error Log
                  </span>
                  <div className="max-h-24 overflow-y-auto divide-y divide-slate-800 text-[11px] font-mono text-rose-200">
                    {currentJob.errorSummary.map((err, idx) => (
                      <div key={idx} className="py-1">Row {err.row}: {err.error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
