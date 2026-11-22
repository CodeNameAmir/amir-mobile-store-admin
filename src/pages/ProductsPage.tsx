import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  BrandId,
  BrandItem,
  CategoryItem,
  Product,
  ProductCategoryId,
  ProductInput,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import {
  fetchWithDedupe,
  getCachedValue,
  setCachedValue,
} from '../services/adminCache';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../router';
import {
  BRAND_OPTIONS,
  buildCsv,
  CATEGORY_LABELS,
  downloadCsvFile,
  formatToman,
  toPersianDigits,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { StockStatusTag } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ProductThumb } from '../components/ui/ProductThumb';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { QuickEditProductModal } from '../components/products/QuickEditProductModal';
import { ProductDetailDrawer } from '../components/products/ProductDetailDrawer';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type SortFilter = 'newest' | 'price_asc' | 'price_desc' | 'stock_asc' | 'bestselling';

export function ProductsPage() {
  const { searchParams, navigate } = useRouter();
  const { preferences } = useAuth();
  const { pushToast } = useToast();

  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  const [category, setCategory] = useState<ProductCategoryId | 'all'>('all');
  const [brand, setBrand] = useState<BrandId | 'all'>('all');
  const [stock, setStock] = useState<StockFilter>('all');
  const [sort, setSort] = useState<SortFilter>('newest');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [brandsList, setBrandsList] = useState<BrandItem[]>([]);

  useEffect(() => {
    void adminApi
      .listCategories()
      .then((res) => setCategoriesList(res.categories))
      .catch(() => undefined);
    void adminApi
      .listBrands()
      .then((res) => setBrandsList(res.brands))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const querySearch = searchParams.get('search');
    if (querySearch !== null) {
      setSearch(querySearch);
      setDebouncedSearch(querySearch);
      setPage(1);
    }
    if (searchParams.get('create') === '1') {
      navigate('/products/new', { replace: true });
    }
  }, [searchParams, navigate]);

  const loadProducts = useCallback(
    async (forceRefresh = false) => {
      const cacheKey = `products:list:${debouncedSearch.trim()}:${category}:${brand}:${stock}:${sort}:${page}:${preferences.lowStockThreshold}`;
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
            category,
            brand,
            stock,
            lowStockThreshold: preferences.lowStockThreshold,
            sort,
            page,
            pageSize: 12,
          })
        );
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (!cached) {
          setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست محصولات.');
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, category, brand, stock, sort, page, preferences.lowStockThreshold]
  );

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const openFullEdit = (product: Product) => {
    setCachedValue(`product:${product.id}`, product);
    navigate(`/products/edit?id=${encodeURIComponent(product.id)}`);
  };

  const handleQuickSaveProduct = async (id: string, patch: Partial<ProductInput>) => {
    try {
      const res = await adminApi.updateProduct(id, patch);
      setCachedValue(`product:${res.product.id}`, res.product);
      setItems((prev) => prev.map((p) => (p.id === id ? res.product : p)));
      pushToast({
        tone: 'success',
        title: 'ویرایش سریع ذخیره شد',
        description: res.product.nameFa,
      });
      void loadProducts(true);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ویرایش سریع محصول',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteProduct(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'محصول حذف شد',
        description: deleteTarget.nameFa,
      });
      setDeleteTarget(null);
      await loadProducts(true);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف محصول',
        description: err instanceof ApiError ? err.message : 'امکان حذف این محصول وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const safeItems = Array.isArray(items) ? items : [];

  const handleExportCsv = () => {
    if (safeItems.length === 0) return;
    const csv = buildCsv(
      ['شناسه', 'نام فارسی', 'نام انگلیسی', 'برند', 'دسته‌بندی', 'قیمت (تومان)', 'موجودی', 'وضعیت'],
      safeItems.map((p) => [
        p.id,
        p.nameFa,
        p.nameEn,
        p.brand,
        CATEGORY_LABELS[p.category] || p.category || '—',
        p.price,
        p.stockCount,
        p.inStock && p.stockCount > 0 ? 'موجود' : 'ناموجود',
      ])
    );
    downloadCsvFile('ams-products.csv', csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">مدیریت محصولات و کاتالوگ</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            ویرایش سریع قیمت و موجودی در جدول یا مدیریت کامل مشخصات فنی، رنگ و تنوع‌ها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadProducts(true)}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safeItems.length === 0}
            onClick={handleExportCsv}
            icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/products/new')}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            افزودن محصول
          </Button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو با نام فارسی، انگلیسی یا شناسه"
              aria-label="جستجوی محصول"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <select
            aria-label="فیلتر دسته‌بندی"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as ProductCategoryId | 'all');
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه دسته‌بندی‌ها</option>
            {(categoriesList.length > 0
              ? categoriesList.map((c) => ({ value: c.slug, label: c.label }))
              : Object.entries(CATEGORY_LABELS).map(([k, label]) => ({ value: k, label }))
            ).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر برند"
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value as BrandId | 'all');
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه برندها</option>
            {(brandsList.length > 0
              ? brandsList.map((b) => ({ value: b.name, label: b.labelFa || b.name }))
              : BRAND_OPTIONS.map((b) => ({ value: b, label: b }))
            ).map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر موجودی"
            value={stock}
            onChange={(e) => {
              setStock(e.target.value as StockFilter);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="in_stock">موجود</option>
            <option value="low_stock">کم‌موجود</option>
            <option value="out_of_stock">ناموجود</option>
          </select>

          <select
            aria-label="مرتب‌سازی محصولات"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortFilter);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="newest">جدیدترین</option>
            <option value="bestselling">پرفروش‌ترین</option>
            <option value="price_asc">ارزان‌ترین</option>
            <option value="price_desc">گران‌ترین</option>
            <option value="stock_asc">کمترین موجودی</option>
          </select>
        </div>
      </Card>

      {/* Products Table */}
      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadProducts(true)} />
        ) : safeItems.length === 0 ? (
          <EmptyState
            title="محصولی با این فیلترها یافت نشد"
            description="عبارت جستجو یا فیلترهای دسته‌بندی را تغییر دهید یا محصول جدیدی اضافه کنید."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/products/new')}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                افزودن محصول
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">محصول</th>
                    <th className="py-3 px-3">دسته و برند</th>
                    <th className="py-3 px-3">قیمت فروش</th>
                    <th className="py-3 px-3">موجودی انبار</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-left">عملیات و ویرایش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {safeItems.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-[#f7f8fa] transition-colors duration-150"
                    >
                      <td className={`${preferences.compactRows ? 'py-2' : 'py-3.5'} px-3`}>
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <ProductThumb src={product.image} alt={product.nameFa} />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#111315] truncate max-w-xs">
                              {product.nameFa}
                            </p>
                            <p className="mt-0.5 text-[11px] font-mono text-[#52565e] truncate max-w-xs" dir="ltr">
                              {product.nameEn}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#52565e]">
                        <p className="font-medium text-[#111315]">{product.brand}</p>
                        <p className="text-[11px]">{CATEGORY_LABELS[product.category] || product.category || '—'}</p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                        <p className="font-semibold text-[#111315]">{formatToman(product.price)}</p>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <p className="text-[11px] text-[#7c818c] line-through">
                            {formatToman(product.originalPrice, false)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-semibold text-[#111315] tabular-nums-fa">
                        {toPersianDigits(product.stockCount)} عدد
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StockStatusTag
                          inStock={product.inStock}
                          stockCount={product.stockCount}
                          lowThreshold={preferences.lowStockThreshold}
                        />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailProduct(product)}
                            aria-label={`مشاهده جزئیات ${product.nameFa}`}
                            title="مشاهده جزئیات"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#f1f2f4] hover:text-[#111315] transition-colors duration-150"
                          >
                            <Eye className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                          </button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setQuickEditProduct(product)}
                            aria-label={`ویرایش سریع ${product.nameFa}`}
                            icon={<Zap className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                          >
                            ویرایش سریع
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openFullEdit(product)}
                            aria-label={`ویرایش کامل ${product.nameFa}`}
                            icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                          >
                            ویرایش کامل
                          </Button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(product)}
                            aria-label={`حذف ${product.nameFa}`}
                            title="حذف محصول"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#fef3f2] hover:text-[#b42318] transition-colors duration-150"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        </div>
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
              pageSize={12}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <QuickEditProductModal
        product={quickEditProduct}
        onClose={() => setQuickEditProduct(null)}
        onSave={handleQuickSaveProduct}
        onOpenFullEdit={openFullEdit}
      />

      <ProductDetailDrawer
        product={detailProduct}
        lowStockThreshold={preferences.lowStockThreshold}
        onClose={() => setDetailProduct(null)}
        onQuickEdit={(prod) => setQuickEditProduct(prod)}
        onEdit={openFullEdit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        title="حذف محصول از کاتالوگ"
        description={`آیا از حذف محصول «${deleteTarget?.nameFa || ''}» اطمینان دارید؟ این عملیات در گزارش رویدادها ثبت خواهد شد.`}
        confirmLabel="حذف محصول"
      />
    </div>
  );
}
