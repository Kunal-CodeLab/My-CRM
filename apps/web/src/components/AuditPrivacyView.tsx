import React, { useState, useEffect } from 'react';
import { auditApi } from '../auth/api-client';
import { AuditLog, AuditAmendment } from '@crm/shared-types';
import { useToast } from './Toast';
import {
  Lock,
  Eraser,
  RefreshCw,
  Archive,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export const AuditPrivacyView: React.FC = () => {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'logs' | 'amendments' | 'erasure' | 'retention'>('logs');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [amendments, setAmendments] = useState<AuditAmendment[]>([]);
  const [loading, setLoading] = useState(false);
  const [legalHold, setLegalHold] = useState(false);
  const [legalHoldLoading, setLegalHoldLoading] = useState(false);

  // Lawful erasure form state
  const [erasureEntityName, setErasureEntityName] = useState('contact');
  const [erasureEntityId, setErasureEntityId] = useState('');
  const [erasureSubmitting, setErasureSubmitting] = useState(false);
  const [erasureResult, setErasureResult] = useState<any>(null);

  // Partition purge simulator state
  const [partitionName, setPartitionName] = useState('audit_logs_y2026m10');
  const [purgeResult, setPurgeResult] = useState<any>(null);
  const [purging, setPurging] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditApi.listLogs({ limit: 50 });
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAmendments = async () => {
    setLoading(true);
    try {
      const data = await auditApi.listAmendments();
      setAmendments(data);
    } catch (err: any) {
      console.error('Failed to load amendments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'logs') fetchLogs();
    if (activeSubTab === 'amendments') fetchAmendments();
  }, [activeSubTab]);

  const handleToggleLegalHold = async () => {
    setLegalHoldLoading(true);
    try {
      const next = !legalHold;
      await auditApi.setLegalHold(next);
      setLegalHold(next);
      toast.success(`Legal hold ${next ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      toast.error(err.message || 'Legal hold toggle failed');
    } finally {
      setLegalHoldLoading(false);
    }
  };

  const handleExecuteLawfulErasure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!erasureEntityId) return;

    setErasureSubmitting(true);
    setErasureResult(null);
    try {
      // 1. Request an Ed25519 authorization ticket signed by keypair
      const sample = await auditApi.createSampleTicket({
        targetEntityName: erasureEntityName,
        targetEntityId: erasureEntityId,
        expiresInSeconds: 3600,
      });

      // 2. Submit ticket to redact_entity_audit_history procedure
      const res = await auditApi.executeLawfulErasure({
        ticket: sample.ticket,
        publicKeyPem: sample.publicKeyPem,
      });

      setErasureResult(res);
      toast.success(`Lawful erasure executed (${res.recordsRedacted} records redacted)`);
      await fetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Lawful erasure failed');
    } finally {
      setErasureSubmitting(false);
    }
  };

  const handleRunPurgeDrill = async (dryRun: boolean) => {
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await auditApi.purgePartition(partitionName, dryRun);
      setPurgeResult(res);
    } catch (err: any) {
      setPurgeResult({ success: false, reason: err.message });
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-700/60">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>Cryptographic Audit & Lawful Erasure Console (AD05 & AD07)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Append-only partitioned audit logs, asymmetric Ed25519 erasure tickets, and fail-closed retention.
          </p>
        </div>

        {/* Legal Hold Switch */}
        <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
          <div className="text-xs">
            <span className="text-slate-400">Legal Hold: </span>
            <span className={legalHold ? 'text-amber-400 font-bold' : 'text-slate-300'}>
              {legalHold ? 'ACTIVE (Preserved)' : 'OFF (Normal Retention)'}
            </span>
          </div>
          <button
            onClick={handleToggleLegalHold}
            disabled={legalHoldLoading}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              legalHold
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            {legalHold ? 'Release Hold' : 'Engage Hold'}
          </button>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex border-b border-slate-700/60 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'logs'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Audit Trail Log
        </button>

        <button
          onClick={() => setActiveSubTab('amendments')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'amendments'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Amendments Ledger
        </button>

        <button
          onClick={() => setActiveSubTab('erasure')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'erasure'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Lawful Erasure (GDPR)
        </button>

        <button
          onClick={() => setActiveSubTab('retention')}
          className={`pb-2.5 transition border-b-2 cursor-pointer ${
            activeSubTab === 'retention'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Retention & Legal Hold Drill
        </button>
      </div>

      {/* Tab: Audit Trail Log */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Trail</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/60 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Entity</th>
                  <th className="p-3.5">Entity ID</th>
                  <th className="p-3.5">Diff Content</th>
                  <th className="p-3.5">SHA-256 Entry Hash</th>
                  <th className="p-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                      No audit log records found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-emerald-300 border border-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-white">{log.entityName}</td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        {log.entityId.slice(0, 13)}...
                      </td>
                      <td className="p-3.5 max-w-sm font-mono text-[11px] text-slate-300">
                        {JSON.stringify(log.diff)}
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-emerald-400/80">
                        {log.entryHash.slice(0, 20)}...
                      </td>
                      <td className="p-3.5 text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Amendments Ledger */}
      {activeSubTab === 'amendments' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700/60 text-xs text-slate-300">
            <p>
              When a lawful erasure ticket is executed, the original audit entry diff is redacted and a cryptographically
              signed receipt is written to the immutable <code className="text-emerald-300 font-mono">audit_amendments</code> ledger.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/60 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Ticket ID</th>
                  <th className="p-3.5">Entity</th>
                  <th className="p-3.5">Original Hash</th>
                  <th className="p-3.5">Amended Content Hash</th>
                  <th className="p-3.5">Ed25519 Signature</th>
                  <th className="p-3.5">Amended At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {amendments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                      No amendments recorded yet. Run a lawful erasure drill to generate an amendment.
                    </td>
                  </tr>
                ) : (
                  amendments.map((am) => (
                    <tr key={am.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5 font-mono text-indigo-300 font-bold">{am.ticketId}</td>
                      <td className="p-3.5 font-semibold text-white">{am.targetEntityName}</td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-400">{am.originalEntryHash.slice(0, 16)}...</td>
                      <td className="p-3.5 font-mono text-[10px] text-emerald-300">{am.amendedContentHash.slice(0, 16)}...</td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-400">{am.authorizationSignature.slice(0, 24)}...</td>
                      <td className="p-3.5 text-slate-400">{new Date(am.amendedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Lawful Erasure Form */}
      {activeSubTab === 'erasure' && (
        <div className="max-w-2xl bg-slate-900/50 p-6 rounded-2xl border border-slate-700/60 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Eraser className="w-5 h-5 text-indigo-400" />
              <span>Execute Lawful Erasure (GDPR Right to Be Forgotten)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Generates an asymmetric Ed25519 ticket, verifies authorization, executes the <code className="text-indigo-300">redact_entity_audit_history</code> stored procedure, and writes to the cryptographic amendments ledger.
            </p>
          </div>

          <form onSubmit={handleExecuteLawfulErasure} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Entity Type</label>
              <select
                value={erasureEntityName}
                onChange={(e) => setErasureEntityName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="contact">Contact</option>
                <option value="deal">Deal</option>
                <option value="account">Account</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Entity UUID</label>
              <input
                type="text"
                required
                placeholder="e.g. 018e3d0c-63b7-7681-9b19-20fbfbc7e4c2"
                value={erasureEntityId}
                onChange={(e) => setErasureEntityId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={erasureSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{erasureSubmitting ? 'Verifying & Redacting...' : 'Sign Ed25519 Ticket & Redact PII'}</span>
            </button>
          </form>

          {erasureResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Erasure Executed Successfully!</span>
              </div>
              <p className="text-slate-300">
                Amended <span className="font-bold text-white">{erasureResult.recordsAmended}</span> audit records.
              </p>
              <p className="font-mono text-[11px] text-emerald-200">
                Amendments created: {erasureResult.amendments?.length}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Retention & Legal Hold Drill */}
      {activeSubTab === 'retention' && (
        <div className="max-w-2xl bg-slate-900/50 p-6 rounded-2xl border border-slate-700/60 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-400" />
              <span>Fail-Closed Legal Hold Partition Purge Drill (AD07)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Shared monthly audit partitions cannot be dropped safely if any tenant has an active legal hold. This protocol verifies that held tenant slices are extracted and SHA-256 verified before purge, failing closed if any error occurs.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Partition Name</label>
              <input
                type="text"
                value={partitionName}
                onChange={(e) => setPartitionName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleRunPurgeDrill(true)}
                disabled={purging}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
              >
                Run Dry-Run Verification
              </button>
              <button
                onClick={() => handleRunPurgeDrill(false)}
                disabled={purging}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
              >
                Execute Purge Protocol
              </button>
            </div>
          </div>

          {purgeResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                purgeResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="font-bold flex items-center gap-2">
                {purgeResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>
                  {purgeResult.success ? 'Purge Protocol Verified' : 'Fail-Closed Abort Triggered'}
                </span>
              </div>
              <p>Partition: <span className="font-mono">{purgeResult.partitionName}</span></p>
              <p>Held Tenants Extracted: {purgeResult.heldTenantsExtracted?.length || 0}</p>
              {purgeResult.heldTenantsExtracted?.map((h: any) => (
                <div key={h.tenantId} className="p-2 rounded bg-slate-900/60 font-mono text-[11px]">
                  Tenant: {h.tenantSlug} | Checksum: {h.checksumSha256?.slice(0, 16)}... | Path: {h.archivePath}
                </div>
              ))}
              {purgeResult.reason && <p className="text-rose-300">Reason: {purgeResult.reason}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
