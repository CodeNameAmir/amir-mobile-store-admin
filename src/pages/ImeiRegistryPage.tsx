import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Barcode,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import type {
  ImeiDeviceRecord,
  ImeiDeviceStatus,
  Product,
  Warehouse,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../services/apiClient';
import { useToast } from '../context/ToastContext';
import {
  buildCsv,
  downloadCsvFile,
  formatPersianDate,
  IMEI_STATUS_LABELS,
  IMEI_STATUS_TONES,
  toPersianDigits,
} from '../utils/formatters';
import { parseImeiBatch } from '../utils/imei';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { StatusTag } from '../components/ui/StatusBadge';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../components/ui/StateViews';

const STATUS_OPTIONS: ImeiDeviceStatus[] = [
  'in_stock',
  'reserved',
  'sold',
  'returned',
  'defective',
];

export function ImeiRegistryPage() {
  const { pushToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ImeiDeviceStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [devices, setDevices] = useState<ImeiDeviceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Batch registration modal
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState('');
  const [batchWarehouseId, setBatchWarehouseId] = useState('');
  const [batchSku, setBatchSku] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [batchText, setBatchText] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Edit single device modal
  const [editTarget, setEditTarget] = useState<ImeiDeviceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<ImeiDeviceStatus>('in_stock');
  const [editOrderCode, setEditOrderCode] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void adminApi
      .listProducts({ pageSize: 100 })
      .then((res) => setProducts(res.items))
      .catch(() => undefined);
    void adminApi
      .listWarehouses()
      .then((res) => setWarehouses(res.warehouses))
      .catch(() => undefined);
  }, []);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEndpointMissing(false);
    try {
      const res = await adminApi.listImeiDevices({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter,
        page,
        pageSize: 20,
      });
      setDevices(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setEndpointMissing(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'خطا در دریافت رجیستری IMEI.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const parsedBatch = useMemo(() => parseImeiBatch(batchText), [batchText]);

  const handleBatchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBatchError(null);
    if (!batchProductId) {
      setBatchError('لطفاً محصول مرتبط را انتخاب کنید.');
      return;
    }
    if (parsedBatch.valid.length === 0) {
      setBatchError('حداقل یک IMEI معتبر ۱۵ رقمی (تاییدشده با الگوریتم Luhn) وارد کنید.');
      return;
    }
    if (parsedBatch.invalid.length > 0) {
      setBatchError(
        `${toPersianDigits(parsedBatch.invalid.length)} کد نامعتبر وجود دارد. لطفاً پیش از ثبت آن‌ها را اصلاح کنید.`
      );
      return;
    }

    setBatchSubmitting(true);
    try {
      const res = await adminApi.registerImeiBatch({
        productId: batchProductId,
        warehouseId: batchWarehouseId || null,
        sku: batchSku.trim() || null,
        imeis: parsedBatch.valid,
        note: batchNote.trim() || null,
      });
      pushToast({
        tone: 'success',
        title: 'سریال‌های IMEI ثبت شدند',
        description: `${toPersianDigits(res.createdCount)} دستگاه به رجیستری اضافه شد.`,
      });
      setBatchOpen(false);
      setBatchText('');
      setBatchNote('');
      await loadDevices();
    } catch (err) {
      setBatchError(
        err instanceof ApiError ? err.message : 'خطا در ثبت دسته‌ای سریال‌های IMEI.'
      );
    } finally {
      setBatchSubmitting(false);
    }
  };

  const openEditDevice = (device: ImeiDeviceRecord) => {
    setEditTarget(device);
    setEditStatus(device.status);
    setEditOrderCode(device.orderCode || '');
    setEditNote(device.note || '');
  };

  const handleSaveDevice = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await adminApi.updateImeiDevice(editTarget.id, {
        status: editStatus,
        orderCode: editOrderCode.trim() || null,
        note: editNote.trim() || null,
      });
      pushToast({
        tone: 'success',
        title: 'وضعیت دستگاه به‌روزرسانی شد',
        description: editTarget.imei1,
      });
      setEditTarget(null);
      await loadDevices();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در تغییر وضعیت IMEI',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleExportCsv = () => {
    if (devices.length === 0) return;
    const csv = buildCsv(
      ['IMEI 1', 'IMEI 2', 'سریال', 'محصول', 'SKU', 'انبار', 'وضعیت', 'کد سفارش', 'تاریخ ثبت'],
      devices.map((d) => [
        d.imei1,
        d.imei2 || '—',
        d.serialNumber || '—',
        d.productNameFa || d.productId,
        d.sku || '—',
        d.warehouseNameFa || '—',
        IMEI_STATUS_LABELS[d.status],
        d.orderCode || '—',
        formatPersianDate(d.createdAt),
      ])
    );
    downloadCsvFile('ams-imei-registry.csv', csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">رجیستری سریال و IMEI دستگاه‌ها</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            ثبت گروهی با اعتبارسنجی ۱۵ رقمی Luhn، رهگیری گارانتی و تخصیص شماره سریال به سفارش‌ها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDevices()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={devices.length === 0}
            onClick={handleExportCsv}
            icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setBatchError(null);
              if (!batchProductId && products[0]) setBatchProductId(products[0].id);
              setBatchOpen(true);
            }}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            ثبت دسته‌ای IMEI
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
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
              placeholder="جستجو با IMEI، شماره سریال، SKU یا کد سفارش..."
              aria-label="جستجوی IMEI"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <select
            aria-label="فیلتر وضعیت دستگاه"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ImeiDeviceStatus | 'all');
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه وضعیت‌ها</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {IMEI_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : endpointMissing ? (
          <EndpointUnsupportedState
            title="سرویس رجیستری IMEI در سرور فعال نیست"
            description="برای ذخیره و رهگیری سریال IMEI دستگاه‌ها، جدول product_devices (مهاجرت ۰۰۵) و مسیرهای /api/admin/imei باید روی سرور فعال شوند."
            onRetry={() => void loadDevices()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadDevices()} />
        ) : devices.length === 0 ? (
          <EmptyState
            title="هنوز هیچ سریال IMEI ثبت نشده است"
            description="با دکمه «ثبت دسته‌ای IMEI» می‌توانید شماره سریال‌های ۱۵ رقمی دستگاه‌ها را با بررسی Luhn وارد کنید."
            icon={<Barcode className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">IMEI 1 / سریال</th>
                    <th className="py-3 px-3">محصول و SKU</th>
                    <th className="py-3 px-3">انبار</th>
                    <th className="py-3 px-3">کد سفارش</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3">تاریخ ثبت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {devices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                      <td className="py-3 px-3">
                        <p className="font-mono font-semibold text-[#111315]" dir="ltr">
                          {dev.imei1}
                        </p>
                        {(dev.imei2 || dev.serialNumber) && (
                          <p className="text-[11px] font-mono text-[#52565e] mt-0.5" dir="ltr">
                            {dev.imei2 ? `IMEI2: ${dev.imei2}` : ''}
                            {dev.imei2 && dev.serialNumber ? ' · ' : ''}
                            {dev.serialNumber ? `S/N: ${dev.serialNumber}` : ''}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-[#111315]">
                          {dev.productNameFa || dev.productId}
                        </p>
                        {dev.sku && (
                          <p className="text-[11px] font-mono text-[#0f49bd]" dir="ltr">
                            {dev.sku}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#52565e]">
                        {dev.warehouseNameFa || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#111315]" dir="ltr">
                        {dev.orderCode ? `#${dev.orderCode}` : '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusTag tone={IMEI_STATUS_TONES[dev.status]}>
                          {IMEI_STATUS_LABELS[dev.status]}
                        </StatusTag>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#52565e]">
                        {formatPersianDate(dev.createdAt)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDevice(dev)}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          تغییر وضعیت
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
              pageSize={20}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {/* Batch Registration Modal */}
      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="ثبت دسته‌ای IMEI دستگاه‌ها"
        subtitle="هر کد باید ۱۵ رقم باشد و با الگوریتم Luhn تایید شود (یک کد در هر خط)"
        maxWidthClass="max-w-xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBatchOpen(false)}
              disabled={batchSubmitting}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              form="imei-batch-form"
              variant="primary"
              loading={batchSubmitting}
              disabled={parsedBatch.valid.length === 0 || parsedBatch.invalid.length > 0}
            >
              ثبت {toPersianDigits(parsedBatch.valid.length)} سریال معتبر
            </Button>
          </>
        }
      >
        <form id="imei-batch-form" onSubmit={handleBatchSubmit} className="space-y-4">
          {batchError && (
            <div className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]">
              {batchError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="imei-product" className="block text-xs font-medium text-[#111315] mb-1.5">
                محصول *
              </label>
              <select
                id="imei-product"
                value={batchProductId}
                onChange={(e) => setBatchProductId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">انتخاب محصول...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameFa}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="imei-warehouse" className="block text-xs font-medium text-[#111315] mb-1.5">
                انبار محل نگهداری
              </label>
              <select
                id="imei-warehouse"
                value={batchWarehouseId}
                onChange={(e) => setBatchWarehouseId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">بدون تخصیص انبار</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nameFa} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="imei-sku" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد SKU تنوع (اختیاری)
              </label>
              <input
                id="imei-sku"
                type="text"
                dir="ltr"
                value={batchSku}
                onChange={(e) => setBatchSku(e.target.value)}
                placeholder="APL-16PM-256"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="imei-lines" className="block text-xs font-medium text-[#111315] mb-1.5">
              فهرست کدهای IMEI *
            </label>
            <textarea
              id="imei-lines"
              rows={5}
              dir="ltr"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={'356938035643809\n490154203237518'}
              className="w-full p-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] tabular-nums-fa">
              <span className="text-[#166534] font-medium">
                معتبر: {toPersianDigits(parsedBatch.valid.length)}
              </span>
              {parsedBatch.duplicates.length > 0 && (
                <span className="text-[#9a4a06] font-medium">
                  تکراری نادیده‌گرفته‌شده: {toPersianDigits(parsedBatch.duplicates.length)}
                </span>
              )}
              {parsedBatch.invalid.length > 0 && (
                <span className="text-[#b42318] font-medium">
                  نامعتبر (Luhn/طول): {toPersianDigits(parsedBatch.invalid.length)} (
                  <span className="font-mono">{parsedBatch.invalid.slice(0, 2).join(', ')}</span>)
                </span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="imei-note" className="block text-xs font-medium text-[#111315] mb-1.5">
              یادداشت محموله (اختیاری)
            </label>
            <input
              id="imei-note"
              type="text"
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
              placeholder="پارت جدید ورود به انبار مرکزی"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </form>
      </Modal>

      {/* Edit Single Device Modal */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`به‌روزرسانی وضعیت سریال ${editTarget?.imei1 || ''}`}
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editSaving}
            >
              انصراف
            </Button>
            <Button type="submit" form="imei-edit-form" variant="primary" loading={editSaving}>
              ذخیره تغییرات
            </Button>
          </>
        }
      >
        <form id="imei-edit-form" onSubmit={handleSaveDevice} className="space-y-4">
          <div>
            <label htmlFor="imei-edit-status" className="block text-xs font-medium text-[#111315] mb-1.5">
              وضعیت دستگاه
            </label>
            <select
              id="imei-edit-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as ImeiDeviceStatus)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {IMEI_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="imei-edit-order" className="block text-xs font-medium text-[#111315] mb-1.5">
              کد سفارش مرتبط (اختیاری)
            </label>
            <input
              id="imei-edit-order"
              type="text"
              dir="ltr"
              value={editOrderCode}
              onChange={(e) => setEditOrderCode(e.target.value)}
              placeholder="AMS-10421"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div>
            <label htmlFor="imei-edit-note" className="block text-xs font-medium text-[#111315] mb-1.5">
              توضیحات
            </label>
            <textarea
              id="imei-edit-note"
              rows={2}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full p-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
