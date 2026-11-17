import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast, type ToastTone } from '../../context/ToastContext';

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'bg-white border-[#bbf7d0] text-[#0b1c30]',
  error: 'bg-white border-[#f5b7b1] text-[#0b1c30]',
  warning: 'bg-white border-[#f4bfa4] text-[#0b1c30]',
  info: 'bg-white border-[#b4c5ff] text-[#0b1c30]',
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') {
    return <CheckCircle2 className="h-5 w-5 text-[#16a34a] shrink-0" aria-hidden="true" />;
  }
  if (tone === 'error' || tone === 'warning') {
    return (
      <AlertCircle
        className={`h-5 w-5 shrink-0 ${tone === 'error' ? 'text-[#ba1a1a]' : 'text-[#8e3c00]'}`}
        aria-hidden="true"
      />
    );
  }
  return <Info className="h-5 w-5 text-[#004ac6] shrink-0" aria-hidden="true" />;
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 left-5 z-[60] flex flex-col gap-2.5 w-[calc(100vw-2.5rem)] max-w-sm"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg ${TONE_CLASSES[toast.tone]}`}
        >
          <ToastIcon tone={toast.tone} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#0b1c30]">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-xs text-[#434655]">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="بستن اعلان"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[#434655] hover:bg-[#eff4ff]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
