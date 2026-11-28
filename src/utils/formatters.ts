import type {
  AttributeDataType,
  BrandId,
  BrandInput,
  CategoryInput,
  CategoryItem,
  CouponDiscountType,
  CouponInput,
  DeliverySlot,
  DeviceCondition,
  ImeiDeviceStatus,
  OrderPaymentStatus,
  OrderRecord,
  OrderReturnStatus,
  OrderStatus,
  PaymentReconciliationStatus,
  PaymentTransactionStatus,
  ProductCategoryId,
  ProductInput,
  ProductVariantInput,
  PurchaseOrderInput,
  PurchaseOrderStatus,
  ShippingMethodInput,
  StockMovementInput,
  StockMovementType,
  SupplierInput,
  TechnicalAttributeInput,
  TicketPriority,
  TicketStatus,
  UserRole,
  WarehouseInput,
  WarehouseStockItem,
  WarehouseTransferInput,
  WarrantyInput,
} from '../types/admin';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const BRAND_OPTIONS: readonly BrandId[] = [
  'Apple',
  'Samsung',
  'Xiaomi',
  'Honor',
  'Anker',
  'Motorola',
];

export const CATEGORY_LABELS: Record<ProductCategoryId, string> = {
  phones: 'گوشی موبایل',
  tablets: 'تبلت',
  smartwatches: 'ساعت هوشمند',
  audio: 'هدفون و ایرپاد',
  chargers: 'شارژر و پاوربانک',
  cases: 'قاب و محافظ صفحه',
  gaming: 'لوازم گیمینگ',
};

export const CATEGORY_ICON_OPTIONS: readonly string[] = [
  'Smartphone',
  'Camera',
  'Tablet',
  'Watch',
  'Headphones',
  'Zap',
  'Shield',
  'Gamepad2',
  'Folder',
  'Laptop',
  'Speaker',
  'Cable',
];

export const ATTRIBUTE_DATATYPE_LABELS: Record<AttributeDataType, string> = {
  text: 'متنی',
  number: 'عددی',
  boolean: 'بله / خیر',
  select: 'گزینه‌ای',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  opening_balance: 'موجودی اول دوره',
  purchase_inflow: 'ورود خرید تامین‌کننده',
  order_sale: 'خروج فروش سفارش',
  customer_return: 'برگشت از فروش مشتری',
  transfer_out: 'انتقال خروجی به انبار دیگر',
  transfer_in: 'انتقال ورودی از انبار دیگر',
  inventory_adjustment: 'تعدیل و اصلاح انبارگردانی',
};

export const MOVEMENT_TYPE_TONES: Record<
  StockMovementType,
  'info' | 'success' | 'warning' | 'danger' | 'neutral'
> = {
  opening_balance: 'info',
  purchase_inflow: 'success',
  order_sale: 'danger',
  customer_return: 'success',
  transfer_out: 'warning',
  transfer_in: 'info',
  inventory_adjustment: 'neutral',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'در انتظار پرداخت',
  paid: 'ثبت‌شده (آماده پردازش)',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
  expired: 'منقضی‌شده',
  returned: 'مرجوع‌شده',
};

export const ORDER_STATUS_TONES: Record<
  OrderStatus,
  { bg: string; text: string; border: string }
> = {
  pending_payment: {
    bg: 'bg-[#fffbeb]',
    text: 'text-[#9a4a06]',
    border: 'border-[#fde68a]',
  },
  paid: {
    bg: 'bg-[#eef3fc]',
    text: 'text-[#0f49bd]',
    border: 'border-[#c7d7f8]',
  },
  preparing: {
    bg: 'bg-[#fffbeb]',
    text: 'text-[#9a4a06]',
    border: 'border-[#fde68a]',
  },
  shipped: {
    bg: 'bg-[#f1f2f4]',
    text: 'text-[#111315]',
    border: 'border-[#d8dbe2]',
  },
  delivered: {
    bg: 'bg-[#f0fdf4]',
    text: 'text-[#166534]',
    border: 'border-[#bbf7d0]',
  },
  cancelled: {
    bg: 'bg-[#fef3f2]',
    text: 'text-[#b42318]',
    border: 'border-[#fecaca]',
  },
  expired: {
    bg: 'bg-[#f4f5f7]',
    text: 'text-[#52565e]',
    border: 'border-black/[0.1]',
  },
  returned: {
    bg: 'bg-[#fef3f2]',
    text: 'text-[#9a4a06]',
    border: 'border-[#fde68a]',
  },
};

