import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast, type ToastTone } from '../../context/ToastContext';

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'bg-white border-[#bbf7d0] text-[#111315]',
  error: 'bg-white border-[#fecaca] text-[#111315]',
  warning: 'bg-white border-[#fde68a] text-[#111315]',
  info: 'bg-white border-[#c7d7f8] text-[#111315]',
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') {
    return <CheckCircle2 className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />;
  }
  if (tone === 'error' || tone === 'warning') {
    return (
      <AlertCircle
        className={`h-4 w-4 shrink-0 mt-0.5 ${tone === 'error' ? 'text-[#b42318]' : 'text-[#9a4a06]'}`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
    );
  }
  return <Info className="h-4 w-4 text-[#0f49bd] shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />;
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border shadow-[0_8px_24px_rgba(17,19,21,0.1)] ams-enter ${TONE_CLASSES[toast.tone]}`}
        >
          <ToastIcon tone={toast.tone} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#111315]">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-xs text-[#52565e]">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="بستن اعلان"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#f1f2f4] transition-colors duration-150"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
