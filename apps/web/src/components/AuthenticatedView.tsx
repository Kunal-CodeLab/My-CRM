import React, { useState } from 'react';
import { useAuthStore } from '../auth/auth-store';
import { authApi } from '../auth/api-client';
import { useToast } from './Toast';
import { DealsKanbanView } from './DealsKanbanView';
import { AccountsView } from './AccountsView';
import { ContactsView } from './ContactsView';
import { ActivitiesView } from './ActivitiesView';
import { OutboxWorkerView } from './OutboxWorkerView';
import { AuditPrivacyView } from './AuditPrivacyView';
import { CsvEngineView } from './CsvEngineView';
import { OpsView } from './OpsView';
import { TeamView } from './TeamView';
import { CommandPalette } from './CommandPalette';
import { SlideOverDrawer } from './SlideOverDrawer';
import { TopKpiCards } from './TopKpiCards';
import { RightWidgets } from './RightWidgets';
import { DashboardView } from './DashboardView';
import { CalendarView } from './CalendarView';
import { CallsWhatsAppView } from './CallsWhatsAppView';
import { EmailInboxView } from './EmailInboxView';
import { AutomationView } from './AutomationView';
import { ReportsView } from './ReportsView';
import { SettingsView } from './SettingsView';
import {
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
  Search,
  Bell,
  MessageSquare,
  LayoutGrid,
  Sparkles,
  ChevronDown,
  LogOut,
  Building,
  Shield,
} from 'lucide-react';

type TabType =
  | 'dashboard'
  | 'deals'
  | 'contacts'
  | 'companies'
  | 'activities'
  | 'calendar'
  | 'whatsapp'
  | 'email'
  | 'automation'
  | 'reports'
  | 'settings'
  | 'csv'
  | 'outbox'
  | 'audit'
  | 'team'
  | 'ops'
  | 'diagnostics';