export interface OrderPaymentSummary {
  status: OrderPaymentStatus;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  reference: string | null;
}

export function resolveOrderPaymentSummary(
  order: Pick<OrderRecord, 'paymentStatus' | 'shaparakRef' | 'status'>
): OrderPaymentSummary {
  const ref = order.shaparakRef?.trim() || null;

  if (order.paymentStatus === 'failed') {
    return { status: 'failed', label: 'پرداخت ناموفق', tone: 'danger', reference: ref };
  }
  if (order.paymentStatus === 'refunded') {
    return { status: 'refunded', label: 'مستردشده', tone: 'neutral', reference: ref };
  }
  if (order.paymentStatus === 'unpaid') {
    return { status: 'unpaid', label: 'پرداخت‌نشده', tone: 'warning', reference: ref };
  }
  if (order.paymentStatus === 'pending_gateway') {
    return { status: 'pending_gateway', label: 'در انتظار تایید درگاه', tone: 'warning', reference: ref };
  }
  if (order.paymentStatus === 'not_required') {
    return { status: 'not_required', label: 'بدون نیاز به پرداخت', tone: 'neutral', reference: ref };
  }
  if (order.paymentStatus === 'pending') {
    return { status: 'pending', label: 'در انتظار پرداخت', tone: 'warning', reference: ref };
  }
  if (order.paymentStatus === 'paid') {
    return { status: 'paid', label: 'پرداخت تاییدشده', tone: 'success', reference: ref };
  }

  if (ref) {
    return { status: 'paid', label: 'پرداخت تاییدشده', tone: 'success', reference: ref };
  }
  if (
    order.status === 'paid' ||
    order.status === 'preparing' ||
    order.status === 'shipped' ||
    order.status === 'delivered'
  ) {
    return { status: 'paid', label: 'پرداخت ثبت‌شده', tone: 'success', reference: null };
  }
  if (order.status === 'pending_payment') {
    return { status: 'unpaid', label: 'پرداخت‌نشده', tone: 'warning', reference: null };
  }
  return { status: 'unknown', label: 'تاییدنشده / نامشخص', tone: 'neutral', reference: null };
}

export const DELIVERY_SLOT_LABELS: Record<DeliverySlot, string> = {
  express: 'ارسال اکسپرس',
  standard: 'پست پیشتاز',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر سیستم',
  customer: 'مشتری',
};

export const COUPON_TYPE_LABELS: Record<CouponDiscountType, string> = {
  percent: 'درصدی',
  fixed: 'مبلغ ثابت (تومان)',
};

export const PAYMENT_TX_STATUS_LABELS: Record<PaymentTransactionStatus, string> = {
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت موفق',
  failed: 'ناموفق',
  refunded: 'مسترد شده',
  partially_refunded: 'استرداد جزئی',
};

export const RECONCILIATION_LABELS: Record<PaymentReconciliationStatus, string> = {
  unmatched: 'تطبیق‌نشده',
  matched: 'تطبیق‌شده',
  discrepancy: 'دارای مغایرت',
};

export const RETURN_STATUS_LABELS: Record<OrderReturnStatus, string> = {
  requested: 'درخواست جدید',
  approved: 'تاییدشده',
  received: 'تحویل انبار',
  refunded: 'تسویه و مستردشده',
  rejected: 'رد شده',
};

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'پیش‌نویس',
  ordered: 'سفارش‌داده‌شده',
  received: 'دریافت‌شده در انبار',
  cancelled: 'لغوشده',
};

export const DEVICE_CONDITION_LABELS: Record<DeviceCondition, string> = {
  new: 'نو و پلمب کارخانه',
  open_box: 'اوپن‌باکس (در حد نو)',
  used_like_new: 'کارکرده در حد نو',
  refurbished: 'ریفربیشد رسمی',
};

