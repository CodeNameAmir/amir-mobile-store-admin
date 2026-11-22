import { useCallback, useEffect, useState } from 'react';
import { History, Plus, RefreshCw } from 'lucide-react';
import type { StockMovement, StockMovementType, Warehouse } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import {
  formatPersianDateTime,
  formatPersianNumber,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_TONES,
  toPersianDigits,
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusTag } from '../ui/StatusBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

interface StockMovementsTabProps {
  warehouses: Warehouse[];
  refreshSignal: number;
  onOpenNewMovement: () => void;
}

export function StockMovementsTab({
  warehouses,
  refreshSignal,
  onOpenNewMovement,
}: StockMovementsTabProps) {
  const [warehouseId, setWarehouseId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [movementType, setMovementType] = useState<StockMovementType | 'all'>('all');
  const [limit, setLimit] = useState(50);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listStockMovements({
        warehouseId: warehouseId || undefined,
        variantId: variantId.trim() || undefined,
        movementType,
        limit,
      });
      setMovements(Array.isArray(res.movements) ? res.movements : []);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت دفترکل تراکنش‌های انبار.');
    } finally {
      setLoading(false);
    }
  }, [warehouseId, variantId, movementType, limit]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements, refreshSignal]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#52565e] tabular-nums-fa">
          دفترکل تغییرناپذیر ورود و خروج کالا در انبارها ({toPersianDigits(total)} تراکنش)
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMovements()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onOpenNewMovement}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            ثبت تراکنش جدید انبار
          </Button>
        </div>
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            aria-label="فیلتر انبار در دفترکل"
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

          <select
            aria-label="فیلتر نوع تراکنش"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as StockMovementType | 'all')}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه انواع تراکنش</option>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="search"
            dir="ltr"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            placeholder="فیلتر شناسه تنوع"
            aria-label="فیلتر شناسه تنوع در دفترکل"
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd] transition-colors duration-150"
          />

          <select
            aria-label="تعداد ردیف‌ها"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value={25}>۲۵ تراکنش اخیر</option>
            <option value={50}>۵۰ تراکنش اخیر</option>
            <option value={100}>۱۰۰ تراکنش اخیر</option>
          </select>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadMovements()} />
        ) : movements.length === 0 ? (
          <EmptyState
            title="تراکنش انباری یافت نشد"
            description="برای ثبت اولین ورود یا خروج کالا، روی دکمه «ثبت تراکنش جدید انبار» کلیک کنید."
            icon={<History className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenNewMovement}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                ثبت تراکنش جدید انبار
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">زمان ثبت</th>
                  <th className="py-3 px-3">انبار</th>
                  <th className="py-3 px-3">تنوع / SKU</th>
                  <th className="py-3 px-3">نوع تراکنش</th>
                  <th className="py-3 px-3">تغییر تعداد</th>
                  <th className="py-3 px-3">مرجع و قفسه</th>
                  <th className="py-3 px-3">توضیحات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {movements.map((mov) => {
                  const typeLabel = MOVEMENT_TYPE_LABELS[mov.movementType] || mov.movementType;
                  const typeTone = MOVEMENT_TYPE_TONES[mov.movementType] || 'neutral';
                  const isPositive = mov.quantityChange > 0;
                  return (
                    <tr key={mov.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                      <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa">
                        {formatPersianDateTime(mov.createdAt)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <p className="font-semibold text-[#111315]">
                          {mov.warehouseNameFa || mov.warehouseCode || mov.warehouseId}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-mono font-medium text-[#0f49bd]" dir="ltr">
                          {mov.sku || mov.variantId}
                        </p>
                        {mov.productNameFa && (
                          <p className="text-[11px] text-[#52565e] truncate max-w-[180px]">
                            {mov.productNameFa}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusTag tone={typeTone}>{typeLabel}</StatusTag>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-semibold tabular-nums-fa" dir="ltr">
                        <span className={isPositive ? 'text-[#166534]' : 'text-[#b42318]'}>
                          {isPositive ? `+${toPersianDigits(mov.quantityChange)}` : formatPersianNumber(mov.quantityChange)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#52565e]" dir="ltr">
                        <p className="font-mono text-[11px]">
                          {mov.referenceType || mov.referenceId
                            ? `${mov.referenceType || ''}${mov.referenceId ? `: ${mov.referenceId}` : ''}`
                            : '—'}
                        </p>
                        {mov.shelfLocation && (
                          <p className="text-[11px] text-[#7c818c]">قفسه: {mov.shelfLocation}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#52565e] max-w-xs leading-5">
                        {mov.noteFa || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
