import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  widthClass?: string;
  printable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-xl',
  printable = false,
  children,
  footer,
}: DrawerProps) {
  const asideRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      asideRef.current?.focus();
    }, 0);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-[#111315]/35 backdrop-blur-[2px] ${printable ? 'ams-print-drawer' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="fixed inset-0 ams-no-print" aria-hidden="true" onClick={onClose} />
      <aside
        ref={asideRef}
        tabIndex={-1}
        className={`relative z-10 h-full w-full ${widthClass} bg-white border-r border-black/[0.1] shadow-[0_16px_48px_rgba(17,19,21,0.16)] flex flex-col focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-black/[0.08] bg-[#f6f6f7]">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-sm font-semibold text-[#111315] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-[#52565e] truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنل جزئیات"
            className="ams-no-print h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#e8eaee] hover:text-[#111315] transition-colors duration-150 shrink-0"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-6 py-5 ${printable ? 'ams-print-drawer-body' : ''}`}>
          {children}
        </div>

        {footer && (
          <div className="ams-no-print px-6 py-3.5 border-t border-black/[0.08] bg-[#f6f6f7] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
