import React, { useState, useEffect } from 'react';
import { outboxApi } from '../auth/api-client';
import { OutboxEvent } from '@crm/shared-types';
import { RefreshCw, Play, ShieldAlert, CheckCircle2, Clock, Cpu, AlertTriangle } from 'lucide-react';

export const OutboxWorkerView: React.FC = () => {
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [processResult, setProcessResult] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await outboxApi.listEvents(statusFilter === 'ALL' ? undefined : statusFilter, 50);
      setEvents(data);
    } catch (err: any) {
      console.error('Failed to fetch outbox events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [statusFilter]);

  const handleTriggerProcessing = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await outboxApi.triggerProcessing(10);
      setProcessResult(`Batch executed: ${res.processed} processed, ${res.failed} failed, ${res.unknown} unknown outcome.`);
      await fetchEvents();
    } catch (err: any) {
      setProcessResult(`Error triggering worker: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROCESSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            PROCESSED
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <RefreshCw className="w-3 h-3 animate-spin" />
            PROCESSING
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            PENDING
          </span>
        );
      case 'UNKNOWN_OUTCOME':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-500/40">
            <AlertTriangle className="w-3 h-3" />
            UNKNOWN_OUTCOME
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300 border border-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-700/60">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span>Transactional Outbox & Worker Fencing Engine</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            At-least-once delivery with monotonic fence token validation and heartbeat lease recovery (AD06).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="PROCESSED">Processed</option>
            <option value="UNKNOWN_OUTCOME">Unknown Outcome</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={fetchEvents}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleTriggerProcessing}
            disabled={processing}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Trigger Relay Dispatch</span>
          </button>
        </div>
      </div>

      {processResult && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs font-mono text-indigo-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{processResult}</span>
        </div>
      )}

      {/* Events Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-900/40">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/60 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Event Type</th>
              <th className="p-3.5">Fence Token</th>
              <th className="p-3.5">Claim Token</th>
              <th className="p-3.5">Idempotency Key</th>
              <th className="p-3.5">Payload Preview</th>
              <th className="p-3.5">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {events.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                  No outbox events found for the active filter.
                </td>
              </tr>
            ) : (
              events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-800/30 transition">
                  <td className="p-3.5">{getStatusBadge(evt.status)}</td>
                  <td className="p-3.5 font-mono text-indigo-300 font-semibold">{evt.eventType}</td>
                  <td className="p-3.5">
                    <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold">
                      #{evt.fenceToken}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                    {evt.claimToken ? `${evt.claimToken.slice(0, 13)}...` : '—'}
                  </td>
                  <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                    {evt.idempotencyKey.slice(0, 16)}...
                  </td>
                  <td className="p-3.5 max-w-xs truncate font-mono text-[11px] text-slate-400">
                    {JSON.stringify(evt.payload)}
                  </td>
                  <td className="p-3.5 text-slate-400 whitespace-nowrap">
                    {new Date(evt.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
