import { useState, useEffect } from 'react';
import { useAuthStore, singleFlightRefresh } from './auth/auth-store';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { AuthenticatedView } from './components/AuthenticatedView';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function App() {
  const { isAuthenticated, isLoading, setLoading } = useAuthStore();
  const [view, setView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    // Silent initial refresh to recover session from HttpOnly cookie on page reload
    singleFlightRefresh().finally(() => {
      setLoading(false);
    });
  }, [setLoading]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        {isLoading ? (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
            <span className="text-sm font-medium">Synchronizing Session...</span>
          </div>
        ) : isAuthenticated ? (
          <AuthenticatedView />
        ) : (
          <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-[#0c1424] flex flex-col items-center justify-center p-4">
            <header className="mb-6 flex items-center gap-2.5 text-slate-300">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Acme CRM</h1>
                <p className="text-xs text-slate-400">Grow. Connect. Close.</p>
              </div>
            </header>

            <main className="w-full flex justify-center">
              {view === 'login' ? (
                <LoginForm onSwitchToRegister={() => setView('register')} />
              ) : (
                <RegisterForm onSwitchToLogin={() => setView('login')} />
              )}
            </main>

            <footer className="mt-8 text-xs text-slate-500">
              &copy; 2025 Acme CRM. All rights reserved.
            </footer>
          </div>
        )}
      </ToastProvider>
    </ErrorBoundary>
  );
}
