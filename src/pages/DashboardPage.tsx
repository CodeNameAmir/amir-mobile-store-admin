import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ClipboardList,
  Download,
  Package,
  RefreshCw,
  ShoppingBag,
  Users,
} from 'lucide-react';
import type { DashboardData, OrderStatus } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { Link, useRouter } from '../router';
import {
  buildCsv,
  downloadCsvFile,
  formatPersianDate,
  formatPersianNumber,
  formatToman,
  ORDER_STATUS_LABELS,
  toPersianDigits,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { OrderStatusBadge, StockStatusTag } from '../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { ProductThumb } from '../components/ui/ProductThumb';

function RevenueTrendChart({ data }: { data: DashboardData['revenueSeries'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <EmptyState
        title="داده‌ای برای نمودار روند فروش ثبت نشده است"
        description="با ثبت سفارش‌های جدید در فروشگاه، نمودار فروش به‌صورت خودکار ترسیم می‌شود."
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

  const maxRev = Math.max(...data.map((d) => d.revenue), 1);

  const points = data.map((point, idx) => {
    const x =
      data.length === 1
        ? padX + plotW / 2
        : padX + (idx / (data.length - 1)) * plotW;
    const y = padTop + plotH - (point.revenue / maxRev) * plotH;
    return { x, y, ...point };
  });

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="space-y-4">
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#f8f9ff] border border-[#c3c6d7]/50 text-xs">
          <div className="flex items-center gap-2 text-[#434655]">
            <span>بازه انتخابی:</span>
            <span className="font-bold text-[#0b1c30]">{activePoint.label}</span>
          </div>
          <div className="flex items-center gap-4 tabular-nums-fa">
            <span className="font-bold text-[#004ac6]">
              {formatToman(activePoint.revenue)}
            </span>
            <span className="text-[#434655]">
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
          <defs>
            <linearGradient id="amsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="#c3c6d7"
                strokeOpacity="0.45"
                strokeDasharray="4 4"
              />
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#amsRevenueGrad)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#004ac6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((pt, idx) => {
            const isSelected = hoveredIdx === idx;
            return (
              <g key={pt.label}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6 : 4.5}
                  fill="#ffffff"
                  stroke="#004ac6"
                  strokeWidth={isSelected ? 3 : 2}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                />
                <text
                  x={pt.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-[#434655] text-[11px]"
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

export function DashboardPage() {
  const { user, preferences } = useAuth();
  const { navigate } = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getDashboard(preferences.lowStockThreshold);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت آمار داشبورد.');
    } finally {
      setLoading(false);
    }
  }, [preferences.lowStockThreshold]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleExportRecentOrders = () => {
    if (!data || data.recentOrders.length === 0) return;
    const csv = buildCsv(
      ['کد سفارش', 'نام مشتری', 'تلفن', 'شهر', 'مبلغ کل (تومان)', 'وضعیت', 'تاریخ'],
      data.recentOrders.map((o) => [
        o.orderCode,
        o.customerName,
        o.customerPhone,
        o.city,
        o.totalAmount,
        ORDER_STATUS_LABELS[o.status],
        o.createdAt,
      ])
    );
    downloadCsvFile('ams-recent-orders.csv', csv);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-white border border-[#c3c6d7]/60 animate-pulse"
            />
          ))}
        </div>
        <Card>
          <LoadingSkeleton rows={6} />
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error || 'اطلاعات داشبورد در دسترس نیست.'}
        onRetry={() => void loadDashboard()}
      />
    );
  }

  const { metrics, revenueSeries, statusBreakdown, lowStockProducts, recentOrders } = data;
  const totalStatusCount = Math.max(
    1,
    statusBreakdown.reduce((sum, item) => sum + item.count, 0)
  );

  const statusColorBar: Record<OrderStatus, string> = {
    paid: 'bg-[#004ac6]',
    preparing: 'bg-[#d97706]',
    shipped: 'bg-[#2563eb]',
    delivered: 'bg-[#16a34a]',
  };

  return (
    <div className="space-y-6">
      {/* Top welcome & actions strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0b1c30]">
            خوش آمدید، {user?.fullName || 'مدیر فروشگاه'}
          </h1>
          <p className="mt-1 text-xs text-[#434655]">
            <span>نمای کلی عملکرد فروشگاه موبایل امیر</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>امروز {formatPersianDate(new Date().toISOString())}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDashboard()}
            icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            به‌روزرسانی آمار
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={recentOrders.length === 0}
            onClick={handleExportRecentOrders}
            icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            خروجی CSV سفارش‌های اخیر
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card padding="md" className="flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#434655]">فروش تاییدشده کل</span>
            <div className="h-9 w-9 rounded-xl bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-[#0b1c30] tabular-nums-fa">
              {formatToman(metrics.confirmedRevenue)}
            </p>
            <p className="mt-1 text-xs text-[#434655] tabular-nums-fa">
              مجموع از {formatPersianNumber(metrics.totalOrders)} سفارش ثبت‌شده
            </p>
          </div>
        </Card>

        <Card padding="md" className="flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#434655]">سفارش‌ها و آماده‌سازی</span>
            <div className="h-9 w-9 rounded-xl bg-[#ffdbca]/60 text-[#8e3c00] flex items-center justify-center">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-[#0b1c30] tabular-nums-fa">
              {formatPersianNumber(metrics.totalOrders)} سفارش
            </p>
            <p className="mt-1 text-xs text-[#8e3c00] font-medium tabular-nums-fa">
              {formatPersianNumber(metrics.pendingOrdersCount)} سفارش در انتظار ارسال
            </p>
          </div>
        </Card>

        <Card padding="md" className="flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#434655]">مشتریان ثبت‌نام‌شده</span>
            <div className="h-9 w-9 rounded-xl bg-[#eff4ff] text-[#004ac6] flex items-center justify-center">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-[#0b1c30] tabular-nums-fa">
              {formatPersianNumber(metrics.totalCustomers)} کاربر
            </p>
            <p className="mt-1 text-xs text-[#434655]">
              حساب‌های ثبت‌شده در سیستم مرکزی
            </p>
          </div>
        </Card>

        <Card padding="md" className="flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#434655]">وضعیت کالاهای کاتالوگ</span>
            <div className="h-9 w-9 rounded-xl bg-[#ffdad6]/70 text-[#ba1a1a] flex items-center justify-center">
              <Boxes className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-[#0b1c30] tabular-nums-fa">
              {formatPersianNumber(metrics.totalProducts)} محصول
            </p>
            <p className="mt-1 text-xs text-[#434655] tabular-nums-fa">
              <span className="text-[#8e3c00] font-medium">
                {formatPersianNumber(metrics.lowStockCount)} کم‌موجود
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="text-[#ba1a1a] font-medium">
                {formatPersianNumber(metrics.outOfStockProducts)} ناموجود
              </span>
            </p>
          </div>
        </Card>
      </div>

      {/* Main Analytics + Low Stock Alerts Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card padding="lg" className="xl:col-span-2 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#0b1c30]">
                روند فروش و وضعیت سفارش‌ها
              </h2>
              <p className="mt-0.5 text-xs text-[#434655]">
                داده‌های واقعی استخراج‌شده از جدول سفارش‌های فروشگاه
              </p>
            </div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#004ac6] hover:underline"
            >
              <span>مدیریت سفارش‌ها</span>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <RevenueTrendChart data={revenueSeries} />

          <div className="pt-4 border-t border-[#c3c6d7]/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statusBreakdown.map((item) => {
              const pct = Math.round((item.count / totalStatusCount) * 100);
              return (
                <div key={item.status} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#434655]">{ORDER_STATUS_LABELS[item.status]}</span>
                    <span className="font-bold text-[#0b1c30] tabular-nums-fa">
                      {formatPersianNumber(item.count)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#eff4ff] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${statusColorBar[item.status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#8e3c00]" aria-hidden="true" />
              <h2 className="text-base font-bold text-[#0b1c30]">هشدار موجودی انبار</h2>
            </div>
            <Link
              to="/inventory"
              className="text-xs font-semibold text-[#004ac6] hover:underline"
            >
              مشاهده همه
            </Link>
          </div>

          <p className="text-xs text-[#434655] tabular-nums-fa">
            کالاهای با موجودی کمتر یا مساوی {toPersianDigits(preferences.lowStockThreshold)} عدد
          </p>

          {lowStockProducts.length === 0 ? (
            <EmptyState
              title="تمام کالاها موجودی کافی دارند"
              description="هیچ کالایی زیر آستانه هشدار موجودی قرار ندارد."
              icon={<Package className="h-5 w-5" aria-hidden="true" />}
            />
          ) : (
            <div className="divide-y divide-[#c3c6d7]/40">
              {lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumb src={product.image} alt={product.nameFa} sizeClass="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0b1c30] line-clamp-1">
                        {product.nameFa}
                      </p>
                      <p className="text-[11px] text-[#434655] truncate tabular-nums-fa">
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
            <h2 className="text-base font-bold text-[#0b1c30]">آخرین سفارش‌های ثبت‌شده</h2>
            <p className="mt-0.5 text-xs text-[#434655]">
              برای بررسی کامل اقلام و تغییر وضعیت، روی سفارش کلیک کنید
            </p>
          </div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#004ac6] hover:underline"
          >
            <span>مشاهده همه سفارش‌ها</span>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            title="هنوز سفارشی ثبت نشده است"
            description="پس از ثبت اولین سفارش در فروشگاه، جزئیات آن در این جدول نمایش داده می‌شود."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-[#c3c6d7]/60 text-xs font-semibold text-[#434655]">
                  <th className="py-3 px-3">کد سفارش</th>
                  <th className="py-3 px-3">مشتری</th>
                  <th className="py-3 px-3">تعداد اقلام</th>
                  <th className="py-3 px-3">مبلغ کل</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d7]/40 text-xs">
                {recentOrders.map((order) => (
                  <tr
                    key={order.orderCode}
                    className="hover:bg-[#f8f9ff] transition-colors"
                  >
                    <td className="py-3 px-3 font-bold text-[#004ac6] tabular-nums-fa" dir="ltr">
                      <button
                        type="button"
                        onClick={() => navigate(`/orders?orderCode=${encodeURIComponent(order.orderCode)}`)}
                        className="hover:underline"
                      >
                        #{order.orderCode}
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-[#0b1c30]">{order.customerName}</p>
                      <p className="text-[11px] text-[#434655] tabular-nums-fa">
                        {toPersianDigits(order.customerPhone)}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-[#434655] tabular-nums-fa">
                      {toPersianDigits(order.items.length)} کالا
                    </td>
                    <td className="py-3 px-3 font-bold text-[#0b1c30] tabular-nums-fa">
                      {formatToman(order.totalAmount)}
                    </td>
                    <td className="py-3 px-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-3 text-[#434655]">{order.createdAt}</td>
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
