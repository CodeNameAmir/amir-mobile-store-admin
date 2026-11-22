import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111315]/40 backdrop-blur-[2px]"
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
        className={`relative z-10 w-full ${maxWidthClass} max-h-[90vh] flex flex-col bg-white rounded-2xl border border-black/[0.1] shadow-[0_16px_40px_rgba(17,19,21,0.14)] overflow-hidden ams-enter`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-black/[0.08]">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-sm font-semibold text-[#111315]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-[#52565e]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#f1f2f4] hover:text-[#111315] transition-colors duration-150 shrink-0"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-black/[0.08] bg-[#f6f6f7]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog;
}
