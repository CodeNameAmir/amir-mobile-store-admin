import type { ReactNode } from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="در حال بارگذاری داده‌ها">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-14 w-full rounded-xl bg-[#eff4ff]/80 border border-[#c3c6d7]/40 animate-pulse"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="h-12 w-12 rounded-2xl bg-[#eff4ff] text-[#004ac6] flex items-center justify-center mb-3">
        {icon || <Inbox className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="text-sm font-bold text-[#0b1c30]">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-6 text-[#434655]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'خطا در دریافت اطلاعات',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center text-center py-10 px-4 rounded-2xl bg-[#ffdad6]/40 border border-[#ba1a1a]/25"
    >
      <div className="h-11 w-11 rounded-xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-3">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-[#0b1c30]">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-6 text-[#434655]">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            تلاش مجدد
          </Button>
        </div>
      )}
    </div>
  );
}
