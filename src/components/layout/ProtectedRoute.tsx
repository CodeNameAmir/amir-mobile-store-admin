import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../router';
import { AdminShell } from './AdminShell';
import { AccessDeniedPage } from '../../pages/AccessDeniedPage';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, isAdmin } = useAuth();
  const { navigate } = useRouter();

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

  return <AdminShell>{children}</AdminShell>;
}