export const AuthenticatedView: React.FC = () => {
  const toast = useToast();
  const { user, organization, availableOrganizations } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('deals');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 'n1', title: 'New Deal Assigned', desc: 'Project Alpha (₹4,50,000) assigned to you', time: '10m ago', tab: 'deals', read: false },
    { id: 'n2', title: 'New WhatsApp Message', desc: 'Priya Verma: "Can you send the proposal?"', time: '25m ago', tab: 'whatsapp', read: false },
    { id: 'n3', title: 'Upcoming Meeting', desc: 'Matrix Solutions at 11:00 AM today', time: '1h ago', tab: 'calendar', read: false },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Dynamic Metrics State
  const [totalPipelineValue, setTotalPipelineValue] = useState(3470000);
  const [totalDeals, setTotalDeals] = useState(42);
  const [wonDeals, setWonDeals] = useState(18);
  const [pendingDeals, setPendingDeals] = useState(16);
  const [wonRevenue, setWonRevenue] = useState(1248000);

  // Profile display name
  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Kunal Choudhary'
    : 'Kunal Choudhary';
  const roleDisplay = organization?.role
    ? organization.role.charAt(0).toUpperCase() + organization.role.slice(1)
    : 'Admin';

  const userInitials = user
    ? `${(user.firstName?.[0] || 'K')}${(user.lastName?.[0] || 'C')}`.toUpperCase()
    : 'KC';

  const handleLogout = async () => {
    try {
      await authApi.logout();
      toast.success('Signed out successfully.');
    } catch {
      useAuthStore.getState().clearAuthSession();
    }
  };

  const handleSwitchOrg = async (targetTenantId: string) => {
    if (targetTenantId === organization?.id) return;
    try {
      const data = await authApi.switchOrganization({ targetTenantId });
      toast.success(`Switched organization to ${data.organization.name}`);
      setProfileDropdownOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Organization switch failed');
    }
  };

  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'deals' as TabType, label: 'Deals', icon: Trophy },
    { id: 'contacts' as TabType, label: 'Contacts', icon: Users },
    { id: 'companies' as TabType, label: 'Companies', icon: Building2 },
    { id: 'activities' as TabType, label: 'Activities', icon: CheckSquare },
    { id: 'calendar' as TabType, label: 'Calendar', icon: Calendar },
    { id: 'whatsapp' as TabType, label: 'Calls & WhatsApp', icon: PhoneCall },
    { id: 'email' as TabType, label: 'Email', icon: Mail },
    { id: 'automation' as TabType, label: 'Automation', icon: Zap },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR (Dark Navy/Slate Theme from screenshot)    */}
      {/* ========================================================= */}
      <aside className="w-64 bg-[#0a101d] text-slate-300 flex flex-col justify-between h-screen shrink-0 border-r border-slate-800/90 z-20">
        <div>
          {/* Brand Logo & Tagline */}
          <div className="px-6 py-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
              <span className="text-base font-extrabold tracking-tighter">❖</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                Acme CRM
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Grow. Connect. Close.</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#10b981] text-white shadow-md shadow-emerald-600/25 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Promo Card & User Profile */}
        <div className="p-3 space-y-3">
          {/* Upgrade to Pro Card */}
          <div className="bg-[#131d2e] border border-slate-700/60 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white">Upgrade to Pro</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Unlock advanced features, more integrations and higher limits.
            </p>
            <button
              onClick={() => setActiveTab('settings')}
              className="w-full py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer"
            >
              Upgrade Now
            </button>
          </div>

          {/* User Profile Pill Row */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/70 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center">
                  {userInitials}
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-none">{displayName}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{roleDisplay}</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {/* Profile & Organization Dropdown */}
            {profileDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl z-40 text-xs space-y-1">
                <div className="px-3 py-1.5 border-b border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase font-bold">Active Organization</p>
                  <p className="text-xs font-semibold text-white mt-0.5 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{organization?.name || 'Acme Corporation'}</span>
                  </p>
                </div>

                {availableOrganizations.length > 1 && (
                  <div className="py-1">
                    <p className="px-3 text-[10px] text-slate-400 uppercase font-semibold">Switch Org</p>
                    {availableOrganizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => handleSwitchOrg(org.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                          org.id === organization?.id
                            ? 'bg-slate-800 text-emerald-400 font-bold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span>{org.name}</span>
                        <span className="text-[10px] text-slate-400">{org.role}</span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setDrawerOpen(true);
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tenant Security &amp; RBAC</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN APP CONTENT AREA (Header + Canvas + Right Widgets)  */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10 shadow-2xs">
          {/* Search Bar with Ctrl+K trigger */}
          <div className="w-full max-w-md">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs text-slate-500 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <span>Search deals, contacts, companies...</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500 shadow-2xs">
                Ctrl + K
              </kbd>
            </button>
          </div>

          {/* Right Header Icons & Mini Profile */}
          <div className="flex items-center gap-4">
            {/* Notification Bell with Dropdown Popover */}
            <div className="relative">
              <button
                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Panel */}
              {notificationDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    <button
                      onClick={() => {
                        setNotifications(notifications.map(n => ({ ...n, read: true })));
                        toast.success('Marked all as read');
                      }}
                      className="text-[10px] text-emerald-600 font-semibold hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.tab as TabType);
                          setNotificationDropdownOpen(false);
                          setNotifications(notifications.map(n => n.id === item.id ? { ...n, read: true } : n));
                        }}
                        className={`p-2.5 rounded-xl transition cursor-pointer text-left text-xs ${
                          item.read ? 'bg-slate-50/50 hover:bg-slate-100' : 'bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900">{item.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Navigation Button */}
            <button
              onClick={() => setActiveTab('whatsapp')}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
              title="Open WhatsApp &amp; Calls"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* App Grid Icon */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="CRM Apps &amp; Views"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-slate-200" />

            {/* Mini Profile Display */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                {userInitials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">{displayName}</p>
                <p className="text-[11px] text-slate-500">{roleDisplay}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Workspace Body */}
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#f8fafc]">
          {activeTab === 'dashboard' ? (
            <DashboardView
              onNavigateTab={(tab) => setActiveTab(tab as TabType)}
              userName={user?.firstName || 'Kunal'}
            />
          ) : activeTab === 'deals' ? (
            <>
              {/* 1. Greeting & 4 Top KPI Metric Cards */}
              <TopKpiCards
                userName={user?.firstName || 'Kunal'}
                totalDealsCount={totalDeals}
                wonDealsCount={wonDeals}
                pendingDealsCount={pendingDeals}
                wonRevenue={wonRevenue}
              />

              {/* 2. Main Flex Layout: Kanban (Left) + Right Widgets (Right) */}
              <div className="flex flex-col lg:flex-row items-start gap-5">
                {/* Kanban Deals Board (Left) */}
                <div className="flex-1 w-full min-w-0">
                  <DealsKanbanView
                    onTotalValueChange={setTotalPipelineValue}
                    onDealCountChange={(tot, won, pend, rev) => {
                      setTotalDeals(tot);
                      setWonDeals(won);
                      setPendingDeals(pend);
                      setWonRevenue(rev);
                    }}
                  />
                </div>

                {/* Right Column: Pipeline Value, Quick Actions, Activities */}
                <RightWidgets
                  onAddDeal={() => {
                    const btn = document.querySelector('button[title="Create Deal"]') as HTMLElement;
                    if (btn) btn.click();
                  }}
                  onNavigateTab={(tab) => setActiveTab(tab as TabType)}
                  totalPipelineValue={totalPipelineValue}
                />
              </div>
            </>
          ) : activeTab === 'contacts' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <ContactsView />
            </div>
          ) : activeTab === 'companies' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <AccountsView />
            </div>
          ) : activeTab === 'activities' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <ActivitiesView />
            </div>
          ) : activeTab === 'calendar' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <CalendarView />
            </div>
          ) : activeTab === 'whatsapp' ? (
            <CallsWhatsAppView />
          ) : activeTab === 'email' ? (
            <EmailInboxView />
          ) : activeTab === 'automation' ? (
            <AutomationView />
          ) : activeTab === 'reports' ? (
            <ReportsView />
          ) : activeTab === 'settings' ? (
            <SettingsView />
          ) : activeTab === 'csv' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <CsvEngineView />
            </div>
          ) : activeTab === 'outbox' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <OutboxWorkerView />
            </div>
          ) : activeTab === 'audit' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <AuditPrivacyView />
            </div>
          ) : activeTab === 'team' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <TeamView />
            </div>
          ) : activeTab === 'ops' ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <OpsView />
            </div>
          ) : (
            <SettingsView />
          )}

          {/* Page Bottom Footer matching screenshot */}
          <footer className="pt-6 pb-2 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200/80">
            <div>
              &copy; 2025 Acme CRM. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-slate-500">
              <span className="font-mono text-[11px]">v1.0.0</span>
              <a href="#privacy" className="hover:text-slate-700">Privacy</a>
              <a href="#terms" className="hover:text-slate-700">Terms</a>
              <a href="#support" className="hover:text-slate-700">Support</a>
            </div>
          </footer>
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectTab={(tab) => setActiveTab(tab as TabType)}
      />

      {/* Slide Over Drawer for Tenant Context */}
      <SlideOverDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Organization Metadata &amp; RBAC"
        subtitle={organization?.name || 'Acme Corporation'}
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-semibold text-slate-900">Tenant Identification</h4>
            <div className="font-mono text-slate-600 space-y-1 text-[11px]">
              <div>ID: {organization?.id}</div>
              <div>Slug: {organization?.slug}</div>
              <div>Status: Active</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-semibold text-slate-900">Role Permissions</h4>
            <div className="text-slate-700 space-y-1">
              <div>Assigned Role: <span className="font-bold text-emerald-600 uppercase">{organization?.role}</span></div>
              <div>Bulk CSV Access: <span className="text-emerald-700 font-medium">Enabled</span></div>
              <div>Audit Logging: <span className="text-emerald-700 font-medium">Active (Append-Only)</span></div>
            </div>
          </div>
        </div>
      </SlideOverDrawer>
    </div>
  );
};
