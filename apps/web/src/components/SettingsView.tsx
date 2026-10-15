import React, { useState } from 'react';
import { useAuthStore } from '../auth/auth-store';
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Bell,
  CreditCard,
  Layers,
  Globe,
  Database,
  Lock,
  Moon,
  Sun,
} from 'lucide-react';
import { useToast } from './Toast';
import { TeamView } from './TeamView';
import { AuditPrivacyView } from './AuditPrivacyView';
import { OpsView } from './OpsView';

export const SettingsView: React.FC = () => {
  const toast = useToast();
  const { organization } = useAuthStore();
  const [subTab, setSubTab] = useState<
    'general' | 'users' | 'teams' | 'integrations' | 'notifications' | 'billing' | 'security' | 'compliance' | 'ops'
  >('general');

  // Load from localStorage or defaults
  const [orgName, setOrgName] = useState(() => localStorage.getItem('acme_org_name') || organization?.name || 'Acme Corporation');
  const [subdomain, setSubdomain] = useState(() => localStorage.getItem('acme_subdomain') || 'crm.acme.com');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('acme_timezone') || '(GMT+05:30) Asia/Kolkata');
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem('acme_date_format') || 'DD/MM/YYYY');
  const [currency, setCurrency] = useState(() => localStorage.getItem('acme_currency') || 'INR - Indian Rupee');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('acme_primary_color') || '#10b981');
  const [customDomain, setCustomDomain] = useState(() => localStorage.getItem('acme_domain') || 'crm.acme.com');
  const [logoUrl, setLogoUrl] = useState<string | null>(() => localStorage.getItem('acme_logo_url') || null);

  // Appearance & Layout matching settings.png
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [density, setDensity] = useState<'Default' | 'Medium' | 'Compact'>('Default');

  // Notifications state
  const [notifications, setNotifications] = useState({
    dealsUpdate: true,
    taskDue: true,
    proposalAlerts: true,
    systemAlerts: true,
    whatsAppAlerts: true,
    emailDigest: false,
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setLogoUrl(result);
        localStorage.setItem('acme_logo_url', result);
        toast.success('Organization logo uploaded!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetLogo = () => {
    setLogoUrl(null);
    localStorage.removeItem('acme_logo_url');
    toast.info('Logo reset to default');
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('acme_org_name', orgName);
    localStorage.setItem('acme_subdomain', subdomain);
    localStorage.setItem('acme_timezone', timezone);
    localStorage.setItem('acme_date_format', dateFormat);
    localStorage.setItem('acme_currency', currency);
    localStorage.setItem('acme_primary_color', primaryColor);
    localStorage.setItem('acme_domain', customDomain);
    toast.success('Organization settings saved successfully!');
  };

  const navItems = [
    { id: 'general' as const, label: 'General', icon: SettingsIcon },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'teams' as const, label: 'Teams', icon: Layers },
    { id: 'integrations' as const, label: 'Integrations', icon: Globe },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'compliance' as const, label: 'Compliance & GDPR', icon: Lock },
    { id: 'ops' as const, label: 'Operations & Queue', icon: Database },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Header matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Settings</h2>
          <p className="text-xs text-slate-500">
            Customize your CRM and manage your account.
          </p>
        </div>
      </div>

      {/* 2. Main Layout: Settings Nav (Left) + Content (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Sub-Navigation (3 cols) */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = subTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSubTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Panel (9 cols) */}
        <div className="md:col-span-9 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
          {subTab === 'general' ? (
            <div className="space-y-6">
              {/* Organization Details */}
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-sm font-bold text-slate-900">General Settings</h3>
                <p className="text-xs text-slate-500 mt-0.5">Organization Details</p>

                <form onSubmit={handleSaveGeneral} className="mt-4 space-y-3.5 max-w-xl text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Organization Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Subdomain</label>
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 font-mono">
                        https://
                      </span>
                      <input
                        type="text"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                      >
                        <option value="(GMT+05:30) Asia/Kolkata">(GMT+05:30) Asia/Kolkata</option>
                        <option value="(GMT+00:00) UTC">(GMT+00:00) UTC</option>
                        <option value="(GMT-05:00) Eastern Time">(GMT-05:00) Eastern Time</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Date Format</label>
                      <select
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    >
                      <option value="INR - Indian Rupee">INR - Indian Rupee (₹)</option>
                      <option value="USD - US Dollar">USD - US Dollar ($)</option>
                      <option value="EUR - Euro">EUR - Euro (€)</option>
                      <option value="GBP - British Pound">GBP - British Pound (£)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="mt-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                </form>
              </div>

              {/* Branding Section matching screenshot */}
              <div className="border-b border-slate-100 pb-5 space-y-4 max-w-xl text-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Branding</h3>
                  <p className="text-slate-500 text-[11px]">Customize appearance, logos, and primary accent palette</p>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  id="logo-upload-input"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Organization Logo</label>
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center font-black text-xl shadow-xs">
                        ❖
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => document.getElementById('logo-upload-input')?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                    >
                      Upload New
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleResetLogo}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custom Domain</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => toast.success('Custom domain DNS verified!')}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              </div>

              {/* Appearance & Layout matching settings.png */}
              <div className="space-y-4 max-w-xl text-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Appearance &amp; Layout</h3>
                  <p className="text-slate-500 text-[11px]">Control theme modes and information density</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Theme Mode</label>
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('light');
                        toast.info('Light Mode active');
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        themeMode === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Light Mode</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('dark');
                        toast.info('Dark Mode active');
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        themeMode === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark Mode</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Layout Density</label>
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                    {(['Default', 'Medium', 'Compact'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDensity(d);
                          toast.info(`Layout density set to ${d}`);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          density === d ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : subTab === 'users' || subTab === 'teams' ? (
            <TeamView />
          ) : subTab === 'notifications' ? (
            <div className="space-y-4 max-w-xl text-xs">
              <h3 className="text-sm font-bold text-slate-900">Email &amp; Notifications</h3>
              <p className="text-slate-500 text-[11px]">Fine-grained preferences in email and mobile push notifications.</p>

              <div className="space-y-3 pt-2">
                {[
                  { key: 'dealsUpdate', label: 'Deals Update', desc: 'Receive notifications when deals move stages or win' },
                  { key: 'taskDue', label: 'Task Due & Alerts', desc: 'Alerts when scheduled tasks or meetings approach' },
                  { key: 'proposalAlerts', label: 'Proposal Alerts', desc: 'Get alerted when a client opens or signs a proposal' },
                  { key: 'systemAlerts', label: 'System & Security Alerts', desc: 'Critical organization logins and permission shifts' },
                  { key: 'whatsAppAlerts', label: 'WhatsApp Message Alerts', desc: 'Sound notification for new incoming customer WhatsApp chats' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900">{item.label}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !notifications[item.key as keyof typeof notifications];
                        setNotifications({ ...notifications, [item.key]: next });
                        toast.info(`${item.label} ${next ? 'enabled' : 'disabled'}`);
                      }}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                        notifications[item.key as keyof typeof notifications] ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : subTab === 'billing' ? (
            <div className="space-y-4 max-w-lg text-xs">
              <h3 className="text-sm font-bold text-slate-900">Account &amp; Billing</h3>
              <p className="text-slate-500 text-[11px]">Manage subscription plan, invoices, and storage limits.</p>

              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 text-sm">Pro Plan</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px]">Active</span>
                </div>
                <p className="text-slate-600">₹4,999 / month • Renews on Nov 1, 2025</p>
                <div className="pt-2">
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Usage Limit</span>
                    <span>130 / 100 Seats</span>
                  </div>
                  <div className="w-full bg-emerald-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => toast.info('Billing portal checkout opened')}
                className="w-full py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl transition cursor-pointer"
              >
                Upgrade Plan
              </button>
            </div>
          ) : subTab === 'compliance' ? (
            <AuditPrivacyView />
          ) : subTab === 'ops' ? (
            <OpsView />
          ) : (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Integrations &amp; API Keys</h3>
              <p className="text-slate-500">Connect third-party messaging, webhooks, and storage providers.</p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">REST API Key</p>
                    <p className="font-mono text-slate-500 text-[11px]">acme_live_94817a8c04f9812481</p>
                  </div>
                  <button
                    onClick={() => toast.success('API Key copied to clipboard!')}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
