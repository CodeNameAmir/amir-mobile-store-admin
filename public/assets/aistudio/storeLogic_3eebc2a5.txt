import type {
  CartItem,
  CheckoutFormData,
  ContactFormData,
  CouponRule,
  FilterState,
  InstallmentPlan,
  Product,
} from '../types/store';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const FREE_SHIPPING_THRESHOLD = 1_000_000;
export const STANDARD_SHIPPING_FEE = 150_000;
export const DEFAULT_MONTHLY_INSTALLMENT_RATE = 2.2; // 2.2% monthly fee

export const DEFAULT_COUPON_RULES: CouponRule[] = [
  {
    code: 'AMIR-OFF',
    discountType: 'fixed',
    discountValue: 500_000,
    maxDiscount: 500_000,
    minOrderAmount: 0,
    descriptionFa: 'تخفیف ۵۰۰ هزار تومانی خرید اول',
  },
  {
    code: 'VIP-10',
    discountType: 'percent',
    discountValue: 10,
    maxDiscount: 2_000_000,
    minOrderAmount: 1_000_000,
    descriptionFa: 'تخفیف ۱۰ درصدی ویژه تا سقف ۲ میلیون تومان',
  },
];

export function toPersianDigits(input: number | string): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
    .replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)));
}

export function formatToman(amount: number): string {
  const rounded = Math.max(0, Math.round(amount));
  const withCommas = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return toPersianDigits(withCommas);
}

export function getVariantPrice(product: Product, storageLabel?: string): {
  price: number;
  originalPrice: number;
} {
  const variant = product.storageOptions.find((s) => s.label === storageLabel);
  const delta = variant ? variant.priceDelta : 0;
  const price = product.price + delta;
  const originalPrice = (product.originalPrice ?? product.price) + delta;
  return { price, originalPrice };
}

export function calculateCareInsurancePrice(unitPrice: number, category: Product['category']): number {
  if (category !== 'phones' && category !== 'tablets' && category !== 'smartwatches') {
    return 0;
  }
  const fourPercent = Math.round((unitPrice * 0.04) / 10_000) * 10_000;
  return Math.max(490_000, Math.min(3_200_000, fourPercent));
}

export function calculateInstallmentPlan(
  totalPrice: number,
  downPaymentPercent: number,
  months: number,
  monthlyRatePercent = DEFAULT_MONTHLY_INSTALLMENT_RATE
): InstallmentPlan {
  const safePrice = Math.max(0, Math.round(totalPrice));
  const safeDownPct = Math.min(80, Math.max(10, downPaymentPercent));
  const safeMonths = Math.max(3, Math.min(36, Math.round(months)));

  const downPaymentAmount = Math.round((safePrice * safeDownPct) / 100);
  const financedAmount = Math.max(0, safePrice - downPaymentAmount);
  const totalFee = Math.round(financedAmount * (monthlyRatePercent / 100) * safeMonths);
  const totalInstallmentsAmount = financedAmount + totalFee;
  const monthlyPayment = Math.round(totalInstallmentsAmount / safeMonths);
  const totalPayableWithPlan = downPaymentAmount + totalInstallmentsAmount;

  return {
    totalPrice: safePrice,
    downPaymentPercent: safeDownPct,
    downPaymentAmount,
    financedAmount,
    months: safeMonths,
    monthlyRatePercent,
    monthlyPayment,
    totalInstallmentsAmount,
    totalPayableWithPlan,
  };
}

const PERSIAN_SEARCH_ALIASES: Record<string, string> = {
  آیفون: 'iphone',
  ایفون: 'iphone',
  اپل: 'apple',
  آیپد: 'ipad',
  ایپد: 'ipad',
  ایرپاد: 'airpods',
  واچ: 'watch',
  سامسونگ: 'samsung',
  گلکسی: 'galaxy',
  شیائومی: 'xiaomi',
  شیامی: 'xiaomi',
  انکر: 'anker',
  اولترا: 'ultra',
  پرو: 'pro',
  مکس: 'max',
};

