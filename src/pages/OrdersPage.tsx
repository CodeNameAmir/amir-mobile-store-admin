import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, Search } from 'lucide-react';
import type { DeliverySlot, OrderRecord, OrderStatus } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../router';
import {
  buildCsv,
  DELIVERY_SLOT_LABELS,
  downloadCsvFile,
  formatToman,
  ORDER_STATUS_LABELS,
  toPersianDigits,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { OrderStatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';

export function OrdersPage() {
  const { searchParams } = useRouter();
  const { preferences } = useAuth();
  const { pushToast } = useToast();

  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [slotFilter, setSlotFilter] = useState<DeliverySlot | 'all'>('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<OrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    const querySearch = searchParams.get('search');
    if (querySearch !== null) {
      setSearch(querySearch);
      setPage(1);
    }
    const orderCodeParam = searchParams.get('orderCode');
    if (orderCodeParam) {
      void adminApi
        .getOrder(orderCodeParam)
        .then((res) => setSelectedOrder(res.order))
        .catch(() => undefined);
    }
  }, [searchParams]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listOrders({
        search: search.trim() || undefined,
        status: statusFilter,
        deliverySlot: slotFilter,
        page,
        pageSize: 12,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست سفارش‌ها.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, slotFilter, page]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleUpdateOrder = async (
    orderCode: string,
    payload: { status: OrderStatus; adminNote: string }
  ) => {
    try {
      const res = await adminApi.updateOrder(orderCode, payload);
      setSelectedOrder(res.order);
      setItems((prev) =>
        prev.map((o) => (o.orderCode === orderCode ? res.order : o))
      );
      pushToast({
        tone: 'success',
        title: 'سفارش به‌روزرسانی شد',
        description: `وضعیت سفارش #${orderCode} به «${ORDER_STATUS_LABELS[res.order.status]}» تغییر یافت.`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در به‌روزرسانی سفارش',
        description: err instanceof ApiError ? err.message : 'دوباره تلاش کنید.',
      });
      throw err;
    }
  };

  const safeItems = Array.isArray(items) ? items : [];

  const handleExportCsv = () => {
    if (safeItems.length === 0) return;
    const csv = buildCsv(
      ['کد سفارش', 'مشتری', 'تلفن', 'شهر', 'روش ارسال', 'کد شاپرک', 'مبلغ کل', 'وضعیت', 'تاریخ'],
      safeItems.map((o) => [
        o.orderCode,
        o.customerName,
        o.customerPhone,
        o.city,
        DELIVERY_SLOT_LABELS[o.deliverySlot] || '—',
        o.shaparakRef,
        o.totalAmount,
        ORDER_STATUS_LABELS[o.status] || String(o.status || 'نامشخص'),
        o.createdAt,
      ])
    );
    downloadCsvFile('ams-orders.csv', csv);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0b1c30]">مدیریت سفارش‌ها و مرسولات</h1>
          <p className="mt-1 text-xs text-[#434655]">
            بررسی جزئیات، شماره شاپرک، تغییر وضعیت ارسال و ثبت یادداشت مدیریت
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={safeItems.length === 0}
          onClick={handleExportCsv}
          icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          خروجی CSV سفارش‌ها
        </Button>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
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
              placeholder="جستجو با کد سفارش (AMIR-...)، نام یا موبایل مشتری..."
              aria-label="جستجوی سفارش"
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-[#c3c6d7] bg-[#f8f9ff] text-xs focus:bg-white focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="فیلتر وضعیت سفارش"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as OrderStatus | 'all');
                setPage(1);
              }}
              className="h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-xs"
            >
              <option value="all">همه وضعیت‌ها</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="فیلتر روش ارسال"
              value={slotFilter}
              onChange={(e) => {
                setSlotFilter(e.target.value as DeliverySlot | 'all');
                setPage(1);
              }}
              className="h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-xs"
            >
              <option value="all">همه روش‌های ارسال</option>
              <option value="express">ارسال اکسپرس</option>
              <option value="standard">پست پیشتاز</option>
            </select>
          </div>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadOrders()} />
        ) : safeItems.length === 0 ? (
          <EmptyState
            title="سفارشی با این فیلترها یافت نشد"
            description="عبارت جستجو یا وضعیت سفارش را تغییر دهید."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#c3c6d7]/60 text-xs font-semibold text-[#434655]">
                    <th className="py-3 px-3">کد سفارش</th>
                    <th className="py-3 px-3">خریدار</th>
                    <th className="py-3 px-3">اقلام</th>
                    <th className="py-3 px-3">مبلغ و ارسال</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3 text-left">جزئیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d7]/40 text-xs">
                  {safeItems.map((order) => {
                    const safeOrderItems = Array.isArray(order.items) ? order.items : [];
                    return (
                    <tr key={order.orderCode} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className={`${preferences.compactRows ? 'py-2' : 'py-3.5'} px-3 font-bold text-[#004ac6] tabular-nums-fa`} dir="ltr">
                        #{order.orderCode}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-[#0b1c30]">{order.customerName}</p>
                        <p className="text-[11px] text-[#434655] tabular-nums-fa">
                          {toPersianDigits(order.customerPhone)}
                          {order.city ? ` · ${order.city}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-[#434655] max-w-[220px]">
                        <p className="truncate font-medium text-[#0b1c30]">
                          {safeOrderItems[0]?.nameFa || '—'}
                        </p>
                        {safeOrderItems.length > 1 && (
                          <p className="text-[11px] text-[#434655] tabular-nums-fa">
                            و {toPersianDigits(safeOrderItems.length - 1)} قلم دیگر
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                        <p className="font-bold text-[#0b1c30]">
                          {formatToman(order.totalAmount)}
                        </p>
                        <p className="text-[11px] text-[#434655]">
                          {DELIVERY_SLOT_LABELS[order.deliverySlot] || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#434655]">
                        {order.createdAt}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                          icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          بررسی
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
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

      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdateOrder={handleUpdateOrder}
      />
    </div>
  );
}
