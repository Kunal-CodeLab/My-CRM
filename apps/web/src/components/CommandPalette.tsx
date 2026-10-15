import React, { useState, useEffect } from 'react';
import {
  Search,
  LayoutDashboard,
  Trophy,
  Users,
  Building2,
  CheckSquare,
  Calendar,
  PhoneCall,
  Mail,
  Zap,
  BarChart3,
  Settings,
  FileSpreadsheet,
  Cpu,
  Lock,
  UserCheck,
  ShieldCheck,
  X,
  ArrowRight,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onSelectTab }) => {
  const [query, setQuery] = useState('');

  const commands = [
    { id: 'dashboard', label: 'Dashboard & Business Overview', icon: LayoutDashboard, category: 'Overview' },
    { id: 'deals', label: 'Deals Pipeline & Kanban Board', icon: Trophy, category: 'Sales' },
    { id: 'contacts', label: 'Contacts Directory & Leads', icon: Users, category: 'CRM' },
    { id: 'companies', label: 'Companies & Business Accounts', icon: Building2, category: 'CRM' },
    { id: 'activities', label: 'Activities, Tasks & Meetings', icon: CheckSquare, category: 'Productivity' },
    { id: 'calendar', label: 'Calendar & Event Schedule', icon: Calendar, category: 'Productivity' },
    { id: 'whatsapp', label: 'Calls & WhatsApp Messages', icon: PhoneCall, category: 'Communication' },
    { id: 'email', label: 'Email Inbox & Compose', icon: Mail, category: 'Communication' },
    { id: 'automation', label: 'Automation Sequences & Workflows', icon: Zap, category: 'Automation' },
    { id: 'reports', label: 'Sales Reports & Analytics', icon: BarChart3, category: 'Analytics' },
    { id: 'settings', label: 'Settings & Configurations', icon: Settings, category: 'Settings' },
    { id: 'team', label: 'Team Members & Access Control', icon: UserCheck, category: 'Administration' },
    { id: 'csv', label: 'CSV Import & Export Engine', icon: FileSpreadsheet, category: 'Data & Tools' },
    { id: 'audit', label: 'Compliance & GDPR Erasure', icon: Lock, category: 'Security' },
    { id: 'ops', label: 'Operations & Reliability Drills', icon: ShieldCheck, category: 'Operations' },
    { id: 'outbox', label: 'Outbox Event Worker Logs', icon: Cpu, category: 'Infrastructure' },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase()) ||
    c.id.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a screen or command... (e.g. dashboard, deals, contacts, email)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching commands or navigation destinations.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className="w-full p-2.5 hover:bg-emerald-50/50 rounded-xl transition cursor-pointer flex items-center justify-between group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-500 group-hover:text-white transition">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-slate-900">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.category}</p>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                </button>
              );
            })
          )}
        </div>

        {/* Keyboard Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Navigate with mouse or keyboard</span>
          <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
            ESC to close
          </kbd>
        </div>
      </div>
    </div>
  );
};