export const IMEI_STATUS_LABELS: Record<ImeiDeviceStatus, string> = {
  in_stock: 'موجود در انبار',
  reserved: 'رزروشده برای سفارش',
  sold: 'فروخته و تحویل‌شده',
  returned: 'مرجوعی از مشتری',
  defective: 'معیوب / گارانتی',
};

export const IMEI_STATUS_TONES: Record<
  ImeiDeviceStatus,
  'success' | 'warning' | 'info' | 'danger' | 'neutral'
> = {
  in_stock: 'success',
  reserved: 'warning',
  sold: 'info',
  returned: 'neutral',
  defective: 'danger',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'باز / در انتظار پاسخ',
  in_progress: 'در حال بررسی',
  resolved: 'بسته و حل‌شده',
};

export const TICKET_STATUS_TONES: Record<
  TicketStatus,
  'danger' | 'warning' | 'success'
> = {
  open: 'danger',
  in_progress: 'warning',
  resolved: 'success',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'کم',
  normal: 'عادی',
  high: 'بالا',
  urgent: 'فوری',
};

export const TICKET_PRIORITY_TONES: Record<
  TicketPriority,
  'neutral' | 'info' | 'warning' | 'danger'
> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'product.create': 'ایجاد محصول جدید',
  'product.update': 'ویرایش مشخصات محصول',
  'product.stock_update': 'به‌روزرسانی موجودی انبار',
  'product.delete': 'حذف محصول',
  'product.attributes_update': 'ویرایش ویژگی‌های فنی محصول',
  'variant.create': 'ایجاد تنوع کالایی (SKU)',
  'variant.update': 'ویرایش تنوع کالایی (SKU)',
  'variant.delete': 'حذف تنوع کالایی (SKU)',
  'category.create': 'ایجاد دسته‌بندی',
  'category.update': 'ویرایش دسته‌بندی',
  'category.delete': 'حذف دسته‌بندی',
  'brand.save': 'ثبت/ویرایش برند',
  'brand.delete': 'حذف برند',
  'warranty.create': 'ایجاد شرکت گارانتی',
  'warranty.update': 'ویرایش شرکت گارانتی',
  'warranty.delete': 'حذف شرکت گارانتی',
  'attribute.create': 'تعریف ویژگی فنی',
  'attribute.delete': 'حذف ویژگی فنی',
  'warehouse.create': 'ایجاد انبار',
  'warehouse.update': 'ویرایش انبار',
  'stock_movement.create': 'ثبت تراکنش انبار',
  'warehouse_transfer.create': 'انتقال موجودی بین انبارها',
  'order.update': 'تغییر وضعیت یا یادداشت سفارش',
  'order.cancel': 'لغو سفارش و بازگشت موجودی',
  'payment.verify': 'تایید دستی پرداخت',
  'payment.refund': 'استرداد وجه سفارش',
  'return.update': 'بررسی و تغییر وضعیت مرجوعی',
  'customer.role_update': 'تغییر سطح دسترسی کاربر',
  'customer.status_update': 'تغییر وضعیت مسدودیت/فعالیت کاربر',
  'rbac.role_assign': 'تخصیص نقش دسترسی',
  'rbac.permissions_update': 'ویرایش مجوزهای نقش',
  'sensitive_data.view': 'مشاهده اطلاعات حساس مشتری (PII)',
  'auth.login_success': 'ورود موفق مدیر',
  'auth.login_failed': 'تلاش ناموفق برای ورود',
  'auth.logout': 'خروج از حساب مدیریت',
  'coupon.create': 'ایجاد کد تخفیف',
  'coupon.update': 'ویرایش کد تخفیف',
  'coupon.delete': 'حذف کد تخفیف',
  'ticket.update': 'پاسخ یا تغییر وضعیت تیکت پشتیبانی',
  'review.update': 'تایید یا ویرایش دیدگاه محصول',
  'review.delete': 'حذف دیدگاه محصول',
  'newsletter.delete': 'حذف مشترک خبرنامه',
  'store_settings.update': 'ویرایش تنظیمات عمومی فروشگاه',
};

