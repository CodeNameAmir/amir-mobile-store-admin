import { useEffect, useState } from 'react';
import { HelpCircle, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useRouter } from '../router';
import { TicketsTab } from '../components/support/TicketsTab';
import { ReviewsTab } from '../components/support/ReviewsTab';
import { NewsletterTab } from '../components/support/NewsletterTab';
import { ProductQaTab } from '../components/support/ProductQaTab';

export type SupportTabId = 'tickets' | 'reviews' | 'qa' | 'newsletter';

function resolveTab(pathname: string, tabParam: string | null): SupportTabId {
  if (tabParam === 'reviews' || pathname === '/reviews') return 'reviews';
  if (tabParam === 'qa' || pathname === '/qa') return 'qa';
  if (tabParam === 'newsletter' || pathname === '/newsletter') return 'newsletter';
  if (tabParam === 'tickets' || pathname === '/tickets') return 'tickets';
  return 'tickets';
}

export function SupportHubPage() {
  const { pathname, searchParams, navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<SupportTabId>(() =>
    resolveTab(pathname, searchParams.get('tab'))
  );

  useEffect(() => {
    setActiveTab(resolveTab(pathname, searchParams.get('tab')));
  }, [pathname, searchParams]);

  const handleSelectTab = (tab: SupportTabId) => {
    setActiveTab(tab);
    navigate(`/support?tab=${tab}`, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">پشتیبانی، دیدگاه‌ها و پرسش و پاسخ</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            پاسخگویی به تیکت‌های مشتریان، تایید نظرات، پاسخ به پرسش‌های محصولات و خبرنامه
          </p>
        </div>

        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06]"
          role="tablist"
          aria-label="بخش‌های پشتیبانی و تعامل مشتریان"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tickets'}
            onClick={() => handleSelectTab('tickets')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              activeTab === 'tickets'
                ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                : 'text-[#52565e] hover:text-[#111315]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>تیکت‌های پشتیبانی</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'qa'}
            onClick={() => handleSelectTab('qa')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              activeTab === 'qa'
                ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                : 'text-[#52565e] hover:text-[#111315]'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>پرسش و پاسخ</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviews'}
            onClick={() => handleSelectTab('reviews')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              activeTab === 'reviews'
                ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                : 'text-[#52565e] hover:text-[#111315]'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>نظرات محصولات</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'newsletter'}
            onClick={() => handleSelectTab('newsletter')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              activeTab === 'newsletter'
                ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                : 'text-[#52565e] hover:text-[#111315]'
            }`}
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>مشترکین خبرنامه</span>
          </button>
        </div>
      </div>

      {activeTab === 'tickets' ? (
        <TicketsTab />
      ) : activeTab === 'qa' ? (
        <ProductQaTab />
      ) : activeTab === 'reviews' ? (
        <ReviewsTab />
      ) : (
        <NewsletterTab />
      )}
    </div>
  );
}
