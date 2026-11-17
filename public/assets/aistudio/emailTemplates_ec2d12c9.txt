export type OtpEmailPurpose = 'signup' | 'login' | 'login-2fa' | 'reset-password' | 'change-email';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapEmailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f8f9ff;font-family:Tahoma,Arial,sans-serif;color:#0b1c30;direction:rtl;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:20px;border:1px solid #e5eeff;overflow:hidden;">
    <tr>
      <td style="background-color:#0b1c30;padding:22px 28px;text-align:right;">
        <div style="font-size:18px;font-weight:bold;color:#ffffff;">فروشگاه موبایل امیر</div>
        <div style="font-size:11px;color:#93c5fd;margin-top:4px;letter-spacing:0.6px;">AMIR MOBILE STORE</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;text-align:right;line-height:1.8;font-size:14px;color:#0b1c30;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px;background-color:#eff4ff;border-top:1px solid #dce9ff;text-align:right;font-size:11px;color:#434655;line-height:1.7;">
        این ایمیل به صورت خودکار از سامانه امنیتی فروشگاه موبایل امیر ارسال شده است.<br/>
        اگر این درخواست توسط شما انجام نشده است، می‌توانید این پیام را نادیده بگیرید.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOtpEmailContent(params: {
  code: string;
  purpose: OtpEmailPurpose;
  recipientName?: string;
}): { subject: string; html: string } {
  const safeName = params.recipientName ? escapeHtml(params.recipientName) : 'کاربر گرامی';
  const safeCode = escapeHtml(params.code);

  const copyByPurpose: Record<
    OtpEmailPurpose,
    { subject: string; heading: string; description: string }
  > = {
    signup: {
      subject: `کد تایید ثبت‌نام در فروشگاه موبایل امیر: ${params.code}`,
      heading: 'تایید آدرس ایمیل و تکمیل ثبت‌نام',
      description: 'برای فعال‌سازی حساب کاربری خود در فروشگاه موبایل امیر، کد زیر را در صفحه ثبت‌نام وارد کنید:',
    },
    login: {
      subject: `کد ورود یک‌بارمصرف فروشگاه موبایل امیر: ${params.code}`,
      heading: 'ورود ایمن با کد یک‌بارمصرف',
      description: 'کد زیر برای ورود به حساب کاربری شما در فروشگاه موبایل امیر صادر شده است:',
    },
    'login-2fa': {
      subject: `کد تایید دومرحله‌ای (2FA) فروشگاه موبایل امیر: ${params.code}`,
      heading: 'تایید ورود دومرحله‌ای',
      description:
        'رمز عبور شما تایید شد. برای تکمیل ورود به حساب کاربری خود، کد ۶ رقمی زیر را وارد کنید:',
    },
    'reset-password': {
      subject: `کد بازیابی رمز عبور فروشگاه موبایل امیر: ${params.code}`,
      heading: 'درخواست بازیابی رمز عبور',
      description: 'برای تنظیم رمز عبور جدید در حساب کاربری خود، کد امنیتی زیر را وارد کنید:',
    },
    'change-email': {
      subject: `کد تایید تغییر ایمیل فروشگاه موبایل امیر: ${params.code}`,
      heading: 'تایید آدرس ایمیل جدید',
      description: 'برای ثبت این ایمیل به عنوان نشانی جدید حساب کاربری خود، کد تایید زیر را وارد کنید:',
    },
  };

  const copy = copyByPurpose[params.purpose];

  const html = wrapEmailLayout(
    copy.subject,
    `
      <p style="margin:0 0 12px 0;font-weight:bold;font-size:16px;color:#0b1c30;">${copy.heading}</p>
      <p style="margin:0 0 12px 0;color:#434655;">سلام ${safeName}،</p>
      <p style="margin:0 0 20px 0;color:#434655;">${copy.description}</p>
      <div style="margin:20px 0;padding:18px;background-color:#eff4ff;border:1px dashed #2563eb;border-radius:14px;text-align:center;">
        <div style="font-size:11px;color:#434655;margin-bottom:6px;">کد تایید ۶ رقمی (اعتبار ۱۰ دقیقه)</div>
        <div style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#004ac6;direction:ltr;font-family:monospace;">${safeCode}</div>
      </div>
      <p style="margin:0;font-size:12px;color:#434655;">لطفاً این کد را در اختیار دیگران قرار ندهید.</p>
    `
  );

  return { subject: copy.subject, html };
}

