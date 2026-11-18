import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, LogIn, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  onReset?: () => void;
  onGoToLogin?: () => void;
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Technical error details are logged only to the browser console.
    console.error('[AMS Admin ErrorBoundary]', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  private handleGoToLogin = (): void => {
    this.setState({ hasError: false });
    if (this.props.onGoToLogin) {
      this.props.onGoToLogin();
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.title ?? 'خطای غیرمنتظره در نمایش این بخش';
    const description =
      this.props.description ??
      'در پردازش یا نمایش اطلاعات این صفحه مشکلی پیش آمد. می‌توانید دوباره تلاش کنید یا به صفحه ورود بازگردید.';

    return (
      <div
        role="alert"
        className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6 bg-[#f8f9ff]"
      >
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#ba1a1a]/25 shadow-sm p-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-[#0b1c30]">{title}</h2>
            <p className="text-xs leading-6 text-[#434655]">{description}</p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <Button
              variant="primary"
              size="md"
              onClick={this.handleRetry}
              icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            >
              تلاش مجدد
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={this.handleGoToLogin}
              icon={<LogIn className="h-4 w-4" aria-hidden="true" />}
            >
              بازگشت به صفحه ورود
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
