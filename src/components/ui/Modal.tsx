import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-2xl',
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${maxWidthClass} max-h-[90vh] flex flex-col bg-white rounded-2xl border border-[#c3c6d7]/70 shadow-xl overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#c3c6d7]/50">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-base font-bold text-[#0b1c30]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-[#434655]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-[#434655] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#c3c6d7]/50 bg-[#f8f9ff]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
