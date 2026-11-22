import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Boxes, RefreshCw, Search } from 'lucide-react';
import type { Warehouse, WarehouseStockItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { formatPersianNumber, toPersianDigits } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusTag } from '../ui/StatusBadge';
import { SwitchToggle } from '../ui/SwitchToggle';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

interface WarehouseStockTabProps {
  warehouses: Warehouse[];
  refreshSignal: number;
  onOpenMovementForStock: (item: WarehouseStockItem) => void;
}

export function WarehouseStockTab({
  warehouses,
  refreshSignal,
  onOpenMovementForStock,
}: WarehouseStockTabProps) {
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listWarehouseStock({
        warehouseId: warehouseId || undefined,
        productId: productId.trim() || undefined,
        variantId: variantId.trim() || undefined,
        lowStockOnly,
      });
      setStock(Array.isArray(res.stock) ? res.stock : []);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت موجودی لحظه‌ای قفسه‌ها.');
    } finally {
      setLoading(false);
    }
  }, [warehouseId, productId, variantId, lowStockOnly]);

  useEffect(() => {
    void loadStock();
  }, [loadStock, refreshSignal]);

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          <select
            aria-label="فیلتر بر اساس انبار"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="">همه انبارها</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.nameFa} ({wh.code})
              </option>
            ))}
          </select>

          <div className="relative">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="شناسه محصول"
              aria-label="فیلتر شناسه محصول"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd] transition-colors duration-150"
            />
          </div>

          <input
            type="search"
            dir="ltr"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            placeholder="شناسه تنوع"
            aria-label="فیلتر شناسه تنوع"
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd] transition-colors duration-150"
          />

          <div className="px-2">
            <SwitchToggle
              id="ws-low-stock-only"
              checked={lowStockOnly}
              onChange={setLowStockOnly}
              label="فقط کمبود موجودی"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-[#52565e] tabular-nums-fa">
              {toPersianDigits(total)} ردیف
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadStock()}
              icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              به‌روزرسانی
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadStock()} />
        ) : stock.length === 0 ? (
          <EmptyState
            title="موجودی قفسه‌ای با این فیلترها یافت نشد"
            description="برای شروع، از تب دفترکل ورود و خروج کالا یک تراکنش موجودی اول دوره یا ورود خرید ثبت کنید."
            icon={<Boxes className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">انبار</th>
                  <th className="py-3 px-3">SKU و شناسه کالا</th>
                  <th className="py-3 px-3">کد قفسه</th>
                  <th className="py-3 px-3">موجودی فیزیکی</th>
                  <th className="py-3 px-3">رزرو‌شده</th>
                  <th className="py-3 px-3">قابل فروش</th>
                  <th className="py-3 px-3">وضعیت هشدار</th>
                  <th className="py-3 px-3 text-left">گردش کالا</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {stock.map((row, idx) => (
                  <tr
                    key={row.id || `${row.warehouseId}-${row.variantId}-${idx}`}
                    className={`transition-colors duration-150 ${
                      row.isLowStock
                        ? 'bg-[#fffbeb]/70 hover:bg-[#fffbeb]'
                        : 'hover:bg-[#f7f8fa]'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <p className="font-semibold text-[#111315]">{row.warehouseNameFa || '—'}</p>
                      <p className="text-[11px] font-mono text-[#52565e]" dir="ltr">
                        {row.warehouseCode}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-mono font-medium text-[#0f49bd]" dir="ltr">
                        {row.sku}
                      </p>
                      <p className="text-[11px] text-[#52565e] mt-0.5">
                        {row.productNameFa || row.productId}
                        {row.partNumber ? ` · ${row.partNumber}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#111315]" dir="ltr">
                      {row.shelfLocation || '—'}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#111315] tabular-nums-fa">
                      {formatPersianNumber(row.quantityOnHand)}
                    </td>
                    <td className="py-3 px-3 text-[#52565e] tabular-nums-fa">
                      {formatPersianNumber(row.reservedQty)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#111315] tabular-nums-fa">
                      {formatPersianNumber(row.availableQty)} عدد
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {row.isLowStock ? (
                        <StatusTag
                          tone="warning"
                          icon={<AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          هشدار اتمام (حداقل {toPersianDigits(row.minStockAlert)})
                        </StatusTag>
                      ) : (
                        <StatusTag tone="success">
                          نرمال (حداقل {toPersianDigits(row.minStockAlert)})
                        </StatusTag>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenMovementForStock(row)}
                        icon={<ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                      >
                        ثبت تراکنش
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