export function matchesProductSearch(product: Product, queryRaw: string): boolean {
  const normalizedQuery = toEnglishDigits(queryRaw.trim().toLowerCase());
  if (!normalizedQuery) return true;

  const haystack = toEnglishDigits(
    `${product.nameFa} ${product.nameEn} ${product.brand} ${product.specs.chipset} ${product.specs.storageDefault}`
  ).toLowerCase();

  if (haystack.includes(normalizedQuery)) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  return tokens.every((token) => {
    const alias = PERSIAN_SEARCH_ALIASES[token];
    return haystack.includes(token) || (alias ? haystack.includes(alias) : false);
  });
}

export function filterAndSortProducts(products: Product[], filters: FilterState): Product[] {
  const filtered = products.filter((p) => {
    if (filters.category === 'offers') {
      if (!p.discountPercent || p.discountPercent <= 0) return false;
    } else if (filters.category !== 'all' && p.category !== filters.category) {
      return false;
    }

    if (filters.brands.length > 0 && !filters.brands.includes(p.brand)) {
      return false;
    }

    if (filters.inStockOnly && !p.inStock) {
      return false;
    }

    if (filters.discountedOnly && (!p.discountPercent || p.discountPercent <= 0)) {
      return false;
    }

    if (filters.expressOnly && !p.expressDelivery) {
      return false;
    }

    if (p.price < filters.minPrice || p.price > filters.maxPrice) {
      return false;
    }

    if (filters.storage) {
      const hasStorage =
        p.specs.storageDefault === filters.storage ||
        p.storageOptions.some((s) => s.label === filters.storage);
      if (!hasStorage) return false;
    }

    if (filters.ram && p.specs.ram !== filters.ram) {
      return false;
    }

    if (filters.colorId) {
      const hasColor = p.colors.some((c) => c.id === filters.colorId);
      if (!hasColor) return false;
    }

    if (filters.searchQuery.trim() && !matchesProductSearch(p, filters.searchQuery)) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered];
  switch (filters.sortBy) {
    case 'cheapest':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'expensive':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'bestselling':
      sorted.sort((a, b) => a.salesRank - b.salesRank);
      break;
    case 'popular':
      sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => a.releaseOrder - b.releaseOrder);
      break;
  }

  return sorted;
}

export interface CouponEvaluation {
  valid: boolean;
  code: string | null;
  discountAmount: number;
  message: string;
}

export function evaluateCoupon(
  codeRaw: string,
  netSubtotal: number,
  customRules: CouponRule[] = DEFAULT_COUPON_RULES
): CouponEvaluation {
  let code = toEnglishDigits(codeRaw).trim().toUpperCase();
  if (code === 'CNA-OFF' || code === 'تخفیف') {
    code = 'AMIR-OFF';
  }

  if (!code) {
    return {
      valid: false,
      code: null,
      discountAmount: 0,
      message: 'لطفاً کد تخفیف را وارد نمایید.',
    };
  }
  if (netSubtotal <= 0) {
    return {
      valid: false,
      code: null,
      discountAmount: 0,
      message: 'سبد خرید شما خالی است.',
    };
  }

  const rule = customRules.find((r) => r.code.toUpperCase() === code);
  if (!rule) {
    return {
      valid: false,
      code: null,
      discountAmount: 0,
      message: 'کد تخفیف وارد شده معتبر نیست یا منقضی شده است.',
    };
  }

  if (rule.minOrderAmount && netSubtotal < rule.minOrderAmount) {
    return {
      valid: false,
      code: null,
      discountAmount: 0,
      message: `حداقل مبلغ سفارش برای کد ${rule.code} برابر ${formatToman(rule.minOrderAmount)} تومان است.`,
    };
  }

  let discountAmount =
    rule.discountType === 'fixed'
      ? rule.discountValue
      : Math.round((netSubtotal * rule.discountValue) / 100);

  if (rule.maxDiscount && rule.maxDiscount > 0) {
    discountAmount = Math.min(rule.maxDiscount, discountAmount);
  }
  discountAmount = Math.min(netSubtotal, Math.max(0, discountAmount));

  return {
    valid: true,
    code: rule.code,
    discountAmount,
    message: `کد تخفیف ${rule.code} اعمال شد (${formatToman(discountAmount)} تومان کسر گردید).`,
  };
}

