import { ArrowRight, Compass } from 'lucide-react';
import { useRouter } from '../router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  const { pathname, navigate } = useRouter();

  return (
    <Card padding="lg" className="max-w-lg mx-auto my-8 text-center">
      <div className="mx-auto h-11 w-11 rounded-lg bg-[#f1f2f4] border border-black/[0.08] text-[#52565e] flex items-center justify-center mb-3">
        <Compass className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h1 className="text-base font-semibold text-[#111315]">صفحه مورد نظر یافت نشد</h1>
      <p className="mt-2 text-xs leading-6 text-[#52565e]">
        مسیر{' '}
        <span className="font-mono text-[#111315]" dir="ltr">
          {pathname}
        </span>{' '}
        در پنل مدیریت فروشگاه موبایل امیر تعریف نشده است.
      </p>
      <div className="mt-5 flex justify-center">
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => navigate('/', { replace: true })}
          icon={<ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
        >
          بازگشت به داشبورد
        </Button>
      </div>
    </Card>
  );
}
