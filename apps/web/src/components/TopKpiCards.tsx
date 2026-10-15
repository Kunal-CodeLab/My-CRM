import React, { useState } from 'react';
import {
  TrendingUp,
  Trophy,
  Clock,
  Wallet,
  Calendar,
  ChevronDown,
} from 'lucide-react';

interface TopKpiCardsProps {
  userName?: string;
  totalDealsCount?: number;
  wonDealsCount?: number;
  pendingDealsCount?: number;
  wonRevenue?: number;
}

export const TopKpiCards: React.FC<TopKpiCardsProps> = ({
  userName = 'Kunal',
  totalDealsCount = 42,
  wonDealsCount = 18,
  pendingDealsCount = 16,
  wonRevenue = 1248000,
}) => {
  const [dateRange, setDateRange] = useState('Oct 1, 2025 – Oct 31, 2025');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="space-y-4">
      {/* 1. Greeting Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>👋</span>
            <span>{getGreeting()}, {userName}!</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>

        {/* Date Range Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{dateRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dateDropdownOpen && (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-1 text-xs">
              {['Today', 'This Week', 'Oct 1, 2025 – Oct 31, 2025', 'Last 30 Days', 'This Quarter'].map(
                (range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setDateRange(range);
                      setDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg transition ${
                      dateRange === range
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {range}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Four KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Deals Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Deals</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-extrabold text-slate-900">{totalDealsCount}</span>
                <span className="text-[11px] font-semibold text-emerald-600">↑ 12%</span>
              </div>
            </div>
          </div>
          {/* Mini Sparkline */}
          <svg className="w-16 h-8 text-emerald-500" viewBox="0 0 60 28">
            <path
              d="M 0,22 C 10,20 18,24 28,14 C 38,6 48,16 60,4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Won Deals Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Won Deals</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-extrabold text-slate-900">{wonDealsCount}</span>
                <span className="text-[11px] font-semibold text-emerald-600">↑ 25%</span>
              </div>
            </div>
          </div>
          {/* Mini Sparkline */}
          <svg className="w-16 h-8 text-sky-500" viewBox="0 0 60 28">
            <path
              d="M 0,20 C 12,22 22,12 34,16 C 44,20 52,8 60,3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Pending Deals Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Pending Deals</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-extrabold text-slate-900">{pendingDealsCount}</span>
                <span className="text-[11px] font-semibold text-emerald-600">↑ 7%</span>
              </div>
            </div>
          </div>
          {/* Mini Sparkline */}
          <svg className="w-16 h-8 text-amber-500" viewBox="0 0 60 28">
            <path
              d="M 0,16 C 14,18 24,14 36,20 C 46,24 54,12 60,8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Revenue (Won) Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Revenue (Won)</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                  ₹{wonRevenue.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">↑ 32%</span>
              </div>
            </div>
          </div>
          {/* Mini Sparkline */}
          <svg className="w-16 h-8 text-purple-500" viewBox="0 0 60 28">
            <path
              d="M 0,24 C 12,20 20,22 32,12 C 42,4 50,14 60,2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
