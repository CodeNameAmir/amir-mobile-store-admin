import { toEnglishDigits } from './storeLogic';

export function normalizeEmail(raw: string): string {
  return toEnglishDigits(raw).trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function normalizeOtpCode(raw: string): string {
  return toEnglishDigits(raw).replace(/[\s\-_]/g, '').trim();
}

export function isValidOtpCode(raw: string): boolean {
  const code = normalizeOtpCode(raw);
  return /^\d{6}$/.test(code);
}

export function isValidIranMobile(raw: string): boolean {
  const phone = toEnglishDigits(raw).replace(/[\s-]/g, '').trim();
  return /^09\d{9}$/.test(phone);
}

export function isValidNationalId(raw: string): boolean {
  const code = toEnglishDigits(raw).replace(/[\s-]/g, '').trim();
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(code[i]) * (10 - i);
  }
  const rem = sum % 11;
  return (rem < 2 && check === rem) || (rem >= 2 && check === 11 - rem);
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  labelFa: string;
  valid: boolean;
  checks: {
    minLength: boolean;
    hasLetter: boolean;
    hasNumber: boolean;
    hasSymbolOrUpper: boolean;
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  const minLength = password.length >= 8;
  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(password);
  const hasNumber = /\d/.test(toEnglishDigits(password));
  const hasSymbolOrUpper = /[A-Z!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const count = [minLength, hasLetter, hasNumber, hasSymbolOrUpper].filter(Boolean).length as
    | 0
    | 1
    | 2
    | 3
    | 4;

  const labels: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'بسیار ضعیف',
    1: 'ضعیف',
    2: 'متوسط',
    3: 'خوب',
    4: 'قوی',
  };

  return {
    score: count,
    labelFa: labels[count],
    valid: minLength && hasLetter && hasNumber,
    checks: {
      minLength,
      hasLetter,
      hasNumber,
      hasSymbolOrUpper,
    },
  };
}

export interface SignupFormInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export function validateSignupForm(data: SignupFormInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.fullName.trim().length < 3) {
    errors.fullName = 'نام و نام خانوادگی باید حداقل ۳ حرف باشد.';
  }
  if (!isValidEmail(data.email)) {
    errors.email = 'لطفاً یک آدرس ایمیل معتبر وارد کنید (مثال: name@domain.com).';
  }
  if (data.phone.trim() && !isValidIranMobile(data.phone)) {
    errors.phone = 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
  }
  const strength = getPasswordStrength(data.password);
  if (!strength.valid) {
    errors.password = 'رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد.';
  }
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'تکرار رمز عبور با رمز عبور یکسان نیست.';
  }
  return errors;
}

export interface ProfileFormInput {
  fullName: string;
  phone: string;
  nationalId?: string;
}

export function validateProfileForm(data: ProfileFormInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.fullName.trim().length < 3) {
    errors.fullName = 'نام و نام خانوادگی باید حداقل ۳ حرف باشد.';
  }
  if (data.phone.trim() && !isValidIranMobile(data.phone)) {
    errors.phone = 'شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹).';
  }
  if (data.nationalId && data.nationalId.trim() && !isValidNationalId(data.nationalId)) {
    errors.nationalId = 'کد ملی واردشده معتبر نیست.';
  }
  return errors;
}

export interface AddressFormInput {
  label: string;
  receiverName: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
}

export function validateAddressForm(data: AddressFormInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.label.trim().length < 2) {
    errors.label = 'عنوان آدرس را وارد کنید (مثال: منزل یا محل کار).';
  }
  if (data.receiverName.trim().length < 3) {
    errors.receiverName = 'نام تحویل‌گیرنده باید حداقل ۳ حرف باشد.';
  }
  if (!isValidIranMobile(data.phone)) {
    errors.phone = 'شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹).';
  }
  if (data.city.trim().length < 2) {
    errors.city = 'نام استان یا شهر را وارد کنید.';
  }
  if (data.address.trim().length < 10) {
    errors.address = 'نشانی کامل پستی (حداقل ۱۰ کاراکتر) را وارد کنید.';
  }
  const postal = toEnglishDigits(data.postalCode).replace(/[\s-]/g, '').trim();
  if (!/^\d{10}$/.test(postal)) {
    errors.postalCode = 'کد پستی باید دقیقاً ۱۰ رقم باشد.';
  }
  return errors;
}
