import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (total <= 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const safeTotalPages = Math.max(1, totalPages);
  const pages: number[] = [];
  const begin = Math.max(1, page - 2);
  const finish = Math.min(safeTotalPages, page + 2);
  for (let i = begin; i <= finish; i += 1) {
    pages.push(i);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#c3c6d7]/50 text-xs text-[#434655]">
      <div className="tabular-nums-fa">
        نمایش {toPersianDigits(start)} تا {toPersianDigits(end)} از مجموع{' '}
        <span className="font-semibold text-[#0b1c30]">{toPersianDigits(total)}</span> مورد
      </div>

      <nav className="flex items-center gap-1.5" aria-label="صفحه‌بندی">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="صفحه قبلی"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[#c3c6d7]/70 bg-white text-[#0b1c30] hover:bg-[#eff4ff] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`h-9 min-w-9 px-2.5 inline-flex items-center justify-center rounded-lg text-xs font-medium tabular-nums-fa transition-colors ${
              p === page
                ? 'bg-[#004ac6] text-white'
                : 'bg-white border border-[#c3c6d7]/70 text-[#0b1c30] hover:bg-[#eff4ff]'
            }`}
          >
            {toPersianDigits(p)}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= safeTotalPages}
          aria-label="صفحه بعدی"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[#c3c6d7]/70 bg-white text-[#0b1c30] hover:bg-[#eff4ff] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
