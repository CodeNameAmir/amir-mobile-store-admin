import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  widthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-xl',
  children,
  footer,
}: DrawerProps) {
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
      className="fixed inset-0 z-50 flex justify-end bg-[#111315]/35 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="fixed inset-0" aria-hidden="true" onClick={onClose} />
      <aside
        className={`relative z-10 h-full w-full ${widthClass} bg-white border-r border-black/[0.1] shadow-[0_16px_48px_rgba(17,19,21,0.16)] flex flex-col`}
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
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#e8eaee] hover:text-[#111315] transition-colors duration-150 shrink-0"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-3.5 border-t border-black/[0.08] bg-[#f6f6f7] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
