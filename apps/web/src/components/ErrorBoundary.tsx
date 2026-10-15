import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught CRM Frontend Exception in ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200">
          <div className="w-full max-w-lg bg-slate-900/90 border border-rose-500/30 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-5">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">Unexpected Application Error</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
              A runtime rendering exception occurred. The system safely caught this fault to protect session and data integrity.
            </p>

            {this.state.error && (
              <div className="mt-4 w-full p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-left overflow-x-auto">
                <span className="text-[11px] font-mono text-rose-300 block break-words">
                  {this.state.error.name}: {this.state.error.message}
                </span>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
