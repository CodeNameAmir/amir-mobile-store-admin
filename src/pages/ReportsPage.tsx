import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Printer, RefreshCw } from 'lucide-react';
import type {
  DashboardData,
  DashboardGranularity,
  OrderRecord,
  OrderReturnRecord,
  PaymentTransaction,
  WarehouseStockItem,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  buildCsv,
  calculateInventoryValuation,
  downloadCsvFile,
  formatPersianNumber,
  formatToman,
  PAYMENT_TX_STATUS_LABELS,
  RETURN_STATUS_LABELS,
  toPersianDigits,
} from '../utils/formatters';
import { summarizeOrderStatuses } from '../utils/crmAndSla';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { OrderStatusBadge } from '../components/ui/StatusBadge';
import { ErrorState, LoadingSkeleton } from '../components/ui/StateViews';

export function ReportsPage() {
  const { preferences } = useAuth();
  const { pushToast } = useToast();

  const [granularity, setGranularity] = useState<DashboardGranularity>('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockItem[] | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[] | null>(null);
  const [returns, setReturns] = useState<OrderReturnRecord[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, ordersRes, stockRes, paymentsRes, returnsRes] = await Promise.all([
        adminApi.getDashboard({
          lowStockThreshold: preferences.lowStockThreshold,
          granularity,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
        adminApi.listOrders({ page: 1, pageSize: 100 }).catch(() => ({ items: [] as OrderRecord[] })),
        adminApi
          .listWarehouseStock()
          .then((r) => r.stock)
          .catch(() => null),
        adminApi
          .listPayments({ page: 1, pageSize: 50 })
          .then((r) => r.items)
          .catch(() => null),
        adminApi
          .listReturns({ page: 1, pageSize: 50 })
          .then((r) => r.items)
          .catch(() => null),
      ]);

      setDashboard(dashRes);
      setOrders(ordersRes.items);
      setWarehouseStock(stockRes);
      setPayments(paymentsRes);
      setReturns(returnsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت داده‌های گزارش.');
    } finally {
      setLoading(false);
    }
  }, [preferences.lowStockThreshold, granularity, dateFrom, dateTo]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const statusSummary = useMemo(() => {
    if (orders.length > 0) {
      return summarizeOrderStatuses(orders);
    }
    return (dashboard?.statusBreakdown ?? []).map((item) => ({
      status: item.status,
      label: item.status,
      count: item.count,
      revenue: 0,
    }));
  }, [orders, dashboard]);

  const stockValuation = useMemo(() => {
    if (!warehouseStock) return null;
    return calculateInventoryValuation(warehouseStock, {});
  }, [warehouseStock]);

  const handleExportReportCsv = () => {
    if (!dashboard) return;
    const headers = ['بخش گزارش', 'عنوان / بازه', 'تعداد', 'مبلغ (تومان)'];
    const rows: Array<Array<string | number>> = [
      ['شاخص کل', 'درآمد کل تاییدشده', dashboard.metrics.totalOrders, dashboard.metrics.confirmedRevenue],
      ['شاخص کل', 'میانگین ارزش سفارش (AOV)', dashboard.metrics.totalOrders, dashboard.metrics.averageOrderValue ?? 0],
      ...dashboard.revenueSeries.map((pt) => ['روند فروش', pt.label, pt.ordersCount, pt.revenue]),
      ...statusSummary.map((st) => ['وضعیت سفارش', st.label, st.count, st.revenue]),
      ...(dashboard.topSellingProducts ?? []).map((p) => ['محصولات پرفروش', p.nameFa, p.soldCount, p.revenue]),
    ];
    downloadCsvFile(
      `ams-sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(headers, rows)
    );
    pushToast({
      tone: 'success',
      title: 'خروجی CSV گزارش فروش آماده شد',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 ams-no-print">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">گزارش‌های مالی، فروش و انبار</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            تحلیل بازه‌ای درآمد، وضعیت سفارش‌ها، کالاهای پرفروش و موجودی قابل‌فروش با خروجی CSV و چاپ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadReports()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!dashboard}
            onClick={handleExportReportCsv}
            icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!dashboard}
            onClick={() => window.print()}
            icon={<Printer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            چاپ گزارش
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm" className="ams-no-print">
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <div>
            <label htmlFor="report-granularity" className="block font-medium text-[#52565e] mb-1">
              بازه تجمیع نمودار
            </label>
            <select
              id="report-granularity"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as DashboardGranularity)}
              className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
            >
              <option value="daily">روزانه</option>
              <option value="weekly">هفتگی</option>
              <option value="monthly">ماهانه</option>
              <option value="annual">سالانه</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-from" className="block font-medium text-[#52565e] mb-1">
              از تاریخ (میلادی)
            </label>
            <input
              id="report-from"
              type="date"
              dir="ltr"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315]"
            />
          </div>
          <div>
            <label htmlFor="report-to" className="block font-medium text-[#52565e] mb-1">
              تا تاریخ (میلادی)
            </label>
            <input
              id="report-to"
              type="date"
              dir="ltr"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315]"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadReports()} />
      ) : !dashboard ? null : (
        <>
          {/* Summary KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card padding="md">
              <p className="text-xs text-[#52565e]">درآمد کل تاییدشده</p>
              <p className="mt-2 text-lg font-semibold text-[#111315] tabular-nums-fa">
                {formatToman(dashboard.metrics.confirmedRevenue)}
              </p>
              <p className="mt-1 text-[11px] text-[#7c818c] tabular-nums-fa">
                از مجموع {formatPersianNumber(dashboard.metrics.totalOrders)} سفارش
              </p>
            </Card>

            <Card padding="md">
              <p className="text-xs text-[#52565e]">میانگین ارزش هر سفارش (AOV)</p>
              <p className="mt-2 text-lg font-semibold text-[#0f49bd] tabular-nums-fa">
                {formatToman(
                  dashboard.metrics.averageOrderValue ??
                    (dashboard.metrics.totalOrders > 0
                      ? Math.round(
                          dashboard.metrics.confirmedRevenue / dashboard.metrics.totalOrders
                        )
                      : 0)
                )}
              </p>
              <p className="mt-1 text-[11px] text-[#7c818c] tabular-nums-fa">
                سفارش‌های منتظر پردازش: {toPersianDigits(dashboard.metrics.pendingOrdersCount)}
              </p>
            </Card>

            <Card padding="md">
              <p className="text-xs text-[#52565e]">وضعیت موجودی کاتالوگ</p>
              <p className="mt-2 text-lg font-semibold text-[#111315] tabular-nums-fa">
                {stockValuation
                  ? `${formatPersianNumber(stockValuation.totalAvailableUnits)} عدد آماده فروش`
                  : `${formatPersianNumber(dashboard.metrics.inStockProducts)} کالای موجود`}
              </p>
              <p className="mt-1 text-[11px] text-[#7c818c] tabular-nums-fa">
                {stockValuation
                  ? `رزروشده: ${toPersianDigits(stockValuation.totalReservedUnits)} عدد`
                  : `کم‌موجود: ${toPersianDigits(dashboard.metrics.lowStockCount)} کالا`}
              </p>
            </Card>

            <Card padding="md">
              <p className="text-xs text-[#52565e]">پایگاه مشتریان</p>
              <p className="mt-2 text-lg font-semibold text-[#111315] tabular-nums-fa">
                {formatPersianNumber(dashboard.metrics.totalCustomers)} کاربر
              </p>
              <p className="mt-1 text-[11px] text-[#7c818c] tabular-nums-fa">
                ناموجود فعلی: {toPersianDigits(dashboard.metrics.outOfStockProducts)} محصول
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend Table */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-[#0f49bd]" strokeWidth={1.5} aria-hidden="true" />
                <h2 className="text-sm font-semibold text-[#111315]">جدول روند فروش و درآمد</h2>
              </div>
              {dashboard.revenueSeries.length === 0 ? (
                <p className="text-xs text-[#52565e]">داده‌ای برای این بازه زمانی موجود نیست.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.08] text-[#52565e]">
                        <th className="py-2.5 px-2">بازه / تاریخ</th>
                        <th className="py-2.5 px-2">تعداد سفارش</th>
                        <th className="py-2.5 px-2 text-left">مبلغ فروش</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06] tabular-nums-fa">
                      {dashboard.revenueSeries.map((pt) => (
                        <tr key={pt.label}>
                          <td className="py-2.5 px-2 font-medium text-[#111315]">{pt.label}</td>
                          <td className="py-2.5 px-2 text-[#52565e]">{toPersianDigits(pt.ordersCount)}</td>
                          <td className="py-2.5 px-2 text-left font-semibold text-[#111315]">
                            {formatToman(pt.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Order Status Breakdown */}
            <Card padding="md">
              <h2 className="text-sm font-semibold text-[#111315] mb-4">تفکیک وضعیت سفارش‌ها</h2>
              {statusSummary.length === 0 ? (
                <p className="text-xs text-[#52565e]">سفارشی یافت نشد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.08] text-[#52565e]">
                        <th className="py-2.5 px-2">وضعیت</th>
                        <th className="py-2.5 px-2">تعداد</th>
                        <th className="py-2.5 px-2 text-left">جمع مبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06] tabular-nums-fa">
                      {statusSummary.map((row) => (
                        <tr key={row.status}>
                          <td className="py-2.5 px-2">
                            <OrderStatusBadge status={row.status} />
                          </td>
                          <td className="py-2.5 px-2 font-medium text-[#111315]">
                            {toPersianDigits(row.count)}
                          </td>
                          <td className="py-2.5 px-2 text-left text-[#52565e]">
                            {row.revenue > 0 ? formatToman(row.revenue) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Top Selling Products */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-[#111315] mb-4">محصولات پرفروش</h2>
            {!dashboard.topSellingProducts || dashboard.topSellingProducts.length === 0 ? (
              <p className="text-xs text-[#52565e]">آمار تفکیکی پرفروش‌ترین کالاها از سرور دریافت نشد.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.08] text-[#52565e]">
                      <th className="py-2.5 px-2">محصول</th>
                      <th className="py-2.5 px-2">برند</th>
                      <th className="py-2.5 px-2">تعداد فروش</th>
                      <th className="py-2.5 px-2 text-left">درآمد ثبت‌شده</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06] tabular-nums-fa">
                    {dashboard.topSellingProducts.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-2 font-semibold text-[#111315]">{item.nameFa}</td>
                        <td className="py-2.5 px-2 text-[#52565e]">{item.brand}</td>
                        <td className="py-2.5 px-2 font-medium text-[#111315]">
                          {toPersianDigits(item.soldCount)} عدد
                        </td>
                        <td className="py-2.5 px-2 text-left font-semibold text-[#0f49bd]">
                          {formatToman(item.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Optional Payments & Returns Summary when backend routes are enabled */}
          {(payments !== null || returns !== null) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {payments !== null && (
                <Card padding="md">
                  <h2 className="text-sm font-semibold text-[#111315] mb-3">
                    خلاصه تراکنش‌های اخیر درگاه ({toPersianDigits(payments.length)})
                  </h2>
                  <div className="divide-y divide-black/[0.06] text-xs">
                    {payments.slice(0, 6).map((tx) => (
                      <div key={tx.id} className="py-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-[#0f49bd]" dir="ltr">
                          #{tx.orderCode}
                        </span>
                        <span className="text-[#52565e]">{PAYMENT_TX_STATUS_LABELS[tx.status]}</span>
                        <span className="font-semibold text-[#111315] tabular-nums-fa">
                          {formatToman(tx.amountToman)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {returns !== null && (
                <Card padding="md">
                  <h2 className="text-sm font-semibold text-[#111315] mb-3">
                    خلاصه پرونده‌های مرجوعی ({toPersianDigits(returns.length)})
                  </h2>
                  <div className="divide-y divide-black/[0.06] text-xs">
                    {returns.slice(0, 6).map((ret) => (
                      <div key={ret.id} className="py-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-[#0f49bd]" dir="ltr">
                          #{ret.returnCode}
                        </span>
                        <span className="text-[#52565e]">{RETURN_STATUS_LABELS[ret.status]}</span>
                        <span className="font-semibold text-[#111315] tabular-nums-fa">
                          {formatToman(ret.refundAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
