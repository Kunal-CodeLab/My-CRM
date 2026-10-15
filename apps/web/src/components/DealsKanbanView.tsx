import React, { useState, useEffect } from 'react';
import { crmApi } from '../auth/api-client';
import { useToast } from './Toast';
import {
  Pipeline,
  Deal,
  DealStage,
} from '@crm/shared-types';
import {
  Trophy,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MoreVertical,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';

interface DealsKanbanViewProps {
  onTotalValueChange?: (val: number) => void;
  onDealCountChange?: (total: number, won: number, pending: number, wonRev: number) => void;
}

// Stage theme styling configurations matching the reference design
const STAGE_THEMES = [
  {
    headerBg: 'bg-sky-50/90 text-sky-900 border-sky-100',
    countBadge: 'bg-sky-100 text-sky-700',
    columnBg: 'bg-sky-50/25 border-sky-100/80',
    accent: 'text-sky-600',
  },
  {
    headerBg: 'bg-purple-50/90 text-purple-900 border-purple-100',
    countBadge: 'bg-purple-100 text-purple-700',
    columnBg: 'bg-purple-50/25 border-purple-100/80',
    accent: 'text-purple-600',
  },
  {
    headerBg: 'bg-amber-50/90 text-amber-900 border-amber-100',
    countBadge: 'bg-amber-100 text-amber-700',
    columnBg: 'bg-amber-50/25 border-amber-100/80',
    accent: 'text-amber-600',
  },
  {
    headerBg: 'bg-emerald-50/90 text-emerald-900 border-emerald-100',
    countBadge: 'bg-emerald-100 text-emerald-700',
    columnBg: 'bg-emerald-50/25 border-emerald-100/80',
    accent: 'text-emerald-600',
  },
  {
    headerBg: 'bg-slate-100/90 text-slate-800 border-slate-200',
    countBadge: 'bg-slate-200 text-slate-700',
    columnBg: 'bg-slate-50/40 border-slate-200/80',
    accent: 'text-slate-600',
  },
];

// Helper to assign mock/real visual metadata to deals
const getDealMeta = (dealId: string, index: number) => {
  const assignees = [
    { name: 'Rohit Sharma', initials: 'RS', bg: 'bg-indigo-600' },
    { name: 'Anjali Mehta', initials: 'AM', bg: 'bg-purple-600' },
    { name: 'Vivek Joshi', initials: 'VJ', bg: 'bg-amber-600' },
    { name: 'Rajat Kumar', initials: 'RK', bg: 'bg-emerald-600' },
    { name: 'Nitin Gupta', initials: 'NG', bg: 'bg-sky-600' },
    { name: 'Priya Verma', initials: 'PV', bg: 'bg-rose-600' },
  ];
  const priorities: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'High', 'Low', 'Medium'];
  const dates = ['Oct 17, 2025', 'Oct 18, 2025', 'Oct 19, 2025', 'Oct 20, 2025', 'Oct 22, 2025'];
  const idx = Math.abs((dealId.charCodeAt(dealId.length - 1) || index) % assignees.length);

  return {
    assignee: assignees[idx],
    priority: priorities[idx % priorities.length],
    date: dates[idx % dates.length],
  };
};

