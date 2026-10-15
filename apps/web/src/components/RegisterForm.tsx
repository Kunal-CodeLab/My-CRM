import { useState } from 'react';
import { authApi, ApiError } from '../auth/api-client';
import { Building2, User, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
    organizationSlug: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOrgNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormData((prev) => ({
      ...prev,
      organizationName: name,
      organizationSlug: slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (formData.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters with numbers and uppercase letters.');
      return;
    }

    setLoading(true);

    try {
      await authApi.register(formData);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.problem.detail || 'Registration failed. Please check form values.');
      } else {
        setErrorMessage('Unable to complete registration. Please check server connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg p-8 bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-3">
          <Building2 className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Provision New Organization</h2>
        <p className="text-sm text-slate-400 mt-1">Two-phase atomic tenant & identity setup</p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              First Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Jane"
                className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Last Name
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Doe"
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Work Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="jane@acmecorp.com"
              className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Password (Min 8 chars, 1 uppercase, 1 digit)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-700/50">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Organization Name
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={formData.organizationName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
              placeholder="Acme Global Inc"
              className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Tenant Domain Slug
          </label>
          <div className="flex rounded-xl bg-slate-900/80 border border-slate-700 overflow-hidden text-sm">
            <span className="px-3 py-2 bg-slate-800 text-slate-400 border-r border-slate-700">app.crm/</span>
            <input
              type="text"
              required
              value={formData.organizationSlug}
              onChange={(e) => setFormData({ ...formData, organizationSlug: e.target.value })}
              placeholder="acme-global"
              className="flex-1 px-3 py-2 bg-transparent text-white focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Provisioning Tenant...</span>
            </>
          ) : (
            <span>Complete Setup & Sign In</span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-700/60 text-center text-sm text-slate-400">
        <span>Already have an account? </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer"
        >
          Sign in
        </button>
      </div>
    </div>
  );
};
