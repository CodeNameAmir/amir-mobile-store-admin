import { useEffect, useState } from 'react';
import { Award, FolderTree, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useRouter } from '../router';
import { CategoriesTab } from '../components/catalog/CategoriesTab';
import { BrandsTab } from '../components/catalog/BrandsTab';
import { WarrantiesTab } from '../components/catalog/WarrantiesTab';
import { AttributesTab } from '../components/catalog/AttributesTab';

type CatalogTabKey = 'categories' | 'brands' | 'warranties' | 'attributes';

const TABS: Array<{ key: CatalogTabKey; label: string; icon: typeof FolderTree }> = [
  { key: 'categories', label: 'دسته‌بندی‌ها', icon: FolderTree },
  { key: 'brands', label: 'برندها', icon: Award },
  { key: 'warranties', label: 'گارانتی‌ها', icon: ShieldCheck },
  { key: 'attributes', label: 'ویژگی‌های فنی استاندارد', icon: SlidersHorizontal },
];

export function CatalogPage() {
  const { searchParams, navigate } = useRouter();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<CatalogTabKey>(
    initialTab === 'brands' ||
      initialTab === 'warranties' ||
      initialTab === 'attributes' ||
      initialTab === 'categories'
      ? initialTab
      : 'categories'
  );

  useEffect(() => {
    const param = searchParams.get('tab');
    if (
      param === 'categories' ||
      param === 'brands' ||
      param === 'warranties' ||
      param === 'attributes'
    ) {
      setActiveTab(param);
    }
  }, [searchParams]);

  const handleSelectTab = (tab: CatalogTabKey) => {
    setActiveTab(tab);
    navigate(`/catalog?tab=${tab}`, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#111315]">کاتالوگ و مشخصات پایه</h1>
        <p className="mt-1 text-xs text-[#52565e]">
          مدیریت دسته‌بندی‌های درختی، برندها، شرکت‌های گارانتی و ویژگی‌های فنی استاندارد
        </p>
      </div>

      {/* Segmented Tab Navigation */}
      <div
        className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06] w-fit"
        role="tablist"
        aria-label="بخش‌های کاتالوگ پایه"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelectTab(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 h-8 rounded-md text-xs transition-colors duration-150 whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                  : 'text-[#52565e] hover:text-[#111315] font-medium'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'brands' && <BrandsTab />}
      {activeTab === 'warranties' && <WarrantiesTab />}
      {activeTab === 'attributes' && <AttributesTab />}
    </div>
  );
}
