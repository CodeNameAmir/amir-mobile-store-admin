import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  CmsBanner,
  CmsBannerInput,
  CmsFaq,
  CmsFaqInput,
  CmsPost,
  CmsPostInput,
  CmsPostStatus,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../services/apiClient';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../router';
import { formatPersianDateTime, slugifyProductId, toPersianDigits } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusTag } from '../components/ui/StatusBadge';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../components/ui/StateViews';

type ContentTabId = 'posts' | 'banners' | 'faqs';

function resolveTab(param: string | null): ContentTabId {
  if (param === 'banners' || param === 'faqs') return param;
  return 'posts';
}

export function ContentHubPage() {
  const { searchParams, navigate } = useRouter();
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<ContentTabId>(() =>
    resolveTab(searchParams.get('tab'))
  );

  useEffect(() => {
    setActiveTab(resolveTab(searchParams.get('tab')));
  }, [searchParams]);

  const handleSelectTab = (tab: ContentTabId) => {
    setActiveTab(tab);
    navigate(`/content?tab=${tab}`, { replace: true });
  };

  // Posts state
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsUnsupported, setPostsUnsupported] = useState(false);

  // Banners state
  const [banners, setBanners] = useState<CmsBanner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [bannersError, setBannersError] = useState<string | null>(null);
  const [bannersUnsupported, setBannersUnsupported] = useState(false);

  // FAQs state
  const [faqs, setFaqs] = useState<CmsFaq[]>([]);
  const [faqsLoading, setFaqsLoading] = useState(true);
  const [faqsError, setFaqsError] = useState<string | null>(null);
  const [faqsUnsupported, setFaqsUnsupported] = useState(false);

  // Post Modal state
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CmsPost | null>(null);
  const [postForm, setPostForm] = useState<CmsPostInput>({
    slug: '',
    titleFa: '',
    excerptFa: '',
    contentFa: '',
    coverImage: '',
    categoryFa: 'بررسی تخصصی',
    status: 'draft',
    seoTitle: '',
    seoDescription: '',
  });
  const [savingPost, setSavingPost] = useState(false);

  // Banner Modal state
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<CmsBanner | null>(null);
  const [bannerForm, setBannerForm] = useState<CmsBannerInput>({
    titleFa: '',
    subtitleFa: '',
    imageUrl: '',
    linkUrl: '',
    placement: 'home_hero',
    sortOrder: 1,
    isActive: true,
  });
  const [savingBanner, setSavingBanner] = useState(false);

  // FAQ Modal state
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<CmsFaq | null>(null);
  const [faqForm, setFaqForm] = useState<CmsFaqInput>({
    categoryFa: 'ارسال و تحویل',
    questionFa: '',
    answerFa: '',
    sortOrder: 1,
    isActive: true,
  });
  const [savingFaq, setSavingFaq] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: ContentTabId;
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    setPostsError(null);
    setPostsUnsupported(false);
    try {
      const res = await adminApi.listCmsPosts();
      setPosts(res.posts);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) setPostsUnsupported(true);
      else setPostsError(err instanceof ApiError ? err.message : 'خطا در دریافت مقالات.');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  const loadBanners = useCallback(async () => {
    setBannersLoading(true);
    setBannersError(null);
    setBannersUnsupported(false);
    try {
      const res = await adminApi.listCmsBanners();
      setBanners(res.banners);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) setBannersUnsupported(true);
      else setBannersError(err instanceof ApiError ? err.message : 'خطا در دریافت بنرها.');
    } finally {
      setBannersLoading(false);
    }
  }, []);

  const loadFaqs = useCallback(async () => {
    setFaqsLoading(true);
    setFaqsError(null);
    setFaqsUnsupported(false);
    try {
      const res = await adminApi.listCmsFaqs();
      setFaqs(res.faqs);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) setFaqsUnsupported(true);
      else setFaqsError(err instanceof ApiError ? err.message : 'خطا در دریافت سوالات متداول.');
    } finally {
      setFaqsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'posts') void loadPosts();
    else if (activeTab === 'banners') void loadBanners();
    else void loadFaqs();
  }, [activeTab, loadPosts, loadBanners, loadFaqs]);

  const openPostModal = (post?: CmsPost) => {
    if (post) {
      setEditingPost(post);
      setPostForm({
        slug: post.slug,
        titleFa: post.titleFa,
        excerptFa: post.excerptFa || '',
        contentFa: post.contentFa,
        coverImage: post.coverImage || '',
        categoryFa: post.categoryFa || 'بررسی تخصصی',
        status: post.status,
        seoTitle: post.seoTitle || '',
        seoDescription: post.seoDescription || '',
      });
    } else {
      setEditingPost(null);
      setPostForm({
        slug: '',
        titleFa: '',
        excerptFa: '',
        contentFa: '',
        coverImage: '',
        categoryFa: 'بررسی تخصصی',
        status: 'draft',
        seoTitle: '',
        seoDescription: '',
      });
    }
    setPostModalOpen(true);
  };

  const openBannerModal = (banner?: CmsBanner) => {
    if (banner) {
      setEditingBanner(banner);
      setBannerForm({
        titleFa: banner.titleFa,
        subtitleFa: banner.subtitleFa || '',
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl || '',
        placement: banner.placement || 'home_hero',
        sortOrder: banner.sortOrder,
        isActive: banner.isActive,
      });
    } else {
      setEditingBanner(null);
      setBannerForm({
        titleFa: '',
        subtitleFa: '',
        imageUrl: '',
        linkUrl: '',
        placement: 'home_hero',
        sortOrder: banners.length + 1,
        isActive: true,
      });
    }
    setBannerModalOpen(true);
  };

  const openFaqModal = (faq?: CmsFaq) => {
    if (faq) {
      setEditingFaq(faq);
      setFaqForm({
        categoryFa: faq.categoryFa,
        questionFa: faq.questionFa,
        answerFa: faq.answerFa,
        sortOrder: faq.sortOrder,
        isActive: faq.isActive,
      });
    } else {
      setEditingFaq(null);
      setFaqForm({
        categoryFa: 'ارسال و تحویل',
        questionFa: '',
        answerFa: '',
        sortOrder: faqs.length + 1,
        isActive: true,
      });
    }
    setFaqModalOpen(true);
  };

  const handleSavePost = async (e: FormEvent) => {
    e.preventDefault();
    const cleanSlug = slugifyProductId(postForm.slug) || `post-${Date.now()}`;
    if (!postForm.titleFa.trim() || !postForm.contentFa.trim()) {
      pushToast({ tone: 'error', title: 'عنوان و متن مقاله الزامی است' });
      return;
    }
    setSavingPost(true);
    try {
      const res = await adminApi.saveCmsPost(
        {
          ...postForm,
          slug: cleanSlug,
          titleFa: postForm.titleFa.trim(),
          contentFa: postForm.contentFa.trim(),
          excerptFa: postForm.excerptFa?.trim() || null,
          coverImage: postForm.coverImage?.trim() || null,
          seoTitle: postForm.seoTitle?.trim() || null,
          seoDescription: postForm.seoDescription?.trim() || null,
        },
        editingPost?.id
      );
      setPosts((prev) =>
        editingPost
          ? prev.map((p) => (p.id === editingPost.id ? res.post : p))
          : [res.post, ...prev]
      );
      pushToast({ tone: 'success', title: 'مقاله ذخیره شد' });
      setPostModalOpen(false);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره مقاله',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSavingPost(false);
    }
  };

  const handleSaveBanner = async (e: FormEvent) => {
    e.preventDefault();
    if (!bannerForm.titleFa.trim() || !bannerForm.imageUrl.trim()) {
      pushToast({ tone: 'error', title: 'عنوان و نشانی تصویر بنر الزامی است' });
      return;
    }
    setSavingBanner(true);
    try {
      const res = await adminApi.saveCmsBanner(
        {
          ...bannerForm,
          titleFa: bannerForm.titleFa.trim(),
          imageUrl: bannerForm.imageUrl.trim(),
          subtitleFa: bannerForm.subtitleFa?.trim() || null,
          linkUrl: bannerForm.linkUrl?.trim() || null,
        },
        editingBanner?.id
      );
      setBanners((prev) => {
        const next = editingBanner
          ? prev.map((b) => (b.id === editingBanner.id ? res.banner : b))
          : [...prev, res.banner];
        return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      pushToast({ tone: 'success', title: 'بنر ذخیره شد' });
      setBannerModalOpen(false);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره بنر',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSavingBanner(false);
    }
  };

  const handleSaveFaq = async (e: FormEvent) => {
    e.preventDefault();
    if (!faqForm.questionFa.trim() || !faqForm.answerFa.trim()) {
      pushToast({ tone: 'error', title: 'متن پرسش و پاسخ الزامی است' });
      return;
    }
    setSavingFaq(true);
    try {
      const res = await adminApi.saveCmsFaq(
        {
          ...faqForm,
          categoryFa: faqForm.categoryFa.trim() || 'عمومی',
          questionFa: faqForm.questionFa.trim(),
          answerFa: faqForm.answerFa.trim(),
        },
        editingFaq?.id
      );
      setFaqs((prev) => {
        const next = editingFaq
          ? prev.map((f) => (f.id === editingFaq.id ? res.faq : f))
          : [...prev, res.faq];
        return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      pushToast({ tone: 'success', title: 'سوال متداول ذخیره شد' });
      setFaqModalOpen(false);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره سوال متداول',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSavingFaq(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'posts') {
        await adminApi.deleteCmsPost(deleteTarget.id);
        setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'banners') {
        await adminApi.deleteCmsBanner(deleteTarget.id);
        setBanners((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      } else {
        await adminApi.deleteCmsFaq(deleteTarget.id);
        setFaqs((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      }
      pushToast({ tone: 'info', title: 'آیتم حذف شد', description: deleteTarget.label });
      setDeleteTarget(null);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">مدیریت محتوا، بنرها و سئو</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            انتشار مقالات تخصصی وبلاگ، مدیریت بنرهای صفحه اصلی و سوالات متداول فروشگاه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06]"
            role="tablist"
            aria-label="بخش‌های محتوا"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'posts'}
              onClick={() => handleSelectTab('posts')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                activeTab === 'posts'
                  ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                  : 'text-[#52565e] hover:text-[#111315]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span>مقالات وبلاگ</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'banners'}
              onClick={() => handleSelectTab('banners')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                activeTab === 'banners'
                  ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                  : 'text-[#52565e] hover:text-[#111315]'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span>بنرها و اسلایدر</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'faqs'}
              onClick={() => handleSelectTab('faqs')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                activeTab === 'faqs'
                  ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                  : 'text-[#52565e] hover:text-[#111315]'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span>سوالات متداول</span>
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              if (activeTab === 'posts') openPostModal();
              else if (activeTab === 'banners') openBannerModal();
              else openFaqModal();
            }}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            {activeTab === 'posts'
              ? 'مقاله جدید'
              : activeTab === 'banners'
                ? 'بنر جدید'
                : 'سوال جدید'}
          </Button>
        </div>
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <Card padding="md">
          {postsLoading ? (
            <LoadingSkeleton rows={5} />
          ) : postsUnsupported ? (
            <EndpointUnsupportedState
              title="بخش مقالات وبلاگ در سرور API هنوز فعال نشده است"
              description="رابط مدیریت مقالات و متادیتای سئو آماده است، اما Endpoint مقالات CMS هنوز در Backend ایجاد نشده است."
              endpointHint="GET /api/admin/content/posts"
              onRetry={() => void loadPosts()}
            />
          ) : postsError ? (
            <ErrorState message={postsError} onRetry={() => void loadPosts()} />
          ) : posts.length === 0 ? (
            <EmptyState
              title="هنوز مقاله‌ای ثبت نشده است"
              description="اولین مقاله تخصصی یا راهنمای خرید موبایل را ایجاد کنید."
              icon={<FileText className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
              action={
                <Button variant="primary" size="sm" onClick={() => openPostModal()}>
                  ایجاد مقاله جدید
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">عنوان مقاله</th>
                    <th className="py-3 px-3">نامک (Slug)</th>
                    <th className="py-3 px-3">دسته‌بندی</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {posts.map((post) => (
                    <tr key={post.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                      <td className="py-3 px-3 font-semibold text-[#111315]">{post.titleFa}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#0f49bd]" dir="ltr">
                        {post.slug}
                      </td>
                      <td className="py-3 px-3 text-[#52565e]">{post.categoryFa}</td>
                      <td className="py-3 px-3">
                        <StatusTag tone={post.status === 'published' ? 'success' : 'neutral'}>
                          {post.status === 'published' ? 'منتشرشده' : 'پیش‌نویس'}
                        </StatusTag>
                      </td>
                      <td className="py-3 px-3 text-[#52565e] tabular-nums-fa">
                        {formatPersianDateTime(post.publishedAt || post.createdAt)}
                      </td>
                      <td className="py-3 px-3 text-left whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => openPostModal(post)}
                            icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                          >
                            ویرایش
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`حذف مقاله ${post.titleFa}`}
                            onClick={() =>
                              setDeleteTarget({ type: 'posts', id: post.id, label: post.titleFa })
                            }
                            icon={<Trash2 className="h-3.5 w-3.5 text-[#b42318]" strokeWidth={1.5} aria-hidden="true" />}
                          >
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Banners Tab */}
      {activeTab === 'banners' && (
        <Card padding="md">
          {bannersLoading ? (
            <LoadingSkeleton rows={4} />
          ) : bannersUnsupported ? (
            <EndpointUnsupportedState
              title="بخش بنرها در سرور API هنوز فعال نشده است"
              description="رابط مدیریت بنرهای صفحه اصلی آماده است، اما Endpoint بنرها در Backend هنوز ایجاد نشده است."
              endpointHint="GET /api/admin/content/banners"
              onRetry={() => void loadBanners()}
            />
          ) : bannersError ? (
            <ErrorState message={bannersError} onRetry={() => void loadBanners()} />
          ) : banners.length === 0 ? (
            <EmptyState
              title="بنری ثبت نشده است"
              description="بنرهای صفحه اصلی یا کمپین‌های فروش را در این بخش تعریف کنید."
              icon={<ImageIcon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
              action={
                <Button variant="primary" size="sm" onClick={() => openBannerModal()}>
                  افزودن بنر جدید
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="rounded-xl border border-black/[0.08] bg-[#f6f6f7] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111315] truncate">{banner.titleFa}</p>
                      <p className="text-[11px] text-[#52565e] mt-0.5">
                        جایگاه: <span className="font-mono">{banner.placement}</span> · ترتیب{' '}
                        {toPersianDigits(banner.sortOrder)}
                      </p>
                    </div>
                    <StatusTag tone={banner.isActive ? 'success' : 'neutral'}>
                      {banner.isActive ? 'فعال' : 'غیرفعال'}
                    </StatusTag>
                  </div>
                  <div className="h-28 rounded-lg border border-black/[0.08] bg-white overflow-hidden">
                    <img
                      src={banner.imageUrl}
                      alt={banner.titleFa}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-[#0f49bd] truncate" dir="ltr">
                      {banner.linkUrl || 'بدون لینک'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" variant="secondary" onClick={() => openBannerModal(banner)}>
                        ویرایش
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`حذف بنر ${banner.titleFa}`}
                        onClick={() =>
                          setDeleteTarget({ type: 'banners', id: banner.id, label: banner.titleFa })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[#b42318]" strokeWidth={1.5} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* FAQs Tab */}
      {activeTab === 'faqs' && (
        <Card padding="md">
          <div className="flex justify-end mb-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadFaqs()}
              icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              به‌روزرسانی
            </Button>
          </div>
          {faqsLoading ? (
            <LoadingSkeleton rows={4} />
          ) : faqsUnsupported ? (
            <EndpointUnsupportedState
              title="بخش سوالات متداول در سرور API هنوز فعال نشده است"
              description="مدیریت سوالات متداول آماده است، اما Endpoint آن در Backend هنوز ایجاد نشده است."
              endpointHint="GET /api/admin/content/faqs"
              onRetry={() => void loadFaqs()}
            />
          ) : faqsError ? (
            <ErrorState message={faqsError} onRetry={() => void loadFaqs()} />
          ) : faqs.length === 0 ? (
            <EmptyState
              title="سوال متداولی ثبت نشده است"
              description="سوالات پرتکرار مشتریان درباره گارانتی، رجیستری و ارسال را اینجا ثبت کنید."
              icon={<HelpCircle className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
              action={
                <Button variant="primary" size="sm" onClick={() => openFaqModal()}>
                  ایجاد سوال متداول
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-black/[0.06]">
              {faqs.map((faq) => (
                <div key={faq.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusTag tone={faq.isActive ? 'success' : 'neutral'}>
                        {faq.isActive ? 'فعال' : 'مخفی'}
                      </StatusTag>
                      <span className="text-[11px] text-[#52565e]">{faq.categoryFa}</span>
                      <span className="text-[11px] text-[#7c818c] tabular-nums-fa">
                        ترتیب {toPersianDigits(faq.sortOrder)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#111315]">{faq.questionFa}</p>
                    <p className="text-xs text-[#52565e] leading-5">{faq.answerFa}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => openFaqModal(faq)}>
                      ویرایش
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`حذف سوال ${faq.questionFa}`}
                      onClick={() =>
                        setDeleteTarget({ type: 'faqs', id: faq.id, label: faq.questionFa })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#b42318]" strokeWidth={1.5} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Post Modal */}
      <Modal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        title={editingPost ? 'ویرایش مقاله وبلاگ' : 'ایجاد مقاله جدید'}
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPostModalOpen(false)} disabled={savingPost}>
              انصراف
            </Button>
            <Button type="submit" form="cms-post-form" variant="primary" loading={savingPost}>
              ذخیره مقاله
            </Button>
          </>
        }
      >
        <form id="cms-post-form" onSubmit={handleSavePost} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cms-post-title" className="block font-medium text-[#111315] mb-1.5">
                عنوان مقاله
              </label>
              <input
                id="cms-post-title"
                type="text"
                required
                value={postForm.titleFa}
                onChange={(e) => setPostForm((p) => ({ ...p, titleFa: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
            </div>
            <div>
              <label htmlFor="cms-post-slug" className="block font-medium text-[#111315] mb-1.5">
                نامک انگلیسی (Slug)
              </label>
              <input
                id="cms-post-slug"
                type="text"
                dir="ltr"
                value={postForm.slug}
                onChange={(e) => setPostForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="iphone-16-pro-review"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315]"
              />
            </div>
            <div>
              <label htmlFor="cms-post-category" className="block font-medium text-[#111315] mb-1.5">
                دسته‌بندی موضوعی
              </label>
              <input
                id="cms-post-category"
                type="text"
                value={postForm.categoryFa}
                onChange={(e) => setPostForm((p) => ({ ...p, categoryFa: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
            </div>
            <div>
              <label htmlFor="cms-post-status" className="block font-medium text-[#111315] mb-1.5">
                وضعیت انتشار
              </label>
              <select
                id="cms-post-status"
                value={postForm.status}
                onChange={(e) =>
                  setPostForm((p) => ({ ...p, status: e.target.value as CmsPostStatus }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              >
                <option value="draft">پیش‌نویس</option>
                <option value="published">منتشرشده</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cms-post-cover" className="block font-medium text-[#111315] mb-1.5">
              نشانی تصویر کاور (اختیاری)
            </label>
            <input
              id="cms-post-cover"
              type="url"
              dir="ltr"
              value={postForm.coverImage || ''}
              onChange={(e) => setPostForm((p) => ({ ...p, coverImage: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315]"
            />
          </div>

          <div>
            <label htmlFor="cms-post-content" className="block font-medium text-[#111315] mb-1.5">
              متن کامل مقاله
            </label>
            <textarea
              id="cms-post-content"
              rows={6}
              required
              value={postForm.contentFa}
              onChange={(e) => setPostForm((p) => ({ ...p, contentFa: e.target.value }))}
              className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-6"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/[0.08]">
            <div>
              <label htmlFor="cms-post-seotitle" className="block font-medium text-[#111315] mb-1.5">
                عنوان سئو (Meta Title)
              </label>
              <input
                id="cms-post-seotitle"
                type="text"
                value={postForm.seoTitle || ''}
                onChange={(e) => setPostForm((p) => ({ ...p, seoTitle: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
            </div>
            <div>
              <label htmlFor="cms-post-seodesc" className="block font-medium text-[#111315] mb-1.5">
                توضیحات سئو (Meta Description)
              </label>
              <input
                id="cms-post-seodesc"
                type="text"
                value={postForm.seoDescription || ''}
                onChange={(e) => setPostForm((p) => ({ ...p, seoDescription: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Banner Modal */}
      <Modal
        open={bannerModalOpen}
        onClose={() => setBannerModalOpen(false)}
        title={editingBanner ? 'ویرایش بنر' : 'افزودن بنر جدید'}
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setBannerModalOpen(false)} disabled={savingBanner}>
              انصراف
            </Button>
            <Button type="submit" form="cms-banner-form" variant="primary" loading={savingBanner}>
              ذخیره بنر
            </Button>
          </>
        }
      >
        <form id="cms-banner-form" onSubmit={handleSaveBanner} className="space-y-4 text-xs">
          <div>
            <label htmlFor="cms-banner-title" className="block font-medium text-[#111315] mb-1.5">
              عنوان بنر
            </label>
            <input
              id="cms-banner-title"
              type="text"
              required
              value={bannerForm.titleFa}
              onChange={(e) => setBannerForm((b) => ({ ...b, titleFa: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
            />
          </div>
          <div>
            <label htmlFor="cms-banner-img" className="block font-medium text-[#111315] mb-1.5">
              نشانی تصویر بنر (URL)
            </label>
            <input
              id="cms-banner-img"
              type="url"
              dir="ltr"
              required
              value={bannerForm.imageUrl}
              onChange={(e) => setBannerForm((b) => ({ ...b, imageUrl: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cms-banner-place" className="block font-medium text-[#111315] mb-1.5">
                جایگاه نمایش
              </label>
              <select
                id="cms-banner-place"
                value={bannerForm.placement}
                onChange={(e) => setBannerForm((b) => ({ ...b, placement: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              >
                <option value="home_hero">اسلایدر اصلی صفحه نخست</option>
                <option value="home_promo">بنر تبلیغاتی میانی</option>
                <option value="category_top">بنر بالای دسته‌بندی</option>
              </select>
            </div>
            <div>
              <label htmlFor="cms-banner-order" className="block font-medium text-[#111315] mb-1.5">
                ترتیب نمایش
              </label>
              <input
                id="cms-banner-order"
                type="number"
                dir="ltr"
                value={bannerForm.sortOrder}
                onChange={(e) =>
                  setBannerForm((b) => ({ ...b, sortOrder: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cms-banner-link" className="block font-medium text-[#111315] mb-1.5">
              لینک مقصد (اختیاری)
            </label>
            <input
              id="cms-banner-link"
              type="text"
              dir="ltr"
              value={bannerForm.linkUrl || ''}
              onChange={(e) => setBannerForm((b) => ({ ...b, linkUrl: e.target.value }))}
              placeholder="/products/iphone-16-pro"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315]"
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#111315] font-medium">
            <input
              type="checkbox"
              checked={bannerForm.isActive}
              onChange={(e) => setBannerForm((b) => ({ ...b, isActive: e.target.checked }))}
              className="h-4 w-4 accent-[#0f49bd]"
            />
            <span>بنر فعال و قابل نمایش در فروشگاه باشد</span>
          </label>
        </form>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        open={faqModalOpen}
        onClose={() => setFaqModalOpen(false)}
        title={editingFaq ? 'ویرایش سوال متداول' : 'ایجاد سوال متداول جدید'}
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFaqModalOpen(false)} disabled={savingFaq}>
              انصراف
            </Button>
            <Button type="submit" form="cms-faq-form" variant="primary" loading={savingFaq}>
              ذخیره سوال
            </Button>
          </>
        }
      >
        <form id="cms-faq-form" onSubmit={handleSaveFaq} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cms-faq-cat" className="block font-medium text-[#111315] mb-1.5">
                دسته‌بندی موضوعی
              </label>
              <input
                id="cms-faq-cat"
                type="text"
                value={faqForm.categoryFa}
                onChange={(e) => setFaqForm((f) => ({ ...f, categoryFa: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
            </div>
            <div>
              <label htmlFor="cms-faq-order" className="block font-medium text-[#111315] mb-1.5">
                ترتیب نمایش
              </label>
              <input
                id="cms-faq-order"
                type="number"
                dir="ltr"
                value={faqForm.sortOrder}
                onChange={(e) =>
                  setFaqForm((f) => ({ ...f, sortOrder: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cms-faq-q" className="block font-medium text-[#111315] mb-1.5">
              متن پرسش
            </label>
            <input
              id="cms-faq-q"
              type="text"
              required
              value={faqForm.questionFa}
              onChange={(e) => setFaqForm((f) => ({ ...f, questionFa: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
            />
          </div>
          <div>
            <label htmlFor="cms-faq-a" className="block font-medium text-[#111315] mb-1.5">
              متن پاسخ
            </label>
            <textarea
              id="cms-faq-a"
              rows={4}
              required
              value={faqForm.answerFa}
              onChange={(e) => setFaqForm((f) => ({ ...f, answerFa: e.target.value }))}
              className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5"
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#111315] font-medium">
            <input
              type="checkbox"
              checked={faqForm.isActive}
              onChange={(e) => setFaqForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 accent-[#0f49bd]"
            />
            <span>نمایش عمومی در صفحه سوالات متداول</span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        tone="danger"
        title="تایید حذف محتوا"
        description={`آیا از حذف «${deleteTarget?.label || ''}» اطمینان دارید؟`}
        confirmLabel="حذف دائمی"
      />
    </div>
  );
}
