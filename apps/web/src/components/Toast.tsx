import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: useCallback((message: string, title?: string) => addToast('success', message, title), [addToast]),
    error: useCallback((message: string, title?: string) => addToast('error', message, title, 5000), [addToast]),
    info: useCallback((message: string, title?: string) => addToast('info', message, title), [addToast]),
    warning: useCallback((message: string, title?: string) => addToast('warning', message, title), [addToast]),
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Toast Render Viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          const config = {
            success: {
              icon: CheckCircle2,
              bg: 'bg-slate-900/95 border-emerald-500/40 text-emerald-200',
              iconColor: 'text-emerald-400',
              accent: 'bg-emerald-500',
            },
            error: {
              icon: XCircle,
              bg: 'bg-slate-900/95 border-rose-500/40 text-rose-200',
              iconColor: 'text-rose-400',
              accent: 'bg-rose-500',
            },
            warning: {
              icon: AlertTriangle,
              bg: 'bg-slate-900/95 border-amber-500/40 text-amber-200',
              iconColor: 'text-amber-400',
              accent: 'bg-amber-500',
            },
            info: {
              icon: Info,
              bg: 'bg-slate-900/95 border-cyan-500/40 text-cyan-200',
              iconColor: 'text-cyan-400',
              accent: 'bg-cyan-500',
            },
          }[t.type];

          const IconComponent = config.icon;

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-200 ease-out transform translate-y-0 opacity-100 ${config.bg}`}
            >
              <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                {t.title && <h5 className="text-xs font-bold text-white mb-0.5">{t.title}</h5>}
                <p className="text-xs text-slate-300 leading-relaxed break-words">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
