import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string | number;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected rendering error.',
    };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[260px] w-full max-w-lg mx-auto my-8 rounded-2xl bg-[#0F1324] border border-rose-400/35 p-6 text-center space-y-4">
          <AlertTriangle className="w-9 h-9 text-amber-300 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-display font-bold text-white">
              {this.props.fallbackTitle || 'Unable to load view'}
            </h2>
            <p className="text-xs text-slate-400 break-words">
              {this.state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