export function buildWelcomeEmailContent(params: {
  fullName: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.fullName);
  const subject = 'به فروشگاه موبایل امیر خوش آمدید';
  const html = wrapEmailLayout(
    subject,
    `
      <p style="margin:0 0 12px 0;font-weight:bold;font-size:16px;color:#0b1c30;">عضویت شما با موفقیت تکمیل شد</p>
      <p style="margin:0 0 14px 0;color:#434655;">سلام ${safeName} عزیز،</p>
      <p style="margin:0 0 16px 0;color:#434655;">
        حساب کاربری شما در فروشگاه موبایل امیر فعال شد. از این پس می‌توانید آدرس‌های ارسال را ذخیره کنید، سفارش‌های خود را لحظه‌ای پیگیری نمایید و از تخفیف‌های ویژه اعضا بهره‌مند شوید.
      </p>
      <div style="padding:14px 16px;background-color:#f8f9ff;border:1px solid #e5eeff;border-radius:12px;font-size:13px;color:#0b1c30;">
        کد تخفیف خوش‌آمدگویی شما: <strong style="color:#004ac6;font-family:monospace;" dir="ltr">AMIR-OFF</strong>
      </div>
    `
  );
  return { subject, html };
}

export function buildSecurityAlertEmailContent(params: {
  fullName: string;
  actionLabel: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.fullName);
  const safeAction = escapeHtml(params.actionLabel);
  const subject = `اطلاع‌رسانی امنیتی حساب کاربری: ${params.actionLabel}`;
  const html = wrapEmailLayout(
    subject,
    `
      <p style="margin:0 0 12px 0;font-weight:bold;font-size:16px;color:#0b1c30;">تغییر تنظیمات امنیتی حساب</p>
      <p style="margin:0 0 12px 0;color:#434655;">سلام ${safeName}،</p>
      <p style="margin:0 0 16px 0;color:#434655;">
        تغییر «<strong>${safeAction}</strong>» در حساب کاربری شما با موفقیت ثبت شد.
      </p>
      <p style="margin:0;font-size:12px;color:#434655;">
        اگر این تغییر توسط شما انجام نشده است، بلافاصله از بخش امنیت حساب کاربری رمز عبور خود را تغییر دهید و از همه نشست‌ها خارج شوید.
      </p>
    `
  );
  return { subject, html };
}

export function buildOrderReceiptEmailContent(params: {
  fullName: string;
  orderCode: string;
  totalFormatted: string;
  itemsCount: number;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.fullName);
  const safeCode = escapeHtml(params.orderCode);
  const safeTotal = escapeHtml(params.totalFormatted);
  const subject = `تایید ثبت سفارش ${params.orderCode} — فروشگاه موبایل امیر`;
  const html = wrapEmailLayout(
    subject,
    `
      <p style="margin:0 0 12px 0;font-weight:bold;font-size:16px;color:#0b1c30;">سفارش شما ثبت شد</p>
      <p style="margin:0 0 12px 0;color:#434655;">سلام ${safeName}،</p>
      <p style="margin:0 0 16px 0;color:#434655;">
        سفارش شماره <strong dir="ltr" style="color:#004ac6;">${safeCode}</strong> شامل ${params.itemsCount} کالا به مبلغ کل <strong>${safeTotal} تومان</strong> با موفقیت در سامانه ثبت شد و در حال آماده‌سازی است.
      </p>
    `
  );
  return { subject, html };
}
