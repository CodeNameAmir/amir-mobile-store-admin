import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Package,
  RefreshCw,
} from 'lucide-react';
import type { DashboardData, DashboardGranularity, OrderStatus } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { fetchWithDedupe, getCachedValue } from '../services/adminCache';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { Link, useRouter } from '../router';
import {
  AUDIT_ACTION_LABELS,
  buildCsv,
  downloadCsvFile,
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
  formatToman,
  ORDER_STATUS_LABELS,
  toPersianDigits,
} from '../utils/formatters';
import { maskPhone } from '../utils/masking';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { OrderPaymentBadge, OrderStatusBadge, StockStatusTag } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { ProductThumb } from '../components/ui/ProductThumb';

function RevenueTrendChart({ data }: { data?: DashboardData['revenueSeries'] | null }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const safeData = Array.isArray(data) ? data : [];

  if (safeData.length === 0) {
    return (
      <EmptyState
        title="داده‌ای برای نمودار روند فروش ثبت نشده است"
        description="با ثبت سفارش‌های جدید، نمودار فروش به‌صورت خودکار ترسیم می‌شود."
      />
    );
  }

  const width = 640;
  const height = 220;
  const padX = 28;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const maxRev = Math.max(
    ...safeData.map((d) => (Number.isFinite(d.revenue) ? d.revenue : 0)),
    1
  );

  const points = safeData.map((point, idx) => {
    const rev = Number.isFinite(point.revenue) ? point.revenue : 0;
    const x =
      safeData.length === 1
        ? padX + plotW / 2
        : padX + (idx / (safeData.length - 1)) * plotW;
    const y = padTop + plotH - (rev / maxRev) * plotH;
    return {
      x,
      y,
      label: point.label || '—',
      revenue: rev,
      ordersCount: Number.isFinite(point.ordersCount) ? point.ordersCount : 0,
    };
  });

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const activeIdx = hoveredIdx !== null && hoveredIdx < points.length ? hoveredIdx : points.length - 1;
  const activePoint = points[activeIdx];

  return (
    <div className="space-y-4">
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#f6f6f7] border border-black/[0.06] text-xs">
          <div className="flex items-center gap-2 text-[#52565e]">
            <span className="h-2 w-2 rounded-full bg-[#0f49bd]" aria-hidden="true" />
            <span>بازه:</span>
            <span className="font-medium text-[#111315]">{activePoint.label}</span>
          </div>
          <div className="flex items-center gap-4 tabular-nums-fa">
            <span className="font-semibold text-[#0f49bd]">
              {formatToman(activePoint.revenue)}
            </span>
            <span className="text-[#52565e]">
              {toPersianDigits(activePoint.ordersCount)} سفارش
            </span>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[440px] h-56"
          role="img"
          aria-label="نمودار روند فروش سفارش‌ها"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="#111315"
                strokeOpacity="0.08"
                strokeDasharray="3 4"
              />
            );
          })}

          {activePoint && (
            <line
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={padTop + plotH}
              stroke="#0f49bd"
              strokeOpacity="0.22"
              strokeWidth="1"
            />
          )}

          {areaPath && <path d={areaPath} fill="#0f49bd" fillOpacity="0.045" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#0f49bd"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((pt, idx) => {
            const isSelected = activeIdx === idx;
            return (
              <g key={`${pt.label}-${idx}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={14}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 5 : 3.5}
                  fill={isSelected ? '#0f49bd' : '#ffffff'}
                  stroke="#0f49bd"
                  strokeWidth={isSelected ? 2 : 1.75}
                  className="pointer-events-none transition-colors duration-150"
                />
                <text
                  x={pt.x}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[11px] ${isSelected ? 'fill-[#111315] font-medium' : 'fill-[#7c818c]'}`}
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const GRANULARITY_LABELS: Record<DashboardGranularity, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  annual: 'سالانه',
};

export function DashboardPage() {
  const { preferences, canViewFullPii } = useAuth();
  const { navigate } = useRouter();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [granularity, setGranularity] = useState<DashboardGranularity>('daily');

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (forceRefresh = false) => {
      const cacheKey = `dashboard:${preferences.lowStockThreshold}:${granularity}:${dateFrom}:${dateTo}`;
      const cached = !forceRefresh ? getCachedValue<DashboardData>(cacheKey) : null;

      if (cached) {
        setData(cached.data);
        setLoading(false);
        setError(null);
        if (cached.isFresh) return;
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetchWithDedupe(cacheKey, () =>
          adminApi.getDashboard({
            lowStockThreshold: preferences.lowStockThreshold,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            granularity,
          })
        );
        setData(res);
      } catch (err) {
        if (!cached) {
          setError(err instanceof ApiError ? err.message : 'خطا در دریافت آمار داشبورد.');
        }
      } finally {
        setLoading(false);
      }
    },
    [preferences.lowStockThreshold, granularity, dateFrom, dateTo]
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleExportRecentOrders = () => {
    const safeOrders = Array.isArray(data?.recentOrders) ? data.recentOrders : [];
    if (safeOrders.length === 0) return;
    const csv = buildCsv(
      ['کد سفارش', 'نام مشتری', 'تلفن', 'شهر', 'مبلغ کل (تومان)', 'وضعیت', 'تاریخ'],
      safeOrders.map((o) => [
        o.orderCode,
        o.customerName,
        canViewFullPii ? o.customerPhone : maskPhone(o.customerPhone),
        o.city,
        o.totalAmount,
        ORDER_STATUS_LABELS[o.status] || String(o.status || 'نامشخص'),
        o.createdAt,
      ])
    );
    downloadCsvFile('ams-recent-orders.csv', csv);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 h-28 rounded-xl bg-white border border-black/[0.08]" />
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-white border border-black/[0.08]"
              />
            ))}
          </div>
        </div>
        <Card>
          <LoadingSkeleton rows={6} />
        </Card>
      </div>
    );
  }

  if (error || !data || !data.metrics) {
    return (
      <ErrorState
        message={error || 'اطلاعات داشبورد در دسترس نیست یا ساختار پاسخ سرور نامعتبر است.'}
        onRetry={() => void loadDashboard(true)}
      />
    );
  }

  const metrics = data.metrics;
  const safeRevenueSeries = Array.isArray(data.revenueSeries) ? data.revenueSeries : [];
  const safeStatusBreakdown = Array.isArray(data.statusBreakdown) ? data.statusBreakdown : [];
  const safeLowStockProducts = Array.isArray(data.lowStockProducts) ? data.lowStockProducts : [];
  const safeRecentOrders = Array.isArray(data.recentOrders) ? data.recentOrders : [];
  const safeTopSelling = Array.isArray(data.topSellingProducts) ? data.topSellingProducts : [];
  const safeRecentActivities = Array.isArray(data.recentActivities) ? data.recentActivities : [];

  const totalStatusCount = Math.max(
    1,
    safeStatusBreakdown.reduce((sum, item) => sum + (Number.isFinite(item?.count) ? item.count : 0), 0)
  );

  const statusColorBar: Record<OrderStatus, string> = {
    pending_payment: 'bg-[#d97706]',
    paid: 'bg-[#0f49bd]',
    preparing: 'bg-[#d97706]',
    shipped: 'bg-[#52565e]',
    delivered: 'bg-[#16a34a]',
    cancelled: 'bg-[#b42318]',
    expired: 'bg-[#9aa0ab]',
    returned: 'bg-[#d97706]',
  };

  const hasExtendedPeriodicStats =
    metrics.todayRevenue !== undefined ||
    metrics.monthlyRevenue !== undefined ||
    metrics.annualRevenue !== undefined ||
    metrics.averageOrderValue !== undefined;

  return (
    <div className="space-y-6">
      {/* Contextual title & filter controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#111315]">
            نمای کلی عملیات و فروش
          </h1>
          <p className="mt-1 text-xs text-[#52565e]">
            <span>فروشگاه موبایل امیر</span>
            <span className="mx-2 text-[#9aa0ab]" aria-hidden="true">·</span>
            <span className="tabular-nums-fa">{formatPersianDate(new Date().toISOString())}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06]">
            {(['daily', 'weekly', 'monthly', 'annual'] as DashboardGranularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-2.5 h-7 rounded-md text-xs transition-colors duration-150 ${
                  granularity === g
                    ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                    : 'text-[#52565e] hover:text-[#111315] font-medium'
                }`}
              >
                {GRANULARITY_LABELS[g]}
              </button>
            ))}
          </div>

          <input
            type="date"
            aria-label="شروع بازه"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-black/[0.14] bg-white text-[11px] text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          />
          <input
            type="date"
            aria-label="پایان بازه"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-black/[0.14] bg-white text-[11px] text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDashboard(true)}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={safeRecentOrders.length === 0}
            onClick={handleExportRecentOrders}
            icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
        </div>
      </div>

      {/* Asymmetric KPI Strip: 1 Lead Metric + 3 Compact Figures */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card padding="md" className="lg:col-span-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#52565e]">فروش تاییدشده (پرداخت قطعی)</span>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0f49bd] hover:underline"
            >
              <span>جزئیات سفارش‌ها</span>
              <ArrowLeft className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div>
            <p className="text-2xl font-semibold text-[#111315] tabular-nums-fa">
              {formatToman(metrics.confirmedRevenue)}
            </p>
            <p className="mt-1 text-xs text-[#52565e] tabular-nums-fa">
              سفارش‌های پرداخت‌شده و غیرلغو در {formatPersianNumber(metrics.totalOrders)} سفارش کل
              {metrics.pendingPaymentCount !== undefined && metrics.pendingPaymentCount > 0
                ? ` · ${formatPersianNumber(metrics.pendingPaymentCount)} در انتظار پرداخت`
                : ''}
            </p>
          </div>
        </Card>

        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="md" className="flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-[#52565e]">صف آماده‌سازی</span>
            <div>
              <p className="text-lg font-semibold text-[#111315] tabular-nums-fa">
                {formatPersianNumber(metrics.totalOrders)} سفارش
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums-fa">
                <span className="inline-flex items-center gap-1.5 text-[#9a4a06] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d97706] shrink-0" aria-hidden="true" />
                  <span>{formatPersianNumber(metrics.pendingOrdersCount)} در انتظار ارسال</span>
                </span>
                {metrics.cancelledOrdersCount !== undefined && metrics.cancelledOrdersCount > 0 && (
                  <span className="text-[#b42318] font-medium">
                    · {formatPersianNumber(metrics.cancelledOrdersCount)} لغوشده
                  </span>
                )}
              </p>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-[#52565e]">مشتریان فروشگاه</span>
            <div>
              <p className="text-lg font-semibold text-[#111315] tabular-nums-fa">
                {formatPersianNumber(metrics.totalCustomers)} حساب
              </p>
              <p className="mt-1 text-xs text-[#52565e] tabular-nums-fa">
                {metrics.newCustomersCount !== undefined
                  ? `${formatPersianNumber(metrics.newCustomersCount)} عضو جدید در بازه`
                  : 'کاربران ثبت‌نام‌شده در سامانه'}
              </p>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-[#52565e]">وضعیت کالاها</span>
            <div>
              <p className="text-lg font-semibold text-[#111315] tabular-nums-fa">
                {formatPersianNumber(metrics.totalProducts)} محصول
              </p>
              <p className="mt-1 text-xs text-[#52565e] tabular-nums-fa">
                <span className="text-[#9a4a06] font-medium">
                  {formatPersianNumber(metrics.lowStockCount)} کم‌موجود
                </span>
                <span className="mx-1.5 text-[#9aa0ab]" aria-hidden="true">·</span>
                <span className="text-[#b42318] font-medium">
                  {formatPersianNumber(metrics.outOfStockProducts)} ناموجود
                </span>
              </p>
              {(metrics.publishedProducts !== undefined || metrics.unpublishedProducts !== undefined) && (
                <p className="mt-1 text-[11px] text-[#7c818c] tabular-nums-fa">
                  {metrics.publishedProducts !== undefined
                    ? `${formatPersianNumber(metrics.publishedProducts)} منتشرشده`
                    : ''}
                  {metrics.publishedProducts !== undefined && metrics.unpublishedProducts !== undefined
                    ? ' · '
                    : ''}
                  {metrics.unpublishedProducts !== undefined
                    ? `${formatPersianNumber(metrics.unpublishedProducts)} پیش‌نویس`
                    : ''}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Optional Extended Financial Breakdown when backend supplies periodic metrics */}
      {hasExtendedPeriodicStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.todayRevenue !== undefined && (
            <Card padding="sm" className="space-y-1">
              <p className="text-[11px] text-[#52565e]">فروش امروز</p>
              <p className="text-sm font-semibold text-[#111315] tabular-nums-fa">
                {formatToman(metrics.todayRevenue)}
              </p>
              {metrics.todayOrders !== undefined && (
                <p className="text-[11px] text-[#7c818c] tabular-nums-fa">
                  {formatPersianNumber(metrics.todayOrders)} سفارش
                </p>
              )}
            </Card>
          )}
          {metrics.monthlyRevenue !== undefined && (
            <Card padding="sm" className="space-y-1">
              <p className="text-[11px] text-[#52565e]">فروش ماه جاری</p>
              <p className="text-sm font-semibold text-[#111315] tabular-nums-fa">
                {formatToman(metrics.monthlyRevenue)}
              </p>
            </Card>
          )}
          {metrics.annualRevenue !== undefined && (
            <Card padding="sm" className="space-y-1">
              <p className="text-[11px] text-[#52565e]">فروش سال جاری</p>
              <p className="text-sm font-semibold text-[#111315] tabular-nums-fa">
                {formatToman(metrics.annualRevenue)}
              </p>
            </Card>
          )}
          {metrics.averageOrderValue !== undefined && (
            <Card padding="sm" className="space-y-1">
              <p className="text-[11px] text-[#52565e]">میانگین سبد خرید (AOV)</p>
              <p className="text-sm font-semibold text-[#0f49bd] tabular-nums-fa">
                {formatToman(metrics.averageOrderValue)}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Main Analytics + Low Stock Alerts Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card padding="lg" className="xl:col-span-2 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#111315]">
                روند فروش ({GRANULARITY_LABELS[granularity]}) و ترکیب وضعیت سفارش‌ها
              </h2>
              <p className="mt-0.5 text-xs text-[#52565e]">
                گزارش دوره‌ای فروش تاییدشده در فروشگاه
              </p>
            </div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0f49bd] hover:underline"
            >
              <span>مدیریت سفارش‌ها</span>
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>

          <RevenueTrendChart data={safeRevenueSeries} />

          {safeStatusBreakdown.length > 0 && (
            <div className="pt-4 border-t border-black/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-4">
              {safeStatusBreakdown.map((item) => {
                const countVal = Number.isFinite(item?.count) ? item.count : 0;
                const pct = Math.round((countVal / totalStatusCount) * 100);
                const statusLabel =
                  ORDER_STATUS_LABELS[item.status] || String(item.status || 'نامشخص');
                const barClass = statusColorBar[item.status] || 'bg-[#7c818c]';
                return (
                  <div key={String(item.status)} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#52565e]">{statusLabel}</span>
                      <span className="font-semibold text-[#111315] tabular-nums-fa">
                        {formatPersianNumber(countVal)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#f1f2f4] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#111315]">هشدار موجودی انبار</h2>
            <Link
              to="/inventory"
              className="text-xs font-medium text-[#0f49bd] hover:underline"
            >
              مشاهده همه
            </Link>
          </div>

          <p className="text-xs text-[#52565e] tabular-nums-fa">
            کالاهای با موجودی کمتر یا مساوی {toPersianDigits(preferences.lowStockThreshold)} عدد
          </p>

          {safeLowStockProducts.length === 0 ? (
            <EmptyState
              title="تمام کالاها موجودی کافی دارند"
              description="هیچ کالایی زیر آستانه هشدار قرار ندارد."
              icon={<Package className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            />
          ) : (
            <div className="divide-y divide-black/[0.06]">
              {safeLowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumb src={product.image} alt={product.nameFa} sizeClass="h-9 w-9" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#111315] line-clamp-1">
                        {product.nameFa}
                      </p>
                      <p className="text-[11px] text-[#52565e] truncate tabular-nums-fa">
                        {product.brand} · {toPersianDigits(product.stockCount)} عدد باقیمانده
                      </p>
                    </div>
                  </div>
                  <StockStatusTag
                    inStock={product.inStock}
                    stockCount={product.stockCount}
                    lowThreshold={preferences.lowStockThreshold}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#111315]">آخرین سفارش‌های ثبت‌شده</h2>
            <p className="mt-0.5 text-xs text-[#52565e]">
              برای بررسی اقلام و تغییر وضعیت، کد سفارش را انتخاب کنید
            </p>
          </div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0f49bd] hover:underline"
          >
            <span>مشاهده همه سفارش‌ها</span>
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </div>

        {safeRecentOrders.length === 0 ? (
          <EmptyState
            title="هنوز سفارشی ثبت نشده است"
            description="پس از ثبت اولین سفارش در فروشگاه، جزئیات آن اینجا نمایش داده می‌شود."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-2.5 px-3">کد سفارش</th>
                  <th className="py-2.5 px-3">مشتری</th>
                  <th className="py-2.5 px-3">تعداد اقلام</th>
                  <th className="py-2.5 px-3">مبلغ کل</th>
                  <th className="py-2.5 px-3">وضعیت سفارش و پرداخت</th>
                  <th className="py-2.5 px-3">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {safeRecentOrders.map((order) => {
                  const safeOrderItems = Array.isArray(order.items) ? order.items : [];
                  return (
                    <tr
                      key={order.orderCode}
                      className="hover:bg-[#f7f8fa] transition-colors duration-150"
                    >
                      <td className="py-3 px-3 font-mono font-medium text-[#0f49bd] tabular-nums-fa" dir="ltr">
                        <button
                          type="button"
                          onClick={() => navigate(`/orders?orderCode=${encodeURIComponent(order.orderCode)}`)}
                          className="hover:underline"
                        >
                          #{order.orderCode}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-[#111315]">{order.customerName}</p>
                        <p className="text-[11px] text-[#7c818c] tabular-nums-fa">
                          {canViewFullPii
                            ? toPersianDigits(order.customerPhone)
                            : maskPhone(order.customerPhone)}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-[#52565e] tabular-nums-fa">
                        {toPersianDigits(safeOrderItems.length)} کالا
                      </td>
                      <td className="py-3 px-3 font-medium text-[#111315] tabular-nums-fa">
                        {formatToman(order.totalAmount)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <OrderStatusBadge status={order.status} />
                          <OrderPaymentBadge order={order} />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#52565e]">{order.createdAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(safeTopSelling.length > 0 || safeRecentActivities.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {safeTopSelling.length > 0 && (
            <Card padding="lg" className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#111315]">محصولات پرفروش</h2>
                <Link
                  to="/products"
                  className="text-xs font-medium text-[#0f49bd] hover:underline"
                >
                  فهرست محصولات
                </Link>
              </div>
              <div className="divide-y divide-black/[0.06]">
                {safeTopSelling.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductThumb src={item.image} alt={item.nameFa} sizeClass="h-9 w-9" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#111315] truncate">{item.nameFa}</p>
                        <p className="text-[11px] text-[#52565e] truncate tabular-nums-fa">
                          {item.brand ? `${item.brand} · ` : ''}
                          {formatPersianNumber(item.soldCount)} فروش
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-[#111315] whitespace-nowrap tabular-nums-fa">
                      {formatToman(item.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {safeRecentActivities.length > 0 && (
            <Card padding="lg" className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#111315]">فعالیت‌های اخیر مدیریت</h2>
                <Link
                  to="/audit-logs"
                  className="text-xs font-medium text-[#0f49bd] hover:underline"
                >
                  مشاهده گزارش کامل
                </Link>
              </div>
              <div className="divide-y divide-black/[0.06]">
                {safeRecentActivities.map((log) => (
                  <div key={log.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-[#111315] truncate">
                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                      </p>
                      <p className="text-[11px] text-[#52565e] font-mono truncate" dir="ltr">
                        {log.adminEmail}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#7c818c] whitespace-nowrap tabular-nums-fa">
                      {formatPersianDateTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
