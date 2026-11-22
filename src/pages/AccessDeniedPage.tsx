import { ExternalLink, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STOREFRONT_URL } from '../config/env';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function AccessDeniedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center p-4">
      <Card padding="lg" className="w-full max-w-md text-center ams-enter">
        <div className="mx-auto h-10 w-10 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-[#b42318] flex items-center justify-center mb-4">
          <ShieldAlert className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h1 className="text-base font-semibold text-[#111315]">
          عدم دسترسی به پنل مدیریت (۴۰۳)
        </h1>
        <p className="mt-2 text-xs leading-6 text-[#52565e]">
          حساب کاربری{' '}
          <span className="font-mono font-medium text-[#111315]" dir="ltr">
            {user?.email || 'فعلی'}
          </span>{' '}
          دارای نقش مشتری است و مجوز ورود به بخش مدیریت را ندارد.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Button
            variant="danger"
            onClick={() => void logout(false)}
            icon={<LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            className="w-full sm:w-auto"
          >
            خروج و ورود با حساب مدیر
          </Button>
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto h-9 px-3.5 inline-flex items-center justify-center gap-2 rounded-lg border border-black/[0.12] bg-white text-xs font-medium text-[#111315] hover:bg-[#f6f6f7] transition-colors duration-150"
          >
            <span>بازگشت به فروشگاه</span>
            <ExternalLink className="h-3.5 w-3.5 text-[#7c818c]" strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>
      </Card>
    </div>
  );
}
