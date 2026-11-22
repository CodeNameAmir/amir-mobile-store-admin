import { useState, type FormEvent } from 'react';
import { Menu, Plus, Search } from 'lucide-react';
import { useRouter } from '../../router';
import { Button } from '../ui/Button';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');

  const handleQuickSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    const encoded = encodeURIComponent(q);
    if (/^(#?AMIR-|09\d{4,}|\d{5,})/i.test(q)) {
      navigate(`/orders?search=${encoded}`);
    } else if (q.includes('@')) {
      navigate(`/customers?search=${encoded}`);
    } else {
      navigate(`/products?search=${encoded}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-black/[0.08]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="باز کردن منوی ناوبری"
            className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg border border-black/[0.1] text-[#111315] hover:bg-[#f1f2f4] transition-colors duration-150 shrink-0"
          >
            <Menu className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>

          <form
            onSubmit={handleQuickSearch}
            className="relative flex-1 max-w-sm"
            role="search"
            aria-label="جستجوی سریع در پنل مدیریت"
          >
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی محصول، سفارش یا ایمیل"
              aria-label="جستجوی سریع در محصولات، سفارش‌ها یا مشتریان"
              className="w-full h-9 pr-9 pl-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08] text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd] focus:bg-white transition-colors duration-150"
            />
          </form>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/products/new')}
            icon={<Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          >
            افزودن محصول
          </Button>
        </div>
      </div>
    </header>
  );
}
