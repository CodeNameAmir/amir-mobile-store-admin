import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
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
      className="fixed inset-0 z-50 flex justify-end bg-[#0b1c30]/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="fixed inset-0" aria-hidden="true" onClick={onClose} />
      <aside
        className={`relative z-10 h-full w-full ${widthClass} bg-white border-r border-[#c3c6d7]/70 shadow-2xl flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#c3c6d7]/50 bg-[#f8f9ff]">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-base font-bold text-[#0b1c30] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-[#434655] truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنل جزئیات"
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-[#434655] hover:bg-[#e5eeff] hover:text-[#0b1c30] transition-colors shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-[#c3c6d7]/50 bg-[#f8f9ff] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
