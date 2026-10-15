import React, { useState } from 'react';
import {
  Plus,
  Play,
  Mail,
  MessageSquare,
  Users,
  ArrowDown,
  GitBranch,
} from 'lucide-react';
import { useToast } from './Toast';

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  actionsCount: number;
  status: 'Active' | 'Paused' | 'Draft';
}

const INITIAL_WORKFLOWS: Workflow[] = [
  { id: 'w1', name: 'New Lead - Welcome Sequence', trigger: 'New Contact Created', actionsCount: 4, status: 'Active' },
  { id: 'w2', name: 'Deal Follow Up Sequence', trigger: 'Deal Stage Changed', actionsCount: 3, status: 'Active' },
  { id: 'w3', name: 'Birthday Wishes & Renewal', trigger: 'Date Match', actionsCount: 2, status: 'Active' },
  { id: 'w4', name: 'Inactive Lead Nurture', trigger: 'No Activity (30 days)', actionsCount: 3, status: 'Paused' },
  { id: 'w5', name: 'Client Onboarding Drip', trigger: 'Deal Won', actionsCount: 4, status: 'Active' },
];

export const AutomationView: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Inactive' | 'Drafts'>('All');
  const [workflows, setWorkflows] = useState<Workflow[]>(INITIAL_WORKFLOWS);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(INITIAL_WORKFLOWS[0]);
  const [selectedNode, setSelectedNode] = useState<string>('node-action-1');
  const [activeRightTab, setActiveRightTab] = useState<'Properties' | 'History'>('Properties');

  // Properties form state
  const [nodeRecipient, setNodeRecipient] = useState('Kunal Choudhary');
  const [nodeTemplate, setNodeTemplate] = useState('Welcome Series - Email 1');
  const [executionLogs, setExecutionLogs] = useState([
    'Flow executed for Nitin Gupta at 11:35 AM',
    'Email sent to Rahul Sharma (ABC Traders) at 10:14 AM',
    'Task created for Priya Verma at 09:20 AM',
    'Deal updated: Enterprise tier moving to Proposal at 08:45 AM',
  ]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    trigger: 'New Contact Created',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Workflow = {
      id: 'w-' + Date.now(),
      name: newWorkflow.name,
      trigger: newWorkflow.trigger,
      actionsCount: 3,
      status: 'Active',
    };
    setWorkflows([created, ...workflows]);
    setSelectedWorkflow(created);
    setIsCreateModalOpen(false);
    setNewWorkflow({ name: '', trigger: 'New Contact Created' });
    toast.success(`Workflow "${created.name}" created!`);
  };

  const toggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkflows(workflows.map((w) => {
      if (w.id === id) {
        const nextStatus = w.status === 'Active' ? 'Paused' : 'Active';
        toast.info(`Workflow is now ${nextStatus}`);
        return { ...w, status: nextStatus };
      }
      return w;
    }));
  };

  const handleToolClick = (toolName: string) => {
    toast.success(`Added action node: "${toolName}" into canvas!`);
    setExecutionLogs([`Appended step: ${toolName} by Kunal`, ...executionLogs]);
  };

  const handleTestRun = () => {
    toast.success(`Simulated test run triggered for "${selectedWorkflow.name}"!`);
    setExecutionLogs([`Test run executed at ${new Date().toLocaleTimeString()}`, ...executionLogs]);
  };

  const filteredWorkflows = workflows.filter((w) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Active') return w.status === 'Active';
    if (activeTab === 'Inactive') return w.status === 'Paused';
    if (activeTab === 'Drafts') return w.status === 'Draft';
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 1. Header with title & Create Workflow button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Automation Builder</h2>
          <p className="text-xs text-slate-500">
            Automate your CRM workflows, triggers, actions, and save valuable time.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Workflow</span>
        </button>
      </div>

      {/* 2. Filter Pills matching screenshot */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs w-fit">
        {(['All', 'Active', 'Inactive', 'Drafts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. 3-Column Layout: Sequence List (3 cols) + Visual Canvas (6 cols) + Properties Panel (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Sequence List (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">All Automations</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {filteredWorkflows.length}
            </span>
          </div>

          <div className="space-y-2">
            {filteredWorkflows.map((wf) => {
              const isSelected = wf.id === selectedWorkflow.id;
              return (
                <div
                  key={wf.id}
                  onClick={() => setSelectedWorkflow(wf)}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100/70 border-slate-100'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900 truncate">{wf.name}</p>
                  <p className="text-[10px] text-slate-500 mt-1 truncate">Trigger: {wf.trigger}</p>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/50">
                    <span className="text-[10px] text-slate-400">{wf.actionsCount} actions</span>
                    <span
                      onClick={(e) => toggleStatus(wf.id, e)}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer ${
                        wf.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {wf.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Visual Flow Canvas matching automation.png (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{selectedWorkflow.name}</h3>
              <p className="text-xs text-slate-500">Live trigger sequence automation map</p>
            </div>

            <button
              onClick={handleTestRun}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test Run</span>
            </button>
          </div>

          {/* Visual Flow Nodes matching screenshot */}
          <div className="space-y-3 py-2 max-w-md mx-auto">
            {/* Step 1: Entry Point Trigger */}
            <div
              onClick={() => setSelectedNode('node-entry')}
              className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between shadow-2xs ${
                selectedNode === 'node-entry' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/20' : 'bg-blue-50/50 border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500 text-white shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-blue-600 block">Entry Point</span>
                  <p className="text-xs font-bold text-slate-900">Trigger: New Lead Created</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Trigger
              </span>
            </div>

            <div className="flex justify-center text-slate-300">
              <ArrowDown className="w-4 h-4" />
            </div>

            {/* Step 2: Condition Decision */}
            <div
              onClick={() => setSelectedNode('node-cond-1')}
              className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between shadow-2xs ${
                selectedNode === 'node-cond-1' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20' : 'bg-amber-50/50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-amber-600 block">Condition Check</span>
                  <p className="text-xs font-bold text-slate-900">Is Lead Score &gt; 80?</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                If / Else
              </span>
            </div>

            <div className="flex justify-center text-slate-300">
              <ArrowDown className="w-4 h-4" />
            </div>

            {/* Step 3: Action Node 1 */}
            <div
              onClick={() => setSelectedNode('node-action-1')}
              className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between shadow-2xs ${
                selectedNode === 'node-action-1' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20' : 'bg-emerald-50/50 border-emerald-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-600 block">Action 1</span>
                  <p className="text-xs font-bold text-slate-900">Send Welcome Email</p>
                  <p className="text-[10px] text-slate-500">Wait: 1 Day • Template: Welcome series</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Action
              </span>
            </div>

            <div className="flex justify-center text-slate-300">
              <ArrowDown className="w-4 h-4" />
            </div>

            {/* Step 4: Action Node 2 */}
            <div
              onClick={() => setSelectedNode('node-action-2')}
              className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between shadow-2xs ${
                selectedNode === 'node-action-2' ? 'bg-teal-50 border-teal-400 ring-2 ring-teal-400/20' : 'bg-teal-50/50 border-teal-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-500 text-white shadow-xs">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-teal-600 block">Action 2</span>
                  <p className="text-xs font-bold text-slate-900">Send WhatsApp Follow Up</p>
                  <p className="text-[10px] text-slate-500">Wait: 2 Days • Text: Introductory demo check</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                Action
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Properties & Automation Tools Drawer (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Properties & History Box */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex items-center border-b border-slate-100">
              <button
                onClick={() => setActiveRightTab('Properties')}
                className={`flex-1 py-1.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                  activeRightTab === 'Properties' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Properties
              </button>
              <button
                onClick={() => setActiveRightTab('History')}
                className={`flex-1 py-1.5 text-xs font-bold border-b-2 transition cursor-pointer ${
                  activeRightTab === 'History' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                History
              </button>
            </div>

            {activeRightTab === 'Properties' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Recipient</label>
                  <input
                    type="text"
                    value={nodeRecipient}
                    onChange={(e) => setNodeRecipient(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Template</label>
                  <select
                    value={nodeTemplate}
                    onChange={(e) => setNodeTemplate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Welcome Series - Email 1">Welcome Series - Email 1</option>
                    <option value="Product Demo Invite">Product Demo Invite</option>
                    <option value="Discount Offer Q4">Discount Offer Q4</option>
                  </select>
                </div>

                <button
                  onClick={() => toast.success('Node properties saved!')}
                  className="w-full py-1.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
                >
                  Save Step
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-[11px] max-h-48 overflow-y-auto">
                {executionLogs.map((log, i) => (
                  <div key={i} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <span className="text-slate-700 leading-tight">{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automation Tools Palette matching automation.png */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Automation Tools</h4>

            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Triggers</span>
              <button
                onClick={() => handleToolClick('Deal Updated Trigger')}
                className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 hover:border-emerald-300 transition cursor-pointer flex items-center justify-between"
              >
                <span>Deal Updated</span>
                <Plus className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => handleToolClick('Contact Tag Added')}
                className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 hover:border-emerald-300 transition cursor-pointer flex items-center justify-between"
              >
                <span>Contact Tag Added</span>
                <Plus className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <span className="text-[10px] font-bold uppercase text-slate-400 block pt-1">Actions</span>
              <button
                onClick={() => handleToolClick('Send Email Action')}
                className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 hover:border-emerald-300 transition cursor-pointer flex items-center justify-between"
              >
                <span>Send Email</span>
                <Plus className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => handleToolClick('Create Task Action')}
                className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 hover:border-emerald-300 transition cursor-pointer flex items-center justify-between"
              >
                <span>Create Task</span>
                <Plus className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => handleToolClick('Update Deal Action')}
                className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 hover:border-emerald-300 transition cursor-pointer flex items-center justify-between"
              >
                <span>Update Deal</span>
                <Plus className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Workflow Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Create Workflow Automation</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Workflow Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inactive Deal Re-engagement"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trigger Event</label>
                <select
                  value={newWorkflow.trigger}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="New Contact Created">New Contact Created</option>
                  <option value="Deal Stage Changed">Deal Stage Changed</option>
                  <option value="Deal Won">Deal Won</option>
                  <option value="No Activity (30 days)">No Activity (30 days)</option>
                  <option value="Date Match">Date Match (Birthday/Renewal)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