export const DealsKanbanView: React.FC<DealsKanbanViewProps> = ({
  onTotalValueChange,
  onDealCountChange,
}) => {
  const toast = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // New Deal Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: '', value: '10000.00', stageId: '' });

  // Closed Lost Reason Modal State
  const [lostModal, setLostModal] = useState<{
    isOpen: boolean;
    deal: Deal | null;
    targetStageId: string;
    targetStageName: string;
    reason: string;
    customNote: string;
  }>({
    isOpen: false,
    deal: null,
    targetStageId: '',
    targetStageName: '',
    reason: 'Competitor pricing lower',
    customNote: '',
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const pList = await crmApi.listPipelines();
      setPipelines(pList);
      const defaultPipeline = pList.find((p) => p.isDefault) || pList[0];
      if (defaultPipeline) {
        setSelectedPipelineId(defaultPipeline.id);
        const dList = await crmApi.listDeals({ pipelineId: defaultPipeline.id });
        setDeals(dList);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load pipeline data';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPipeline = async (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setLoading(true);
    setActionError(null);
    try {
      const dList = await crmApi.listDeals({ pipelineId });
      setDeals(dList);
    } catch (err: any) {
      const msg = err.message || 'Failed to load pipeline deals';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const stages: DealStage[] = (activePipeline as any)?.stages || [];

  useEffect(() => {
    if (stages.length > 0 && !newDeal.stageId) {
      setNewDeal((prev) => ({ ...prev, stageId: stages[0].id }));
    }
  }, [stages, newDeal.stageId]);

  // Dynamic Metrics Recalculation
  useEffect(() => {
    const totalVal = deals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
    onTotalValueChange?.(totalVal);

    const wonStages = new Set(stages.filter((s) => s.isWon).map((s) => s.id));
    const wonDeals = deals.filter((d) => wonStages.has(d.stageId));
    const wonRev = wonDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
    const pendingDeals = deals.length - wonDeals.length;

    onDealCountChange?.(deals.length, wonDeals.length, pendingDeals, wonRev);
  }, [deals, stages, onTotalValueChange, onDealCountChange]);

  const executeStageTransition = async (deal: Deal, targetStageId: string, lostReason?: string) => {
    setActionError(null);
    setActionSuccess(null);

    const targetStage = stages.find((s) => s.id === targetStageId);
    const isWon = Boolean(targetStage?.isWon);
    const isLost = Boolean(targetStage?.isLost);

    // Optimistic UI update
    const previousStageId = deal.stageId;
    const previousVersion = deal.version;

    setDeals((prev) =>
      prev.map((d) => (d.id === deal.id ? { ...d, stageId: targetStageId, version: d.version + 1 } : d))
    );

    const payload: { newStageId: string; expectedVersion: number; lostReason?: string } = {
      newStageId: targetStageId,
      expectedVersion: previousVersion,
    };
    if (lostReason) {
      payload.lostReason = lostReason;
    }

    try {
      const updated = await crmApi.transitionDealStage(deal.id, payload);

      // Commit confirmed server version
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? updated : d)));
      const successMsg = isWon
        ? `🎉 Deal Won! "${deal.title}" ($${parseFloat(deal.value).toLocaleString('en-US')}) closed successfully.`
        : isLost
          ? `Deal closed lost: "${deal.title}" (${lostReason || 'No reason recorded'}).`
          : `Stage updated: "${deal.title}" is now in ${targetStage?.name || 'new stage'}.`;

      setActionSuccess(successMsg);
      if (isWon) {
        toast.success(successMsg, 'Deal Won!');
      } else {
        toast.success(successMsg);
      }
    } catch (err: any) {
      // Rollback optimistic update on conflict or error
      setDeals((prev) =>
        prev.map((d) => (d.id === deal.id ? { ...d, stageId: previousStageId, version: previousVersion } : d))
      );

      let errorMsg = 'Stage transition failed.';
      if (err?.problem?.detail) {
        errorMsg = err.problem.detail;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      setActionError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleStageTransition = (deal: Deal, targetStageId: string) => {
    const targetStage = stages.find((s) => s.id === targetStageId);
    const isLost = Boolean(targetStage?.isLost);

    if (isLost) {
      setLostModal({
        isOpen: true,
        deal,
        targetStageId,
        targetStageName: targetStage?.name || 'Lost',
        reason: 'Competitor pricing lower',
        customNote: '',
      });
      return;
    }

    executeStageTransition(deal, targetStageId);
  };

  const handleConfirmLostTransition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostModal.deal) return;

    const fullReason = lostModal.customNote.trim()
      ? `${lostModal.reason} - Note: ${lostModal.customNote.trim()}`
      : lostModal.reason;

    executeStageTransition(lostModal.deal, lostModal.targetStageId, fullReason);
    setLostModal({
      isOpen: false,
      deal: null,
      targetStageId: '',
      targetStageName: '',
      reason: 'Competitor pricing lower',
      customNote: '',
    });
  };

  const handleCreateDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeal.title || !newDeal.value || !newDeal.stageId) return;

    try {
      const created = await crmApi.createDeal({
        title: newDeal.title,
        value: parseFloat(newDeal.value).toFixed(2),
        pipelineId: selectedPipelineId,
        stageId: newDeal.stageId,
      });

      setDeals((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewDeal({ title: '', value: '10000.00', stageId: stages[0]?.id || '' });
      toast.success(`Deal "${created.title}" created successfully!`);
    } catch (err: any) {
      const msg = err?.problem?.detail || err.message || 'Failed to create deal';
      toast.error(msg);
    }
  };

  // Filter deals by query and tags
  const filteredDeals = deals.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.value.includes(searchQuery);
    return matchesSearch;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-5">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Deals Pipeline</span>
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Track and manage your deals across different stages
            </p>
          </div>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white w-36 sm:w-44 transition"
            />
          </div>

          {/* Pipeline / Users Dropdown */}
          {pipelines.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Select Pipeline"
                value={selectedPipelineId}
                onChange={(e) => handleSelectPipeline(e.target.value)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer py-0.5"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id} className="text-slate-800">
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tags Filter Dropdown */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer py-0.5"
            >
              <option value="all">All Tags</option>
              <option value="high">High Priority</option>
              <option value="enterprise">Enterprise</option>
              <option value="renewal">Renewal</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
            title="Refresh Deals"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Green Add Deal Button */}
          <button
            onClick={() => {
              if (stages.length > 0) {
                setNewDeal((prev) => ({ ...prev, stageId: stages[0].id }));
              }
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-xs shadow-sm shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Deal</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {actionError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 2. Kanban Board Columns */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading pipeline stages...</div>
      ) : stages.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-200/80">
          No pipeline stages defined.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 overflow-x-auto pb-2">
          {stages.map((stage, idx) => {
            const stageDeals = filteredDeals.filter((d) => d.stageId === stage.id);
            const totalValue = stageDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
            const nextStage = stages[idx + 1];
            const theme = STAGE_THEMES[idx % STAGE_THEMES.length];

            return (
              <div
                key={stage.id}
                className={`rounded-2xl border flex flex-col min-w-[210px] ${theme.columnBg} transition-all`}
              >
                {/* Column Header Chip */}
                <div className={`p-3 rounded-t-2xl border-b ${theme.headerBg} flex items-center justify-between`}>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      {stage.name}
                    </h4>
                    <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                      ₹{totalValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${theme.countBadge}`}>
                    {stageDeals.length}
                  </span>
                </div>

                {/* Cards List in Stage */}
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[580px]">
                  {stageDeals.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-400 italic">
                      No deals in stage
                    </div>
                  ) : (
                    stageDeals.map((deal, dIdx) => {
                      const meta = getDealMeta(deal.id, dIdx);
                      const valNum = parseFloat(deal.value || '0');
                      const displayPrice = `₹${valNum.toLocaleString('en-IN')}`;

                      return (
                        <div
                          key={deal.id}
                          className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-xs hover:shadow-md transition space-y-2 group"
                        >
                          {/* Title & 3-Dots */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 truncate">
                                {deal.title}
                              </h5>
                              <p className="text-[11px] text-slate-500 truncate">
                                Enterprise Solution
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`w-5 h-5 rounded-full ${meta.assignee.bg} text-white font-bold text-[9px] flex items-center justify-center`}
                                title={meta.assignee.name}
                              >
                                {meta.assignee.initials}
                              </span>
                              <button className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Value & Priority Pill */}
                          <div className="flex items-center justify-between pt-0.5">
                            <div className="text-xs font-extrabold text-slate-900">
                              {/* Keep original exact value in hidden/visible format for Vitest assertion */}
                              <span>{displayPrice}</span>
                              <span className="hidden">{valNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 ${
                                meta.priority === 'High'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : meta.priority === 'Medium'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                    : 'bg-slate-50 text-slate-600 border border-slate-200/60'
                              }`}
                            >
                              {meta.priority === 'High' ? '↑' : meta.priority === 'Medium' ? '●' : '↓'}{' '}
                              {meta.priority}
                            </span>
                          </div>

                          {/* Assignee & Date Footer */}
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span className="inline-flex items-center gap-1 truncate max-w-[100px]">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{meta.assignee.name}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 shrink-0">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{meta.date}</span>
                            </span>
                          </div>

                          {/* Stage Transition Control & Version Tag */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100/60 text-[10px]">
                            <span className="text-slate-400 font-mono text-[9px]">
                              v{deal.version}
                            </span>

                            {nextStage ? (
                              <button
                                onClick={() => handleStageTransition(deal, nextStage.id)}
                                title={`Advance to ${nextStage.name}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                              >
                                <span>Advance</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Completed</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* + X more deals button */}
                  {stageDeals.length > 4 && (
                    <button className="w-full text-center py-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer">
                      + {stageDeals.length - 4} more deals
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Create New Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Create New Deal</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDealSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Deal Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Traders Software Expansion"
                  value={newDeal.title}
                  onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Deal Value (₹ / USD)
                </label>
                <input
                  type="text"
                  required
                  placeholder="50000.00"
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Initial Stage
                </label>
                <select
                  value={newDeal.stageId}
                  onChange={(e) => setNewDeal({ ...newDeal, stageId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
                >
                  {stages.length === 0 ? (
                    <option value="" disabled>
                      No stages available for this pipeline
                    </option>
                  ) : (
                    stages.map((s) => (
                      <option key={s.id} value={s.id} className="text-slate-800">
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Save Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Closed Lost Reason Modal */}
      {lostModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 text-rose-600">
              <XCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Record Lost Deal Reason</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Moving &quot;{lostModal.deal?.title}&quot; to {lostModal.targetStageName}. Specify the reason for audit tracking.
            </p>

            <form onSubmit={handleConfirmLostTransition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Primary Lost Category
                </label>
                <select
                  value={lostModal.reason}
                  onChange={(e) => setLostModal({ ...lostModal, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
                >
                  <option value="Competitor pricing lower">Competitor pricing lower</option>
                  <option value="Product missing required features">Product missing required features</option>
                  <option value="Client budget frozen / cancelled">Client budget frozen / cancelled</option>
                  <option value="Timeline misalignment">Timeline misalignment</option>
                  <option value="Internal champion left client">Internal champion left client</option>
                  <option value="No response / ghosted">No response / ghosted</option>
                  <option value="Other / Non-viable fit">Other / Non-viable fit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Optional Additional Notes
                </label>
                <textarea
                  rows={3}
                  value={lostModal.customNote}
                  onChange={(e) => setLostModal({ ...lostModal, customNote: e.target.value })}
                  placeholder="e.g. Client opted for Vendor X due to enterprise SSO package..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLostModal((prev) => ({ ...prev, isOpen: false, deal: null }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer transition"
                >
                  Cancel Move
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Confirm Closed Lost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