export interface CartSummary {
  itemCount: number;
  originalSubtotal: number;
  netSubtotal: number;
  productDiscount: number;
  couponDiscount: number;
  shippingCost: number;
  freeShippingEligible: boolean;
  totalPayable: number;
  totalSavings: number;
}

export function calculateCartSummary(
  items: CartItem[],
  couponCode: string | null,
  customRules: CouponRule[] = DEFAULT_COUPON_RULES,
  freeShippingThreshold: number = FREE_SHIPPING_THRESHOLD
): CartSummary {
  let itemCount = 0;
  let originalSubtotal = 0;
  let netSubtotal = 0;

  for (const item of items) {
    const safeQty = Math.max(1, item.qty);
    itemCount += safeQty;
    originalSubtotal += item.originalUnitPrice * safeQty;
    netSubtotal += item.unitPrice * safeQty;
  }

  const productDiscount = Math.max(0, originalSubtotal - netSubtotal);
  const couponEval = couponCode
    ? evaluateCoupon(couponCode, netSubtotal, customRules)
    : { valid: false, code: null, discountAmount: 0, message: '' };
  const couponDiscount = couponEval.valid ? couponEval.discountAmount : 0;

  const afterDiscounts = Math.max(0, netSubtotal - couponDiscount);
  const freeShippingEligible = afterDiscounts >= freeShippingThreshold || items.length === 0;
  const shippingCost = items.length === 0 || freeShippingEligible ? 0 : STANDARD_SHIPPING_FEE;
  const totalPayable = afterDiscounts + shippingCost;
  const totalSavings = productDiscount + couponDiscount;

  return {
    itemCount,
    originalSubtotal,
    netSubtotal,
    productDiscount,
    couponDiscount,
    shippingCost,
    freeShippingEligible,
    totalPayable,
    totalSavings,
  };
}

export function validateCheckoutForm(data: CheckoutFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.fullName.trim().length < 3) {
    errors.fullName = 'نام و نام خانوادگی تحویل‌گیرنده باید حداقل ۳ حرف باشد.';
  }
  const phoneEn = toEnglishDigits(data.phone.trim()).replace(/[\s-]/g, '');
  if (!/^09\d{9}$/.test(phoneEn)) {
    errors.phone = 'شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹).';
  }
  if (data.city.trim().length < 2) {
    errors.city = 'نام شهر یا استان را وارد کنید.';
  }
  if (data.address.trim().length < 10) {
    errors.address = 'نشانی کامل پستی (حداقل ۱۰ کاراکتر) را وارد کنید.';
  }
  const postalEn = toEnglishDigits(data.postalCode.trim()).replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(postalEn)) {
    errors.postalCode = 'کد پستی باید دقیقاً ۱۰ رقم باشد.';
  }
  return errors;
}

export function validateContactForm(data: ContactFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.fullName.trim().length < 3) {
    errors.fullName = 'لطفاً نام و نام خانوادگی خود را وارد کنید.';
  }
  const phoneEn = toEnglishDigits(data.phone.trim()).replace(/[\s-]/g, '');
  if (!/^09\d{9}$/.test(phoneEn)) {
    errors.phone = 'شماره تماس همراه باید ۱۱ رقم و با ۰۹ شروع شود.';
  }
  if (data.message.trim().length < 10) {
    errors.message = 'متن پیام باید حداقل ۱۰ کاراکتر باشد.';
  }
  return errors;
}

export function generateOrderCode(seed?: number): string {
  const num = seed ?? Math.floor(10000 + Math.random() * 89999);
  return `AMIR-${num}`;
}
