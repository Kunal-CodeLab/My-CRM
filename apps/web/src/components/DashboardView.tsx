import React, { useState } from 'react';
import {
  DollarSign,
  Trophy,
  Clock,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  Plus,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { useToast } from './Toast';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  userName?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab, userName = 'Kunal' }) => {
  const toast = useToast();
  const [dateRange, setDateRange] = useState('Oct 1, 2025 - Oct 31, 2025');

  const kpis = [
    {
      title: 'Total Deals',
      value: '42',
      change: '+12%',
      isPositive: true,
      icon: Trophy,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'Won Deals',
      value: '18',
      change: '+25%',
      isPositive: true,
      icon: CheckCircle2,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-100',
    },
    {
      title: 'Pending Deals',
      value: '16',
      change: '+7%',
      isPositive: true,
      icon: Clock,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-100',
    },
    {
      title: 'Revenue (Won)',
      value: '₹34,70,000',
      change: '+32%',
      isPositive: true,
      icon: DollarSign,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-100',
    },
  ];

  const pipelineStages = [
    { label: 'Lead Qualified', count: 7, value: '₹1,50,000', color: 'bg-blue-500', width: '22%' },
    { label: 'Discovery & Demo', count: 5, value: '₹2,10,000', color: 'bg-cyan-500', width: '38%' },
    { label: 'Proposal Sent', count: 4, value: '₹16,80,000', color: 'bg-amber-500', width: '58%' },
    { label: 'Negotiation', count: 3, value: '₹9,50,000', color: 'bg-indigo-500', width: '78%' },
    { label: 'Closed Won', count: 23, value: '₹34,70,000', color: 'bg-emerald-500', width: '100%' },
  ];

  const topPipelines = [
    { name: 'Real Estate', percentage: 32, value: '₹18.4L', color: 'bg-emerald-500' },
    { name: 'IT Services', percentage: 24, value: '₹13.8L', color: 'bg-blue-500' },
    { name: 'Education', percentage: 18, value: '₹10.3L', color: 'bg-amber-500' },
    { name: 'Others', percentage: 12, value: '₹6.9L', color: 'bg-slate-400' },
  ];

  const upcomingActivities = [
    {
      id: 1,
      title: 'Client Meeting - Matrix Solutions',
      time: 'Today, 11:00 AM',
      type: 'Meeting',
      icon: Calendar,
      color: 'bg-blue-100 text-blue-700',
    },
    {
      id: 2,
      title: 'Follow Up Call - Royal Builders',
      time: 'Today, 03:30 PM',
      type: 'Call',
      icon: Phone,
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 3,
      title: 'Send Contract - Acme Corp',
      time: 'Tomorrow, 10:00 AM',
      type: 'Email',
      icon: Mail,
      color: 'bg-purple-100 text-purple-700',
    },
  ];

  const recentActivities = [
    { id: 1, action: 'New deal added', detail: 'Project Alpha (₹4,50,000)', time: '2h ago', icon: Trophy, bg: 'bg-emerald-100 text-emerald-600' },
    { id: 2, action: 'Call completed', detail: 'Rahul Sharma (ABC Traders)', time: '3h ago', icon: Phone, bg: 'bg-blue-100 text-blue-600' },
    { id: 3, action: 'Email received', detail: 'Priya Verma - Proposal Accepted', time: '4h ago', icon: Mail, bg: 'bg-purple-100 text-purple-600' },
    { id: 4, action: 'Follow up call', detail: 'Amit Joshi (XYZ Enterprises)', time: '5h ago', icon: Phone, bg: 'bg-amber-100 text-amber-600' },
    { id: 5, action: 'Demo scheduled', detail: 'Solution Tech - Product Walkthrough', time: '6h ago', icon: Calendar, bg: 'bg-indigo-100 text-indigo-600' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header & Greeting Bar matching image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👋</span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Good Morning, {userName}!
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Here's what's happening with your business today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                toast.info(`Filtered data for ${e.target.value}`);
              }}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Oct 1, 2025 - Oct 31, 2025">Oct 1, 2025 - Oct 31, 2025</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Year</option>
            </select>
          </div>

          <button
            onClick={() => onNavigateTab('deals')}
            className="px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Deal</span>
          </button>
        </div>
      </div>

      {/* 2. Four KPI Cards matching 1:1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigateTab('deals')}
              className={`bg-white rounded-2xl p-5 border ${kpi.borderColor} shadow-2xs hover:shadow-md transition cursor-pointer relative overflow-hidden`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{kpi.title}</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                    {kpi.value}
                  </h3>
                </div>
                <div className={`p-2.5 rounded-xl ${kpi.bgColor} ${kpi.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{kpi.change}</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Deal Pipeline Progression Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Deal Pipeline Overview</h3>
            <p className="text-xs text-slate-500">Live breakdown across sales stages</p>
          </div>
          <button
            onClick={() => onNavigateTab('deals')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View Kanban</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
          {pipelineStages.map((stage, i) => (
            <div
              key={i}
              onClick={() => onNavigateTab('deals')}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-300 transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 truncate">{stage.label}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {stage.count}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 mt-2">{stage.value}</p>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div className={`h-full ${stage.color} rounded-full`} style={{ width: stage.width }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Three-Column Middle Row: Pipelines + Upcoming Activities + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Top Performing Pipelines */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Performing Pipelines</h3>
            <span className="text-[11px] text-slate-400">By Volume</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {topPipelines.map((pipe, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{pipe.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono text-[11px]">{pipe.value}</span>
                    <span className="font-bold text-slate-900">{pipe.percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${pipe.color} rounded-full`} style={{ width: `${pipe.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigateTab('reports')}
            className="w-full py-2 mt-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
          >
            View Full Report
          </button>
        </div>

        {/* Column 2: Upcoming Activities */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Upcoming Activities</h3>
            <button
              onClick={() => onNavigateTab('calendar')}
              className="text-xs text-emerald-600 font-semibold hover:underline"
            >
              Calendar
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {upcomingActivities.map((act) => {
              const Icon = act.icon;
              return (
                <div
                  key={act.id}
                  onClick={() => onNavigateTab('activities')}
                  className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-100 transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${act.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{act.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{act.time}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              );
            })}
          </div>

          <button
            onClick={() => onNavigateTab('activities')}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
          >
            Manage All Activities
          </button>
        </div>

        {/* Column 3: Recent Activities Stream */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Activities</h3>
            <span className="text-[11px] text-emerald-600 font-bold">Live Feed</span>
          </div>

          <div className="space-y-3 pt-1">
            {recentActivities.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.action}</p>
                      <p className="text-[11px] text-slate-500 truncate">{item.detail}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{item.time}</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => onNavigateTab('activities')}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
          >
            View Activity History
          </button>
        </div>
      </div>
    </div>
  );
};
