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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#c3c6d7]/60">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="باز کردن منوی ناوبری"
            className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-xl border border-[#c3c6d7]/70 text-[#0b1c30] hover:bg-[#eff4ff] shrink-0"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <form
            onSubmit={handleQuickSearch}
            className="relative flex-1 max-w-md"
            role="search"
            aria-label="جستجوی سریع در پنل مدیریت"
          >
            <Search
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737686]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در محصولات، کد سفارش (AMIR-...) یا ایمیل..."
              aria-label="جستجوی سریع در محصولات، سفارش‌ها یا مشتریان"
              className="w-full h-10 pr-10 pl-4 rounded-xl bg-[#f8f9ff] border border-[#c3c6d7]/70 text-xs text-[#0b1c30] placeholder:text-[#737686] focus:outline-none focus:border-[#2563eb] focus:bg-white transition-colors"
            />
          </form>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/products?create=1')}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            افزودن محصول جدید
          </Button>
        </div>
      </div>
    </header>
  );
}