export function toPersianDigits(input: number | string): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
    .replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)));
}

export function formatToman(amount: number, includeUnit = true): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const withCommas = safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const formatted = toPersianDigits(withCommas);
  return includeUnit ? `${formatted} تومان` : formatted;
}

export function formatPersianNumber(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${sign}${toPersianDigits(abs)}`;
}

export function formatPersianDateTime(raw?: string | null): string {
  if (!raw) return '—';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    return toPersianDigits(raw);
  }
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
}

export function formatPersianDate(raw?: string | null): string {
  if (!raw) return '—';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    return toPersianDigits(raw);
  }
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
}

export function slugifyProductId(input: string): string {
  return toEnglishDigits(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function computeDiscountPercent(
  price: number,
  originalPrice: number | null | undefined
): number {
  if (!originalPrice || originalPrice <= price || price <= 0) return 0;
  return Math.min(99, Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100)));
}

export function calculateProfitMargin(
  priceToman: number,
  costPriceToman?: number | null
): { profitToman: number; marginPercent: number } | null {
  if (
    costPriceToman === null ||
    costPriceToman === undefined ||
    !Number.isFinite(costPriceToman) ||
    costPriceToman <= 0 ||
    !Number.isFinite(priceToman) ||
    priceToman <= 0
  ) {
    return null;
  }
  const profitToman = Math.round(priceToman - costPriceToman);
  const marginPercent = Math.round(((priceToman - costPriceToman) / priceToman) * 1000) / 10;
  return { profitToman, marginPercent };
}

export function generateIdempotencyKey(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CategoryTreeNode {
  category: CategoryItem;
  depth: number;
}

export function buildCategoryTreeList(
  categories: CategoryItem[],
  excludeId?: string
): CategoryTreeNode[] {
  const safe = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const byParent = new Map<string | null, CategoryItem[]>();
  const validIds = new Set(safe.map((c) => c.id));

  for (const cat of safe) {
    if (excludeId && cat.id === excludeId) continue;
    const parentKey = cat.parentId && validIds.has(cat.parentId) && cat.parentId !== cat.id ? cat.parentId : null;
    const list = byParent.get(parentKey) ?? [];
    list.push(cat);
    byParent.set(parentKey, list);
  }

  const result: CategoryTreeNode[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push({ category: child, depth });
      walk(child.id, depth + 1);
    }
  };

  walk(null, 0);

  // Append any disconnected cycle nodes safely
  for (const cat of safe) {
    if (excludeId && cat.id === excludeId) continue;
    if (!visited.has(cat.id)) {
      result.push({ category: cat, depth: 0 });
    }
  }

  return result;
}

export function isValidEmail(email: string): boolean {
  const normalized = toEnglishDigits(email).trim().toLowerCase();
  return Boolean(normalized && normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized));
}

export function normalizeUsername(input: string): string {
  return toEnglishDigits(input).trim().replace(/^@+/, '');
}

export function isValidUsername(username: string): boolean {
  const normalized = normalizeUsername(username);
  return Boolean(normalized && /^[A-Za-z0-9_.-]{3,32}$/.test(normalized));
}

export function isValidLoginIdentifier(identifier: string): boolean {
  const raw = toEnglishDigits(identifier).trim();
  if (!raw) return false;
  if (raw.includes('@') && !raw.startsWith('@')) {
    return isValidEmail(raw);
  }
  return isValidUsername(raw);
}

export function validateProductInput(input: ProductInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.id || !/^[a-z0-9-]+$/.test(input.id)) {
    errors.id = 'شناسه محصول باید شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.';
  }
  if (!input.slug || !/^[a-z0-9-]+$/.test(input.slug)) {
    errors.slug = 'نامک (Slug) محصول باید معتبر و به حروف انگلیسی باشد.';
  }
  if (input.nameFa.trim().length < 2) {
    errors.nameFa = 'نام فارسی محصول باید حداقل ۲ کاراکتر باشد.';
  }
  if (input.nameEn.trim().length < 2) {
    errors.nameEn = 'نام انگلیسی محصول باید حداقل ۲ کاراکتر باشد.';
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    errors.price = 'قیمت فروش باید بزرگ‌تر از صفر باشد.';
  }
  if (
    input.originalPrice !== null &&
    input.originalPrice !== undefined &&
    input.originalPrice > 0 &&
    input.originalPrice < input.price
  ) {
    errors.originalPrice = 'قیمت قبل از تخفیف نمی‌تواند کمتر از قیمت فروش باشد.';
  }
  if (!Number.isInteger(input.stockCount) || input.stockCount < 0) {
    errors.stockCount = 'تعداد موجودی انبار باید عدد صحیح غیرمنفی باشد.';
  }
  if (input.warranty.trim().length < 2) {
    errors.warranty = 'عنوان گارانتی را وارد کنید.';
  }
  if (
    input.recommendPercent !== undefined &&
    (!Number.isInteger(input.recommendPercent) ||
      input.recommendPercent < 0 ||
      input.recommendPercent > 100)
  ) {
    errors.recommendPercent = 'درصد پیشنهاد کاربران باید عدد صحیح بین ۰ تا ۱۰۰ باشد.';
  }
  if (Array.isArray(input.customSpecs)) {
    const hasPartial = input.customSpecs.some((item) => {
      const hasLabel = Boolean(item?.label?.trim());
      const hasValue = Boolean(item?.value?.trim());
      return hasLabel !== hasValue;
    });
    if (hasPartial) {
      errors.customSpecs =
        'برای هر مشخصه فنی دلخواه، هر دو فیلد عنوان و مقدار را تکمیل کنید یا ردیف ناقص را حذف نمایید.';
    }
  }

  return errors;
}

export function validateCategoryInput(input: CategoryInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.label.trim() || input.label.trim().length < 2) {
    errors.label = 'عنوان فارسی دسته‌بندی الزامی است (حداقل ۲ کاراکتر).';
  }
  if (!input.slug.trim() || !/^[a-z0-9-]+$/.test(input.slug.trim())) {
    errors.slug = 'نامک (Slug) باید شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.';
  }
  if (!Number.isInteger(input.sortOrder)) {
    errors.sortOrder = 'ترتیب نمایش باید عدد صحیح باشد.';
  }
  return errors;
}

export function validateBrandInput(input: BrandInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.trim().length < 2) {
    errors.name = 'نام انگلیسی برند الزامی است.';
  }
  if (!input.slug.trim() || !/^[a-z0-9-]+$/.test(input.slug.trim())) {
    errors.slug = 'نامک (Slug) برند باید شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.';
  }
  if (!Number.isInteger(input.sortOrder)) {
    errors.sortOrder = 'ترتیب نمایش باید عدد صحیح باشد.';
  }
  return errors;
}

export function validateWarrantyInput(input: WarrantyInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.code && input.code.trim() && !/^[A-Za-z0-9_-]{2,40}$/.test(input.code.trim())) {
    errors.code = 'کد گارانتی باید شامل حروف انگلیسی، عدد یا خط تیره (۲ تا ۴۰ کاراکتر) باشد.';
  }
  if (!input.providerName.trim() || input.providerName.trim().length < 2) {
    errors.providerName = 'نام شرکت یا عنوان گارانتی الزامی است.';
  }
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 0 || input.durationMonths > 120) {
    errors.durationMonths = 'مدت گارانتی باید عدد صحیح بین ۰ تا ۱۲۰ ماه باشد.';
  }
  return errors;
}

export function validateCouponInput(input: CouponInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const cleanCode = input.code.trim();
  if (!cleanCode || !/^[A-Za-z0-9_-]{3,32}$/.test(cleanCode)) {
    errors.code = 'کد تخفیف باید ۳ تا ۳۲ کاراکتر انگلیسی، عدد یا خط تیره باشد.';
  }
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) {
    errors.discountValue = 'مقدار تخفیف باید بزرگ‌تر از صفر باشد.';
  } else if (input.discountType === 'percent' && input.discountValue > 100) {
    errors.discountValue = 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.';
  }
  if (
    input.maxDiscount !== null &&
    input.maxDiscount !== undefined &&
    (!Number.isFinite(input.maxDiscount) || input.maxDiscount < 0)
  ) {
    errors.maxDiscount = 'سقف تخفیف نمی‌تواند منفی باشد.';
  }
  if (!Number.isFinite(input.minOrderAmount) || input.minOrderAmount < 0) {
    errors.minOrderAmount = 'حداقل مبلغ سفارش نمی‌تواند منفی باشد.';
  }
  if (input.startsAt && input.expiresAt) {
    const startMs = new Date(input.startsAt).getTime();
    const endMs = new Date(input.expiresAt).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
      errors.expiresAt = 'تاریخ انقضا نمی‌تواند پیش از تاریخ شروع باشد.';
    }
  }
  if (
    input.usageLimit !== null &&
    input.usageLimit !== undefined &&
    (!Number.isInteger(input.usageLimit) || input.usageLimit < 1)
  ) {
    errors.usageLimit = 'سقف کل استفاده باید عدد صحیح حداقل ۱ باشد.';
  }
  if (
    input.perUserLimit !== null &&
    input.perUserLimit !== undefined &&
    (!Number.isInteger(input.perUserLimit) || input.perUserLimit < 1)
  ) {
    errors.perUserLimit = 'سقف استفاده برای هر کاربر باید عدد صحیح حداقل ۱ باشد.';
  }
  return errors;
}

export function validateShippingMethodInput(input: ShippingMethodInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.code.trim() || !/^[A-Za-z0-9_-]{2,48}$/.test(input.code.trim())) {
    errors.code = 'کد روش ارسال باید انگلیسی، عدد یا خط تیره باشد.';
  }
  if (!input.nameFa.trim() || input.nameFa.trim().length < 2) {
    errors.nameFa = 'عنوان فارسی روش ارسال الزامی است.';
  }
  if (!Number.isFinite(input.baseCostToman) || input.baseCostToman < 0) {
    errors.baseCostToman = 'هزینه پایه ارسال نمی‌تواند منفی باشد.';
  }
  if (
    input.freeAboveToman !== null &&
    input.freeAboveToman !== undefined &&
    (!Number.isFinite(input.freeAboveToman) || input.freeAboveToman < 0)
  ) {
    errors.freeAboveToman = 'حداقل مبلغ ارسال رایگان نمی‌تواند منفی باشد.';
  }
  if (!Number.isInteger(input.sortOrder)) {
    errors.sortOrder = 'ترتیب نمایش باید عدد صحیح باشد.';
  }
  return errors;
}

export function validateSupplierInput(input: SupplierInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.nameFa.trim() || input.nameFa.trim().length < 2) {
    errors.nameFa = 'نام تامین‌کننده الزامی است (حداقل ۲ کاراکتر).';
  }
  if (input.phone && input.phone.trim() && !/^[0-9+\-\s]{7,20}$/.test(toEnglishDigits(input.phone.trim()))) {
    errors.phone = 'شماره تماس تامین‌کننده معتبر نیست.';
  }
  return errors;
}

export function validatePurchaseOrderInput(input: PurchaseOrderInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.poNumber.trim() || !/^[A-Za-z0-9_-]{3,40}$/.test(input.poNumber.trim())) {
    errors.poNumber = 'شماره سفارش خرید (PO) باید ۳ تا ۴۰ کاراکتر انگلیسی/عددی باشد.';
  }
  if (!input.supplierId.trim()) {
    errors.supplierId = 'انتخاب تامین‌کننده الزامی است.';
  }
  if (!input.warehouseId.trim()) {
    errors.warehouseId = 'انتخاب انبار مقصد الزامی است.';
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.items = 'حداقل یک ردیف کالا برای ثبت سفارش خرید لازم است.';
  } else {
    const invalidItem = input.items.some(
      (item) =>
        !item.variantId.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitCostToman) ||
        item.unitCostToman < 0
    );
    if (invalidItem) {
      errors.items = 'همه اقلام باید دارای تنوع معتبر، تعداد مثبت و بهای واحد غیرمنفی باشند.';
    }
  }
  return errors;
}

export interface InventoryValuationSummary {
  totalOnHandUnits: number;
  totalReservedUnits: number;
  totalAvailableUnits: number;
  valuedRowsCount: number;
  missingCostRowsCount: number;
  totalInventoryCostToman: number;
}

export function calculateInventoryValuation(
  stockItems: WarehouseStockItem[],
  variantCostById: Record<string, number | null | undefined>
): InventoryValuationSummary {
  let totalOnHandUnits = 0;
  let totalReservedUnits = 0;
  let totalAvailableUnits = 0;
  let valuedRowsCount = 0;
  let missingCostRowsCount = 0;
  let totalInventoryCostToman = 0;

  for (const row of stockItems) {
    const onHand = Math.max(0, Math.floor(row.quantityOnHand));
    const reserved = Math.max(0, Math.floor(row.reservedQty));
    const available = Math.max(0, Math.floor(row.availableQty));
    totalOnHandUnits += onHand;
    totalReservedUnits += reserved;
    totalAvailableUnits += available;

    const unitCost = variantCostById[row.variantId];
    if (typeof unitCost === 'number' && Number.isFinite(unitCost) && unitCost > 0) {
      valuedRowsCount += 1;
      totalInventoryCostToman += Math.round(onHand * unitCost);
    } else {
      missingCostRowsCount += 1;
    }
  }

  return {
    totalOnHandUnits,
    totalReservedUnits,
    totalAvailableUnits,
    valuedRowsCount,
    missingCostRowsCount,
    totalInventoryCostToman,
  };
}

export function validateAttributeInput(input: TechnicalAttributeInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.code.trim() || !/^[a-z][a-z0-9_]*$/.test(input.code.trim())) {
    errors.code = 'کد ویژگی باید با حروف کوچک انگلیسی و زیرخط (مثلاً screen_size) نوشته شود.';
  }
  if (!input.nameFa.trim() || input.nameFa.trim().length < 2) {
    errors.nameFa = 'نام فارسی ویژگی الزامی است.';
  }
  return errors;
}

export function validateVariantInput(input: ProductVariantInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.sku.trim() || input.sku.trim().length < 2) {
    errors.sku = 'کد تنوع (SKU) یکتا الزامی است.';
  }
  if (!Number.isFinite(input.priceToman) || input.priceToman <= 0) {
    errors.priceToman = 'قیمت فروش تنوع باید بزرگ‌تر از صفر باشد.';
  }
  if (
    input.originalPriceToman !== null &&
    input.originalPriceToman !== undefined &&
    input.originalPriceToman > 0 &&
    input.originalPriceToman < input.priceToman
  ) {
    errors.originalPriceToman = 'قیمت قبل از تخفیف نمی‌تواند کمتر از قیمت فروش باشد.';
  }
  if (
    input.costPriceToman !== null &&
    input.costPriceToman !== undefined &&
    input.costPriceToman < 0
  ) {
    errors.costPriceToman = 'قیمت تمام‌شده نمی‌تواند منفی باشد.';
  }
  return errors;
}

export function validateWarehouseInput(input: WarehouseInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.code.trim() || !/^[A-Za-z0-9_-]+$/.test(input.code.trim())) {
    errors.code = 'کد انبار باید شامل حروف انگلیسی، عدد و خط تیره باشد (مثلاً WH-THR-CENTRAL).';
  }
  if (!input.nameFa.trim() || input.nameFa.trim().length < 2) {
    errors.nameFa = 'نام فارسی انبار الزامی است.';
  }
  if (!input.city.trim()) {
    errors.city = 'نام شهر انبار الزامی است.';
  }
  return errors;
}

export function validateStockMovementInput(input: StockMovementInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.warehouseId.trim()) {
    errors.warehouseId = 'انتخاب انبار الزامی است.';
  }
  if (!input.variantId.trim()) {
    errors.variantId = 'انتخاب تنوع کالا (SKU) الزامی است.';
  }
  if (!Number.isInteger(input.quantityChange) || input.quantityChange === 0) {
    errors.quantityChange = 'تغییر تعداد باید یک عدد صحیح غیرصفر (مثبت برای ورود، منفی برای خروج) باشد.';
  }
  if (!input.idempotencyKey.trim()) {
    errors.idempotencyKey = 'کلید جلوگیری از ثبت تکراری نامعتبر است.';
  }
  return errors;
}

export function validateWarehouseTransferInput(
  input: WarehouseTransferInput
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.fromWarehouseId.trim()) {
    errors.fromWarehouseId = 'انتخاب انبار مبدا الزامی است.';
  }
  if (!input.toWarehouseId.trim()) {
    errors.toWarehouseId = 'انتخاب انبار مقصد الزامی است.';
  } else if (input.fromWarehouseId.trim() && input.fromWarehouseId.trim() === input.toWarehouseId.trim()) {
    errors.toWarehouseId = 'انبار مبدا و مقصد نمی‌توانند یکسان باشند.';
  }
  if (!input.variantId.trim()) {
    errors.variantId = 'انتخاب تنوع کالا (SKU) الزامی است.';
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    errors.quantity = 'تعداد انتقال باید یک عدد صحیح مثبت بزرگ‌تر از صفر باشد.';
  }
  if (!input.idempotencyKey.trim()) {
    errors.idempotencyKey = 'کلید جلوگیری از ثبت تکراری نامعتبر است.';
  }
  return errors;
}

export function validateStockUpdate(stockCount: number): string | null {
  if (!Number.isInteger(stockCount) || stockCount < 0 || stockCount > 100_000) {
    return 'تعداد موجودی باید یک عدد صحیح بین ۰ تا ۱۰۰٬۰۰۰ باشد.';
  }
  return null;
}

export function validatePasswordStrength(password: string): string | null {
  const normalized = toEnglishDigits(password);
  if (normalized.length < 8 || !/\d/.test(normalized)) {
    return 'رمز عبور باید حداقل ۸ کاراکتر و شامل حداقل یک عدد باشد.';
  }
  return null;
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const lines = [
    headers.map((h) => escapeCsvCell(h)).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function buildSingleOrderCsv(order: OrderRecord): string {
  const payment = resolveOrderPaymentSummary(order);
  const orderStatusLabel = ORDER_STATUS_LABELS[order.status] || String(order.status || 'نامشخص');
  const deliveryLabel = DELIVERY_SLOT_LABELS[order.deliverySlot] || order.deliverySlot || '—';
  const safeItems = Array.isArray(order.items) ? order.items : [];

  return buildCsv(
    [
      'کد سفارش',
      'تاریخ ثبت',
      'وضعیت سفارش',
      'وضعیت پرداخت',
      'کد رهگیری شاپرک',
      'نام مشتری',
      'موبایل',
      'شهر',
      'کد پستی',
      'نشانی',
      'روش ارسال',
      'نام کالا',
      'SKU',
      'رنگ',
      'حافظه',
      'گارانتی',
      'تعداد',
      'قیمت واحد (تومان)',
      'جمع ردیف (تومان)',
      'مبلغ کل سفارش (تومان)',
    ],
    (safeItems.length > 0
      ? safeItems
      : [
          {
            key: 'empty',
            productId: '',
            slug: '',
            nameFa: '—',
            brand: '',
            image: '',
            colorName: '—',
            colorHex: '',
            storageLabel: '—',
            warranty: '—',
            unitPrice: 0,
            originalUnitPrice: 0,
            qty: 0,
            stockCount: 0,
          },
        ]
    ).map((item) => [
      order.orderCode,
      order.createdAt,
      orderStatusLabel,
      payment.label,
      order.shaparakRef || '—',
      order.customerName,
      order.customerPhone,
      order.city,
      order.postalCode,
      order.shippingAddress,
      deliveryLabel,
      item.nameFa,
      item.sku || '—',
      item.colorName || '—',
      item.storageLabel || '—',
      item.warranty || '—',
      item.qty,
      item.unitPrice,
      item.unitPrice * item.qty,
      order.totalAmount,
    ])
  );
}
