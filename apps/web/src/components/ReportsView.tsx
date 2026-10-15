import React, { useState } from 'react';
import {
  Calendar,
  Download,
  TrendingUp,
  ArrowUpRight,
  DollarSign,
  Trophy,
  Percent,
  Users,
} from 'lucide-react';
import { useToast } from './Toast';

export const ReportsView: React.FC = () => {
  const toast = useToast();
  const [dateRange, setDateRange] = useState('Oct 1, 2025 - Oct 31, 2025');
  const [selectedMember, setSelectedMember] = useState('All');

  const kpis = [
    { title: 'Total Revenue', value: dateRange === 'Year to Date' ? '₹1,84,50,000' : dateRange === 'Q3 2025' ? '₹92,40,000' : '₹34,70,000', change: '+32%', isPositive: true, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Total Deals', value: dateRange === 'Year to Date' ? '184' : dateRange === 'Q3 2025' ? '98' : '42', change: '+12%', isPositive: true, icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Conversion Rate', value: '28%', change: '+6%', isPositive: true, icon: Percent, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Avg. Deal Size', value: '₹82,619', change: '+14%', isPositive: true, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const monthlyRevenue = [
    { month: 'Jan', val: 40, label: '₹14L' },
    { month: 'Feb', val: 55, label: '₹18L' },
    { month: 'Mar', val: 70, label: '₹24L' },
    { month: 'Apr', val: 60, label: '₹20L' },
    { month: 'May', val: 85, label: '₹29L' },
    { month: 'Jun', val: 92, label: '₹31L' },
    { month: 'Jul', val: 80, label: '₹27L' },
    { month: 'Aug', val: 95, label: '₹32L' },
    { month: 'Sep', val: 90, label: '₹30L' },
    { month: 'Oct', val: 100, label: '₹34.7L' },
  ];

  const stages = [
    { name: 'Lead Qualified', count: 7, pct: '17%', color: 'bg-blue-500', hex: '#3b82f6' },
    { name: 'Discovery & Demo', count: 5, pct: '12%', color: 'bg-cyan-500', hex: '#06b6d4' },
    { name: 'Proposal Sent', count: 4, pct: '10%', color: 'bg-amber-500', hex: '#f59e0b' },
    { name: 'Negotiation', count: 3, pct: '7%', color: 'bg-purple-500', hex: '#a855f7' },
    { name: 'Closed Won', count: 23, pct: '55%', color: 'bg-emerald-500', hex: '#10b981' },
  ];

  const sources = [
    { name: 'Website Organic', pct: 32, color: 'bg-emerald-500' },
    { name: 'Customer Referral', pct: 24, color: 'bg-blue-500' },
    { name: 'Social Media', pct: 18, color: 'bg-purple-500' },
    { name: 'Cold Outreach', pct: 14, color: 'bg-amber-500' },
  ];

  const teamLeaderboard = [
    { id: 1, name: 'Nitin Gupta', role: 'Senior Sales Exec', dealsClosed: 14, revenue: '₹12,50,000', avatar: 'NG' },
    { id: 2, name: 'Kunal Choudhary', role: 'Head of Growth', dealsClosed: 12, revenue: '₹11,80,000', avatar: 'KC' },
    { id: 3, name: 'Priya Verma', role: 'Account Exec', dealsClosed: 9, revenue: '₹6,40,000', avatar: 'PV' },
    { id: 4, name: 'Amit Joshi', role: 'Enterprise Rep', dealsClosed: 7, revenue: '₹4,00,000', avatar: 'AJ' },
  ];

  const handleExportCsv = () => {
    const rows = [
      ['Metric', 'Value', 'Change'],
      ['Total Revenue', '₹34,70,000', '+32%'],
      ['Total Deals', '42', '+12%'],
      ['Conversion Rate', '28%', '+6%'],
      ['Avg Deal Size', '₹82,619', '+14%'],
      [],
      ['Stage', 'Deals Count', 'Percentage'],
      ['Lead Qualified', '7', '17%'],
      ['Discovery & Demo', '5', '12%'],
      ['Proposal Sent', '4', '10%'],
      ['Negotiation', '3', '7%'],
      ['Closed Won', '23', '55%'],
      [],
      ['Team Member', 'Role', 'Deals Closed', 'Revenue Generated'],
      ...teamLeaderboard.map(t => [t.name, t.role, t.dealsClosed.toString(), t.revenue])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `acme_crm_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report CSV generated and downloaded!');
  };

  const filteredLeaderboard = selectedMember === 'All'
    ? teamLeaderboard
    : teamLeaderboard.filter(t => t.name === selectedMember);

  return (
    <div className="space-y-5">
      {/* 1. Header with title & date range picker matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Reports &amp; Analytics</h2>
          <p className="text-xs text-slate-500">
            Get insights and make data-driven decisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter by Team Member matching reports.png */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs text-slate-700 shadow-2xs font-medium">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMember}
              onChange={(e) => {
                setSelectedMember(e.target.value);
                toast.info(`Filtered for ${e.target.value}`);
              }}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">All Team Members</option>
              <option value="Nitin Gupta">Nitin Gupta</option>
              <option value="Kunal Choudhary">Kunal Choudhary</option>
              <option value="Priya Verma">Priya Verma</option>
              <option value="Amit Joshi">Amit Joshi</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs text-slate-700 shadow-2xs font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                toast.info(`Updated report window: ${e.target.value}`);
              }}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Oct 1, 2025 - Oct 31, 2025">Oct 1, 2025 - Oct 31, 2025</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Q3 2025">Q3 2025</option>
              <option value="Year to Date">Year to Date</option>
            </select>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Four KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{kpi.title}</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                    {kpi.value}
                  </h3>
                </div>
                <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{kpi.change}</span>
                <span className="text-slate-400 font-normal">vs previous period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Row 1: Revenue Overview Bar Chart + Deals by Stage Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Revenue Overview (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Revenue Overview</h3>
            <span className="text-xs font-bold text-emerald-600">Oct 2025: ₹34.7L (+32%)</span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-4 pb-2">
            <div className="h-44 flex items-end justify-between gap-2 px-2 border-b border-slate-200">
              {monthlyRevenue.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="opacity-0 group-hover:opacity-100 transition absolute -top-7 bg-slate-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">
                    {item.label}
                  </div>
                  <div
                    className={`w-full max-w-[28px] rounded-t-lg transition duration-300 ${
                      item.month === 'Oct'
                        ? 'bg-emerald-500 shadow-md shadow-emerald-500/20'
                        : 'bg-emerald-200 hover:bg-emerald-400'
                    }`}
                    style={{ height: `${item.val}%` }}
                  />
                  <span className="text-[10px] font-semibold text-slate-500 mt-2">{item.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deals by Stage Donut / Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Deals by Stage</h3>
            <span className="text-xs text-slate-400">Total: 42</span>
          </div>

          <div className="flex items-center justify-center py-2">
            <div className="relative w-36 h-36 rounded-full border-8 border-emerald-500 flex items-center justify-center bg-emerald-50/20 shadow-inner">
              <div className="text-center">
                <span className="text-2xl font-black text-slate-900">42</span>
                <span className="block text-[10px] text-slate-500 uppercase font-bold">Total Deals</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            {stages.map((st, i) => (
              <div key={i} className="flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                  <span className="font-medium">{st.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{st.count}</span>
                  <span className="text-slate-400 text-[11px]">({st.pct})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Row 2: Top Sources + Recent Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Sources */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Sources</h3>

          <div className="space-y-3 pt-1">
            {sources.map((src, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{src.name}</span>
                  <span className="font-bold text-slate-900">{src.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${src.color} rounded-full`} style={{ width: `${src.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Performance summary */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Performance</h3>

          <div className="space-y-3 pt-1 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[11px]">Best Performing Pipeline</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">Real Estate</p>
              </div>
              <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                32%
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[11px]">Most Converted Source</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">Website Organic</p>
              </div>
              <span className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                32%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Row 3: Team Performance Leaderboard matching screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Team Performance Leaderboard</h3>
          <span className="text-xs text-slate-400">Monthly Ranking</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Rank</th>
                <th className="py-2.5 px-4">Sales Member</th>
                <th className="py-2.5 px-4">Deals Closed</th>
                <th className="py-2.5 px-4 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLeaderboard.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-500">#{member.id}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                        {member.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{member.name}</p>
                        <p className="text-[10px] text-slate-400">{member.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{member.dealsClosed} deals</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono text-sm">
                    {member.revenue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
