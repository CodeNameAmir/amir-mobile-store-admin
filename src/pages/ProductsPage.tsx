import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  BrandId,
  Product,
  ProductCategoryId,
  ProductInput,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
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
import { ProductFormModal } from '../components/products/ProductFormModal';
import { ProductDetailDrawer } from '../components/products/ProductDetailDrawer';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type SortFilter = 'newest' | 'price_asc' | 'price_desc' | 'stock_asc' | 'bestselling';

export function ProductsPage() {
  const { searchParams, navigate } = useRouter();
  const { preferences } = useAuth();
  const { pushToast } = useToast();

  const [search, setSearch] = useState(() => searchParams.get('search') || '');
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const querySearch = searchParams.get('search');
    if (querySearch !== null) {
      setSearch(querySearch);
      setPage(1);
    }
    if (searchParams.get('create') === '1') {
      setEditingProduct(null);
      setFormOpen(true);
      navigate('/products', { replace: true });
    }
  }, [searchParams, navigate]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listProducts({
        search: search.trim() || undefined,
        category,
        brand,
        stock,
        lowStockThreshold: preferences.lowStockThreshold,
        sort,
        page,
        pageSize: 12,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست محصولات.');
    } finally {
      setLoading(false);
    }
  }, [search, category, brand, stock, sort, page, preferences.lowStockThreshold]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleSaveProduct = async (input: ProductInput, isEdit: boolean) => {
    try {
      if (isEdit) {
        await adminApi.updateProduct(input.id, input);
        pushToast({
          tone: 'success',
          title: 'محصول ویرایش شد',
          description: input.nameFa,
        });
      } else {
        await adminApi.createProduct(input);
        pushToast({
          tone: 'success',
          title: 'محصول جدید ثبت شد',
          description: input.nameFa,
        });
      }
      await loadProducts();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره‌سازی محصول',
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
      await loadProducts();
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0b1c30]">مدیریت محصولات و کاتالوگ</h1>
          <p className="mt-1 text-xs text-[#434655]">
            ایجاد، ویرایش، حذف و مدیریت مشخصات کالاهای جدول products
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            disabled={safeItems.length === 0}
            onClick={handleExportCsv}
            icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
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
              placeholder="جستجو با نام فارسی، انگلیسی یا شناسه..."
              aria-label="جستجوی محصول"
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-[#c3c6d7] bg-[#f8f9ff] text-xs focus:bg-white focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <select
            aria-label="فیلتر دسته‌بندی"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as ProductCategoryId | 'all');
              setPage(1);
            }}
            className="h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-xs"
          >
            <option value="all">همه دسته‌بندی‌ها</option>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
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
            className="h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-xs"
          >
            <option value="all">همه برندها</option>
            {BRAND_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
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
            className="h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-xs"
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
            className="h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-xs"
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
          <ErrorState message={error} onRetry={() => void loadProducts()} />
        ) : safeItems.length === 0 ? (
          <EmptyState
            title="محصولی با این فیلترها یافت نشد"
            description="عبارت جستجو یا فیلترهای دسته‌بندی را تغییر دهید یا محصول جدیدی اضافه کنید."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(true);
                }}
              >
                افزودن محصول جدید
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#c3c6d7]/60 text-xs font-semibold text-[#434655]">
                    <th className="py-3 px-3">محصول</th>
                    <th className="py-3 px-3">دسته و برند</th>
                    <th className="py-3 px-3">قیمت فروش</th>
                    <th className="py-3 px-3">موجودی انبار</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d7]/40 text-xs">
                  {safeItems.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-[#f8f9ff] transition-colors"
                    >
                      <td className={`${preferences.compactRows ? 'py-2' : 'py-3.5'} px-3`}>
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <ProductThumb src={product.image} alt={product.nameFa} />
                          <div className="min-w-0">
                            <p className="font-bold text-[#0b1c30] truncate max-w-xs">
                              {product.nameFa}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#434655] truncate max-w-xs" dir="ltr">
                              {product.nameEn}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#434655]">
                        <p className="font-medium text-[#0b1c30]">{product.brand}</p>
                        <p className="text-[11px]">{CATEGORY_LABELS[product.category] || product.category || '—'}</p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                        <p className="font-bold text-[#0b1c30]">{formatToman(product.price)}</p>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <p className="text-[11px] text-[#737686] line-through">
                            {formatToman(product.originalPrice, false)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-bold text-[#0b1c30] tabular-nums-fa">
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
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailProduct(product)}
                            aria-label={`مشاهده جزئیات ${product.nameFa}`}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#434655] hover:bg-[#eff4ff] hover:text-[#004ac6]"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setFormOpen(true);
                            }}
                            aria-label={`ویرایش ${product.nameFa}`}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#434655] hover:bg-[#eff4ff] hover:text-[#004ac6]"
                          >
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(product)}
                            aria-label={`حذف ${product.nameFa}`}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#434655] hover:bg-[#ffdad6]/70 hover:text-[#ba1a1a]"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
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

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialProduct={editingProduct}
        onSubmit={handleSaveProduct}
      />

      <ProductDetailDrawer
        product={detailProduct}
        lowStockThreshold={preferences.lowStockThreshold}
        onClose={() => setDetailProduct(null)}
        onEdit={(prod) => {
          setEditingProduct(prod);
          setFormOpen(true);
        }}
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
