import type {
  AttributeDataType,
  BrandId,
  BrandInput,
  CategoryInput,
  CategoryItem,
  DeliverySlot,
  OrderStatus,
  ProductCategoryId,
  ProductInput,
  ProductVariantInput,
  StockMovementInput,
  StockMovementType,
  TechnicalAttributeInput,
  UserRole,
  WarehouseInput,
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
  return errors;
}

export function validateWarrantyInput(input: WarrantyInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.providerName.trim() || input.providerName.trim().length < 2) {
    errors.providerName = 'نام شرکت یا عنوان گارانتی الزامی است.';
  }
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 0 || input.durationMonths > 120) {
    errors.durationMonths = 'مدت گارانتی باید عدد صحیح بین ۰ تا ۱۲۰ ماه باشد.';
  }
  return errors;
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
