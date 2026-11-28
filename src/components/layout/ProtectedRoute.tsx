import { useEffect, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../router';
import { canAccessRoute } from '../../utils/permissions';
import { AdminShell } from './AdminShell';
import { AccessDeniedPage } from '../../pages/AccessDeniedPage';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, isAdmin, user } = useAuth();
  const { pathname, navigate } = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login', { replace: true });
    }
  }, [status, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden="true"
            className="h-9 w-9 rounded-full border-2 border-black/[0.1] border-t-[#0f49bd] animate-spin"
          />
          <p className="text-sm font-medium text-[#52565e]">
            بررسی نشست و سطح دسترسی مدیریت
          </p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (status === 'forbidden' || !isAdmin) {
    return <AccessDeniedPage />;
  }

  if (!canAccessRoute(user, pathname)) {
    return (
      <AdminShell>
        <Card padding="lg" className="max-w-lg mx-auto my-10 text-center space-y-4">
          <div className="mx-auto h-11 w-11 rounded-full bg-[#fef3f2] text-[#b42318] flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-base font-semibold text-[#111315]">
              عدم دسترسی به این بخش
            </h1>
            <p className="text-xs leading-6 text-[#52565e]">
              نقش دسترسی فعلی حساب شما مجوز مشاهده یا مدیریت این صفحه را ندارد. در صورت نیاز با مدیر ارشد سامانه تماس بگیرید.
            </p>
          </div>
          <div className="pt-1">
            <Button variant="primary" size="sm" onClick={() => navigate('/')}>
              بازگشت به داشبورد
            </Button>
          </div>
        </Card>
      </AdminShell>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
