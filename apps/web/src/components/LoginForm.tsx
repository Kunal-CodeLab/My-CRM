import { useState } from 'react';
import { authApi, ApiError } from '../auth/api-client';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await authApi.login({ email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.problem.detail || 'Authentication failed. Please verify your credentials.');
      } else {
        setErrorMessage('Unable to connect to authentication server. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-3">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Sign in to your CRM</h2>
        <p className="text-sm text-slate-400 mt-1">Multi-Tenant Identity & Access Management</p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Work Email
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rep@acmecorp.com"
              className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <span>Authenticate Session</span>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-700/60 text-center text-sm text-slate-400">
        <span>Need a new organization? </span>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer"
        >
          Create account
        </button>
      </div>
    </div>
  );
};
