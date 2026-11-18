import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Edit3, RefreshCw, Search } from 'lucide-react';
import type { Product } from '../types/admin';
import { adminApi } from '../services/adminApi';
import {
  fetchWithDedupe,
  getCachedValue,
  setCachedValue,
} from '../services/adminCache';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  buildCsv,
  CATEGORY_LABELS,
  downloadCsvFile,
  formatPersianNumber,
  formatToman,
  toEnglishDigits,
  toPersianDigits,
  validateStockUpdate,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StockStatusTag } from '../components/ui/StatusBadge';
import { ProductThumb } from '../components/ui/ProductThumb';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';

type InventoryFilter = 'all' | 'low_stock' | 'out_of_stock' | 'in_stock';

export function InventoryPage() {
  const { preferences } = useAuth();
  const { pushToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [nextStockCount, setNextStockCount] = useState(0);
  const [nextInStock, setNextInStock] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadInventory = useCallback(
    async (forceRefresh = false) => {
      const cacheKey = `products:inv:${debouncedSearch.trim()}:${filter}:${page}:${preferences.lowStockThreshold}`;
      const cached = !forceRefresh
        ? getCachedValue<{ items: Product[]; total: number; totalPages: number }>(cacheKey)
        : null;

      if (cached) {
        setItems(Array.isArray(cached.data.items) ? cached.data.items : []);
        setTotal(cached.data.total);
        setTotalPages(cached.data.totalPages);
        setLoading(false);
        setError(null);
        if (cached.isFresh) return;
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetchWithDedupe(cacheKey, () =>
          adminApi.listProducts({
            search: debouncedSearch.trim() || undefined,
            stock: filter,
            lowStockThreshold: preferences.lowStockThreshold,
            sort: 'stock_asc',
            page,
            pageSize: 15,
          })
        );
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (!cached) {
          setError(err instanceof ApiError ? err.message : 'خطا در دریافت وضعیت انبار.');
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, filter, page, preferences.lowStockThreshold]
  );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const openAdjustModal = (product: Product) => {
    setAdjustTarget(product);
    setNextStockCount(product.stockCount);
    setNextInStock(product.inStock);
    setStockError(null);
  };

  const handleSaveStock = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    const validationErr = validateStockUpdate(nextStockCount);
    if (validationErr) {
      setStockError(validationErr);
      return;
    }

    setSaving(true);
    setStockError(null);
    try {
      const effectiveInStock = nextStockCount === 0 ? false : nextInStock;
      const res = await adminApi.updateProductStock(adjustTarget.id, {
        stockCount: nextStockCount,
        inStock: effectiveInStock,
      });
      const updatedProduct: Product = res.product ?? {
        ...adjustTarget,
        stockCount: nextStockCount,
        inStock: effectiveInStock,
      };
      setCachedValue(`product:${updatedProduct.id}`, updatedProduct);
      setItems((prev) =>
        prev.map((p) => (p.id === adjustTarget.id ? updatedProduct : p))
      );

      pushToast({
        tone: 'success',
        title: 'موجودی انبار به‌روزرسانی شد',
        description: `${adjustTarget.nameFa} (${toPersianDigits(nextStockCount)} عدد)`,
      });
      setAdjustTarget(null);
      void loadInventory(true);
    } catch (err) {
      setStockError(err instanceof ApiError ? err.message : 'خطا در ثبت موجودی جدید.');
    } finally {
      setSaving(false);
    }
  };

  const safeItems = Array.isArray(items) ? items : [];

  const handleExportCsv = () => {
    if (safeItems.length === 0) return;
    const csv = buildCsv(
      ['شناسه', 'نام کالا', 'برند', 'دسته‌بندی', 'تعداد موجودی', 'وضعیت فروش', 'قیمت (تومان)'],
      safeItems.map((p) => [
        p.id,
        p.nameFa,
        p.brand,
        CATEGORY_LABELS[p.category] || p.category || '—',
        p.stockCount,
        p.inStock ? 'فعال' : 'غیرفعال',
        p.price,
      ])
    );
    downloadCsvFile('ams-inventory.csv', csv);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0b1c30]">مدیریت موجودی و انبار</h1>
          <p className="mt-1 text-xs text-[#434655] tabular-nums-fa">
            کنترل سریع تعداد کالا (stock_count) و وضعیت موجودی (in_stock) · آستانه هشدار:{' '}
            {toPersianDigits(preferences.lowStockThreshold)} عدد
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadInventory(true)}
            icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safeItems.length === 0}
            onClick={handleExportCsv}
            icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            خروجی CSV انبار
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737686]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="جستجوی کالا در انبار..."
              aria-label="جستجوی کالا در انبار"
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-[#c3c6d7] bg-[#f8f9ff] text-xs focus:bg-white focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#eff4ff]"
            role="group"
            aria-label="فیلتر وضعیت موجودی"
          >
            {(
              [
                ['all', 'همه کالاها'],
                ['low_stock', 'کم‌موجود'],
                ['out_of_stock', 'ناموجود'],
                ['in_stock', 'موجود'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === key
                    ? 'bg-white text-[#004ac6] shadow-sm font-semibold'
                    : 'text-[#434655] hover:text-[#0b1c30]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Inventory Table */}
      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadInventory(true)} />
        ) : safeItems.length === 0 ? (
          <EmptyState
            title="کالایی در این بخش یافت نشد"
            description="فیلتر وضعیت موجودی یا عبارت جستجو را تغییر دهید."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#c3c6d7]/60 text-xs font-semibold text-[#434655]">
                    <th className="py-3 px-3">کالا</th>
                    <th className="py-3 px-3">برند</th>
                    <th className="py-3 px-3">قیمت واحد</th>
                    <th className="py-3 px-3">تعداد در انبار</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-left">اصلاح موجودی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d7]/40 text-xs">
                  {safeItems.map((product) => (
                    <tr key={product.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <ProductThumb src={product.image} alt={product.nameFa} />
                          <div className="min-w-0">
                            <p className="font-bold text-[#0b1c30] truncate max-w-xs">
                              {product.nameFa}
                            </p>
                            <p className="text-[11px] text-[#434655]">
                              {CATEGORY_LABELS[product.category] || product.category || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#434655]">{product.brand}</td>
                      <td className="py-3 px-3 font-medium text-[#0b1c30] tabular-nums-fa">
                        {formatToman(product.price)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#0b1c30] tabular-nums-fa">
                        {formatPersianNumber(product.stockCount)} عدد
                      </td>
                      <td className="py-3 px-3">
                        <StockStatusTag
                          inStock={product.inStock}
                          stockCount={product.stockCount}
                          lowThreshold={preferences.lowStockThreshold}
                        />
                      </td>
                      <td className="py-3 px-3 text-left">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAdjustModal(product)}
                          icon={<Edit3 className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          تنظیم موجودی
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={15}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title="تنظیم سریع موجودی کالا"
        subtitle={adjustTarget?.nameFa}
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdjustTarget(null)} disabled={saving}>
              انصراف
            </Button>
            <Button type="submit" form="stock-adjust-form" variant="primary" loading={saving}>
              ذخیره موجودی
            </Button>
          </>
        }
      >
        <form id="stock-adjust-form" onSubmit={handleSaveStock} className="space-y-4">
          {stockError && (
            <p role="alert" className="p-3 rounded-xl bg-[#ffdad6] text-xs text-[#ba1a1a]">
              {stockError}
            </p>
          )}
          <div>
            <label htmlFor="inv-stock-count" className="block text-xs font-medium text-[#0b1c30] mb-1.5">
              تعداد موجودی انبار
            </label>
            <input
              id="inv-stock-count"
              type="number"
              min={0}
              dir="ltr"
              value={nextStockCount}
              onChange={(e) => {
                const count = Math.max(0, Math.floor(Number(toEnglishDigits(e.target.value)) || 0));
                setNextStockCount(count);
                setNextInStock(count > 0);
              }}
              className="w-full h-11 px-3 rounded-xl border border-[#c3c6d7] text-sm font-bold tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={nextStockCount > 0 ? nextInStock : false}
              disabled={nextStockCount === 0}
              onChange={(e) => setNextInStock(e.target.checked)}
              className="h-4 w-4 rounded border-[#c3c6d7]"
            />
            <span>نمایش به‌عنوان موجود در فروشگاه آنلاین</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
