import type {
  BrandId,
  DeliverySlot,
  OrderStatus,
  ProductCategoryId,
  ProductInput,
  UserRole,
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

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  paid: 'پرداخت‌شده',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
};

export const ORDER_STATUS_TONES: Record<
  OrderStatus,
  { bg: string; text: string; border: string }
> = {
  paid: {
    bg: 'bg-[#dbe1ff]',
    text: 'text-[#004ac6]',
    border: 'border-[#b4c5ff]',
  },
  preparing: {
    bg: 'bg-[#ffdbca]',
    text: 'text-[#8e3c00]',
    border: 'border-[#f4bfa4]',
  },
  shipped: {
    bg: 'bg-[#e5eeff]',
    text: 'text-[#0b1c30]',
    border: 'border-[#c3c6d7]',
  },
  delivered: {
    bg: 'bg-[#dcfce7]',
    text: 'text-[#166534]',
    border: 'border-[#bbf7d0]',
  },
};

export const DELIVERY_SLOT_LABELS: Record<DeliverySlot, string> = {
  express: 'ارسال اکسپرس',
  standard: 'پست پیشتاز',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر سیستم',
  customer: 'مشتری',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'product.create': 'ایجاد محصول جدید',
  'product.update': 'ویرایش مشخصات محصول',
  'product.stock_update': 'به‌روزرسانی موجودی انبار',
  'product.delete': 'حذف محصول',
  'order.update': 'تغییر وضعیت یا یادداشت سفارش',
  'customer.role_update': 'تغییر سطح دسترسی کاربر',
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

export function isValidEmail(email: string): boolean {
  const normalized = toEnglishDigits(email).trim().toLowerCase();
  return Boolean(normalized && normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized));
}

export function validateProductInput(input: ProductInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.id || !/^[a-z0-9-]+$/.test(input.id)) {
    errors.id = 'شناسه محصول باید شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.';
  }
  if (!input.slug || !/^[a-z0-9-]+$/.test(input.slug)) {
    errors.slug = 'نامک (Slug) محصول باید معتبر و به حروف انگلیسی باشد.';
  }
  if (input.nameFa.trim().length < 3) {
    errors.nameFa = 'نام فارسی محصول باید حداقل ۳ کاراکتر باشد.';
  }
  if (input.nameEn.trim().length < 3) {
    errors.nameEn = 'نام انگلیسی محصول باید حداقل ۳ کاراکتر باشد.';
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
  if (input.warranty.trim().length < 3) {
    errors.warranty = 'عنوان گارانتی را وارد کنید.';
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
