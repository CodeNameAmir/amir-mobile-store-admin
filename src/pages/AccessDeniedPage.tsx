import { ExternalLink, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STOREFRONT_URL } from '../config/env';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function AccessDeniedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-4">
      <Card padding="lg" className="w-full max-w-md text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-4">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-[#0b1c30]">
          عدم دسترسی به پنل مدیریت (۴۰۳)
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#434655]">
          حساب کاربری{' '}
          <span className="font-semibold text-[#0b1c30]" dir="ltr">
            {user?.email || 'فعلی'}
          </span>{' '}
          دارای نقش مشتری است و مجوز ورود به بخش مدیریت فروشگاه موبایل امیر را ندارد.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="danger"
            onClick={() => void logout(false)}
            icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
            className="w-full sm:w-auto"
          >
            خروج و ورود با حساب مدیر
          </Button>
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto h-10 px-4 inline-flex items-center justify-center gap-2 rounded-xl border border-[#c3c6d7] bg-white text-sm font-medium text-[#0b1c30] hover:bg-[#f8f9ff] transition-colors"
          >
            <span>بازگشت به فروشگاه</span>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </Card>
    </div>
  );
}
