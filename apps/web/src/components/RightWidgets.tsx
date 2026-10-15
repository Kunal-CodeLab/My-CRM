import React from 'react';
import {
  TrendingUp,
  Plus,
  UserPlus,
  Calendar,
  Phone,
  MessageCircle,
  Mail,
  ChevronRight,
  Video,
  Trophy,
} from 'lucide-react';

interface RightWidgetsProps {
  onAddDeal: () => void;
  onNavigateTab?: (tab: string) => void;
  totalPipelineValue?: number;
}

export const RightWidgets: React.FC<RightWidgetsProps> = ({
  onAddDeal,
  onNavigateTab,
  totalPipelineValue = 3470000,
}) => {
  return (
    <aside className="w-full lg:w-[280px] xl:w-[310px] shrink-0 space-y-4">
      {/* 1. Pipeline Value Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">Pipeline Value</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
            <TrendingUp className="w-3 h-3" />
            <span>18%</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            ₹{totalPipelineValue.toLocaleString('en-IN')}
          </h3>
          {/* Mini Sparkline Chart */}
          <svg className="w-20 h-8 text-emerald-500 overflow-visible" viewBox="0 0 80 32">
            <path
              d="M 0,26 C 15,24 25,28 35,18 C 45,8 55,20 65,12 C 72,6 77,4 80,2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* 2. Quick Actions Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-1">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
          Quick Actions
        </h4>

        <div className="space-y-1 text-xs">
          <button
            onClick={onAddDeal}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/70 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </span>
              <span>Add New Deal</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
          </button>

          <button
            onClick={() => onNavigateTab?.('contacts')}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-slate-700 hover:text-sky-700 hover:bg-sky-50/70 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <UserPlus className="w-3.5 h-3.5" />
              </span>
              <span>Add Contact</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition" />
          </button>

          <button
            onClick={() => onNavigateTab?.('activities')}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-slate-700 hover:text-purple-700 hover:bg-purple-50/70 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <span>Schedule Activity</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
          </button>

          <a
            href="tel:+919876543210"
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/70 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Phone className="w-3.5 h-3.5" />
              </span>
              <span>Make a Call</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
          </a>

          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-slate-700 hover:text-green-700 hover:bg-green-50/70 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <span className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5" />
              </span>
              <span>Send WhatsApp</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition" />
          </a>

          <a
            href="mailto:contact@acme.com"
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-slate-700 hover:text-blue-700 hover:bg-blue-50/70 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <span>Send Email</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
          </a>
        </div>
      </div>

      {/* 3. Upcoming Activities Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Upcoming Activities
          </h4>
          <button
            onClick={() => onNavigateTab?.('activities')}
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
          >
            View All
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-start justify-between p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer group">
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">Client Meeting</p>
                <p className="text-[11px] text-slate-500">Today, 11:00 AM</p>
                <p className="text-[11px] text-slate-400">Bright Future School</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </div>

          <div className="flex items-start justify-between p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer group">
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Phone className="w-3.5 h-3.5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">Follow Up Call</p>
                <p className="text-[11px] text-slate-500">Today, 02:30 PM</p>
                <p className="text-[11px] text-slate-400">Matrix Solutions</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </div>

          <div className="flex items-start justify-between p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer group">
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">Send Proposal</p>
                <p className="text-[11px] text-slate-500">Tomorrow, 10:00 AM</p>
                <p className="text-[11px] text-slate-400">Royal Builders</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </div>

          <div className="flex items-start justify-between p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer group">
            <div className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                <Video className="w-3.5 h-3.5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">Demo Call</p>
                <p className="text-[11px] text-slate-500">Tomorrow, 04:00 PM</p>
                <p className="text-[11px] text-slate-400">TechVision Ltd</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </div>
        </div>
      </div>

      {/* 4. Recent Activity Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Recent Activity
          </h4>
          <button
            onClick={() => onNavigateTab?.('activities')}
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
          >
            View All
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="w-7 h-7 rounded-full bg-slate-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              RS
            </span>
            <div>
              <p className="text-slate-800 leading-tight">
                <span className="font-semibold text-slate-900">Rohit Sharma</span> updated deal status
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">2 hours ago</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-7 h-7 rounded-full bg-sky-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              PV
            </span>
            <div>
              <p className="text-slate-800 leading-tight">
                New contact added: <span className="font-semibold text-slate-900">Priya Verma</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">3 hours ago</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-600 font-bold text-[10px] flex items-center justify-center shrink-0">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
            </span>
            <div>
              <p className="text-slate-800 leading-tight">
                Deal won: <span className="font-semibold text-slate-900">LegalTech Solutions</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">5 hours ago</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-600 font-bold text-[10px] flex items-center justify-center shrink-0">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
            </span>
            <div>
              <p className="text-slate-800 leading-tight">
                Call completed with <span className="font-semibold text-slate-900">Karan Malhotra</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Yesterday, 04:20 PM</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
