import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Inbox, RefreshCw, ServerOff } from 'lucide-react';
import { Button } from './Button';

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  const [slowHint, setSlowHint] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlowHint(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="در حال بارگذاری داده‌ها">
      {slowHint && (
        <p className="text-xs text-[#52565e] bg-[#f1f2f4] border border-black/[0.08] rounded-lg px-3.5 py-2">
          در حال دریافت اطلاعات از سرور — ممکن است چند ثانیه زمان ببرد
        </p>
      )}
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 w-full rounded-lg bg-[#f1f2f4] border border-black/[0.05]"
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
      <div className="h-10 w-10 rounded-lg bg-[#f1f2f4] border border-black/[0.06] text-[#52565e] flex items-center justify-center mb-3">
        {icon || <Inbox className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
      </div>
      <h3 className="text-sm font-semibold text-[#111315]">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-[#52565e]">{description}</p>
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
      className="flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl bg-[#fef3f2] border border-[#fecaca]"
    >
      <div className="h-10 w-10 rounded-lg bg-white border border-[#fecaca] text-[#b42318] flex items-center justify-center mb-3">
        <AlertCircle className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-[#111315]">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-[#52565e]">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            تلاش مجدد
          </Button>
        </div>
      )}
    </div>
  );
}

export function EndpointUnsupportedState({
  title = 'این بخش در سرور API هنوز فعال نشده است',
  description = 'رابط کاربری این ماژول آماده است، اما مسیر API متناظر آن هنوز در سرور Backend پیاده‌سازی نشده است (پاسخ ۴۰۴/۵۰۱ یا صفحه HTML پیش‌فرض سرور دریافت شد).',
  endpointHint,
  onRetry,
}: {
  title?: string;
  description?: string;
  endpointHint?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08]"
    >
      <div className="h-10 w-10 rounded-lg bg-white border border-black/[0.08] text-[#52565e] flex items-center justify-center mb-3">
        <ServerOff className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-[#111315]">{title}</h3>
      <p className="mt-1.5 max-w-lg text-xs leading-6 text-[#52565e]">{description}</p>
      {endpointHint && (
        <p className="mt-2 px-2.5 py-1 rounded-md bg-white border border-black/[0.08] font-mono text-[11px] text-[#52565e]" dir="ltr">
          {endpointHint}
        </p>
      )}
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            بررسی مجدد اتصال
          </Button>
        </div>
      )}
    </div>
  );
}
