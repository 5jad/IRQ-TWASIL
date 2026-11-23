import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ProductCard } from '../market/ProductCard';
import { SmartImage } from '../ui/SmartImage';
import { SearchField } from '../ui/Input';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  MapPin,
  Info,
  Store,
  Package,
  Plus,
  ShoppingBag,
  MessageCircle,
  Trash2,
  X,
  ImagePlus,
  Check,
} from 'lucide-react';
import { formatPriceIQD, formatTimeSafe } from '../../lib/formatters';
import { filterProducts } from '../../lib/remediation';
import type { MarketOrder } from '../../types';

const IRAQI_PROVINCES = [
  'الكل',
  'بغداد',
  'البصرة',
  'أربيل',
  'النجف الأشرف',
  'كربلاء المقدسة',
  'السليمانية',
  'نينوى',
  'بابل',
  'كركوك',
  'ذي قار',
  'ديالى',
];

const CATEGORIES = [
  'الكل',
  'نحاسيات وفضيات',
  'كتب ومطبوعات',
  'سجاد وأنسجة',
  'أحجار ومسابح',
  'أزياء تراثية',
  'إلكترونيات',
  'أخرى',
];

const ORDER_STATUS_LABELS: Record<MarketOrder['status'], { label: string; cls: string }> = {
  pending: { label: 'قيد الانتظار', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  confirmed: { label: 'مؤكد', cls: 'bg-[var(--primary-tint)] text-[var(--primary)]' },
  completed: { label: 'مكتمل', cls: 'bg-[var(--success-tint)] text-[var(--success)]' },
  cancelled: { label: 'ملغى', cls: 'bg-[var(--danger-tint)] text-[var(--danger)]' },
};

export function MarketView() {
  const {
    currentUser,
    users,
    products,
    orders,
    setActiveProductDetail,
    numeralSystem,
    startChatWithUser,
    createProduct,
    deleteProduct,
    updateOrderStatus,
    requireAuthForWrite,
    serverOnline,
    showAppToast,
  } = useApp();

  const [activeMarketTab, setActiveMarketTab] = useState<'browse' | 'orders' | 'inventory'>('browse');
  const [selectedProvince, setSelectedProvince] = useState<string>('الكل');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Product Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [prodTitle, setProdTitle] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodComparePrice, setProdComparePrice] = useState('');
  const [prodCategory, setProdCategory] = useState('نحاسيات وفضيات');
  const [prodCondition, setProdCondition] = useState<'new' | 'used'>('new');
  const [prodCity, setProdCity] = useState(currentUser.province || 'بغداد');
  const [prodProvince, setProdProvince] = useState(currentUser.province || 'بغداد');
  const [prodMediaFile, setProdMediaFile] = useState<File | null>(null);
  const [prodMediaPreview, setProdMediaPreview] = useState<string | null>(null);
  const [isCreatingProd, setIsCreatingProd] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const byQueryAndCategory = filterProducts(products, searchQuery, selectedCategory);
    if (selectedProvince === 'الكل') return byQueryAndCategory;
    return byQueryAndCategory.filter((p) => p.province === selectedProvince);
  }, [products, searchQuery, selectedCategory, selectedProvince]);

  const ownProducts = useMemo(
    () => products.filter((p) => p.sellerId === currentUser.id),
    [products, currentUser.id]
  );

  const prodMediaPreviewRef = useRef<string | null>(prodMediaPreview);
  prodMediaPreviewRef.current = prodMediaPreview;

  useEffect(() => {
    return () => {
      if (prodMediaPreviewRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(prodMediaPreviewRef.current);
      }
    };
  }, []);

  const resetCreateForm = () => {
    setProdTitle('');
    setProdPrice('');
    setProdComparePrice('');
    setProdCategory('نحاسيات وفضيات');
    setProdCondition('new');
    setProdCity(currentUser.province || 'بغداد');
    setProdProvince(currentUser.province || 'بغداد');
    if (prodMediaPreview?.startsWith('blob:')) URL.revokeObjectURL(prodMediaPreview);
    setProdMediaFile(null);
    setProdMediaPreview(null);
  };

  const handleCloseCreateModal = () => {
    resetCreateForm();
    setIsCreateOpen(false);
  };

  const handleOpenCreateModal = () => {
    if (serverOnline && !requireAuthForWrite()) return;
    setIsCreateOpen(true);
  };

  const handlePickProductMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (prodMediaPreview) URL.revokeObjectURL(prodMediaPreview);
    setProdMediaFile(file);
    setProdMediaPreview(URL.createObjectURL(file));
  };

  const handleSubmitCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serverOnline && !requireAuthForWrite()) return;
    const priceIqd = Number(prodPrice);
    const compareAt = prodComparePrice.trim() ? Number(prodComparePrice) : undefined;
    if (!prodTitle.trim() || prodTitle.trim().length < 2) {
      showAppToast('أدخل عنواناً واضحاً للمنتج', 'error');
      return;
    }
    if (!Number.isFinite(priceIqd) || priceIqd < 250) {
      showAppToast('أدخل سعراً صحيحاً بالدينار العراقي (٢٥٠ د.ع فأكثر)', 'error');
      return;
    }
    setIsCreatingProd(true);
    try {
      const ok = await createProduct(
        {
          title: prodTitle.trim(),
          priceIqd: Math.round(priceIqd),
          compareAtPriceIqd: compareAt && Number.isFinite(compareAt) ? Math.round(compareAt) : undefined,
          category: prodCategory,
          condition: prodCondition,
          city: prodCity.trim() || prodProvince,
          province: prodProvince,
        },
        prodMediaFile ?? undefined
      );
      if (ok) {
        resetCreateForm();
        setIsCreateOpen(false);
        setActiveMarketTab('inventory');
      }
    } finally {
      setIsCreatingProd(false);
    }
  };

  const handleOrderStatusChange = async (orderId: string, nextStatus: MarketOrder['status']) => {
    if (serverOnline && !requireAuthForWrite()) return;
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div
      className="w-full max-w-5xl mx-auto px-4 py-4 flex flex-col gap-4 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12"
      data-testid="tw-market-view"
    >
      {/* Market Navigation Sub-Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2 select-none flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveMarketTab('browse')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
              activeMarketTab === 'browse'
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-xs'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>السوق العام</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMarketTab('orders')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
              activeMarketTab === 'orders'
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-xs'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>اتفاقاتي وطلباتي</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[11px]">
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMarketTab('inventory')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
              activeMarketTab === 'inventory'
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-xs'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>لوحة التاجر ومعروضاتي</span>
          </button>
        </div>

        <Button
          type="button"
          variant="primary-sm"
          onClick={handleOpenCreateModal}
          className="gap-1.5 shrink-0"
          data-testid="tw-market-add-product-btn"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة سلعة</span>
        </Button>
      </div>

      {activeMarketTab === 'browse' && (
        <>
          {/* Search & Province Header */}
          <div className="flex flex-col gap-2.5">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="ابحث في سوق تواصل عن سلع أو متاجر عراقية..."
              className="w-full"
            />

            {/* Province Filter Pill */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full scrollbar-none py-1">
              <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0" />
              {IRAQI_PROVINCES.map((prov) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => setSelectedProvince(prov)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                    selectedProvince === prov
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] shadow-xs'
                      : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]'
                  }`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>

          {/* Honesty Banner */}
          <div className="p-3 rounded-xl bg-[var(--accent-tint)] border border-[var(--accent)]/30 flex items-center gap-2.5 text-xs text-[var(--accent-text)] font-semibold select-none">
            <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span>
              تنبيه: المنصة لا تفرض عمولة ولا تتولى التوصيل أو تحصيل المدفوعات. يتم الاتفاق المباشر على طريقة التسليم والدفع بين المشتري والبائع.
            </span>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none select-none py-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-2 text-[var(--text-muted)]">
              <Store className="w-8 h-8 text-[var(--primary)]/60" />
              <p className="text-sm font-bold text-[var(--text)]">لا توجد منتجات مطابقة حالياً</p>
              <p className="text-xs">جرّب تغيير البحث أو المحافظة، أو أضف سلعتك الأولى للبيع.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onClick={() => setActiveProductDetail(prod)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeMarketTab === 'orders' && (
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
            سجل الاتفاقات والطلبات المباشرة بين المشتري والبائع. تتحدث حالات الطلب فوراً وتُحفظ في قاعدة البيانات.
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              لا توجد طلبات أو اتفاقات حالياً.
            </div>
          ) : (
            orders.map((ord) => {
              const statusMeta = ORDER_STATUS_LABELS[ord.status] ?? ORDER_STATUS_LABELS.pending;
              const isSeller = ord.sellerId === currentUser.id;
              const isBuyer = ord.buyerId === currentUser.id;
              const peerUserId = isSeller ? ord.buyerId : ord.sellerId;
              const peerUser = peerUserId ? users.find((u) => u.id === peerUserId) : undefined;
              const isBusy = updatingOrderId === ord.id;

              return (
                <div
                  key={ord.id}
                  className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SmartImage
                      src={ord.productImageUrl}
                      alt={ord.productTitle}
                      containerClassName="w-14 h-14 rounded-xl shrink-0"
                    />
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[var(--text)] truncate">
                          {ord.productTitle}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${statusMeta.cls}`}>
                          {statusMeta.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {isSeller ? 'طلب وارد إليك' : 'طلبك'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] flex-wrap">
                        {peerUser && <span>الطرف الآخر: {peerUser.displayName}</span>}
                        <span>·</span>
                        <span>{formatTimeSafe(ord.createdAt, numeralSystem)}</span>
                      </div>
                      {ord.note && (
                        <span className="text-[11px] text-[var(--text-muted)] truncate">
                          ملاحظة: {ord.note}
                        </span>
                      )}
                      <span className="text-sm font-bold text-[var(--accent-text)] mt-0.5">
                        {formatPriceIQD(ord.priceIqd, numeralSystem)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                    {isSeller && ord.status === 'pending' && (
                      <Button
                        type="button"
                        variant="primary-sm"
                        isLoading={isBusy}
                        onClick={() => void handleOrderStatusChange(ord.id, 'confirmed')}
                        className="gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تأكيد الطلب</span>
                      </Button>
                    )}
                    {isSeller && (ord.status === 'pending' || ord.status === 'confirmed') && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleOrderStatusChange(ord.id, 'completed')}
                        className="h-8 px-3 text-xs"
                      >
                        إكمال التسليم
                      </Button>
                    )}
                    {(isSeller || (isBuyer && ord.status === 'pending')) &&
                      ord.status !== 'completed' &&
                      ord.status !== 'cancelled' && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => void handleOrderStatusChange(ord.id, 'cancelled')}
                          className="h-8 px-3 text-xs text-rose-500 hover:bg-rose-500/10"
                        >
                          إلغاء
                        </Button>
                      )}
                    {peerUser && (
                      <button
                        type="button"
                        onClick={() => void startChatWithUser(peerUser)}
                        className="h-8 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] flex items-center gap-1.5 hover:bg-[var(--border)]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 -scale-x-100" />
                        <span>مراسلة</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeMarketTab === 'inventory' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">إدارة معروضاتك</h3>
              <p className="text-xs text-[var(--text-muted)]">
                المنتجات المنشورة بواسطة حسابك ({ownProducts.length})
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="h-9 px-3.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سلعة جديدة</span>
            </button>
          </div>

          {ownProducts.length === 0 ? (
            <div className="py-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center flex flex-col items-center gap-2 text-[var(--text-muted)]">
              <Package className="w-8 h-8 text-[var(--primary)]/60" />
              <p className="text-sm font-bold text-[var(--text)]">لا توجد منتجات مدرجة باسمك بعد</p>
              <Button type="button" variant="primary-sm" onClick={handleOpenCreateModal}>
                أضف منتجك الأول
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ownProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SmartImage
                      src={prod.imageUrl}
                      alt={prod.title}
                      containerClassName="w-14 h-14 rounded-xl shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[var(--text)] truncate">
                        {prod.title}
                      </span>
                      <span className="text-xs font-bold text-[var(--accent-text)]">
                        {formatPriceIQD(prod.priceIqd, numeralSystem)}
                      </span>
                      <span className="text-[11px] text-[var(--success)] font-semibold">
                        {prod.inStock ? 'نشط ومعروض في السوق' : 'نفذت الكمية'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveProductDetail(prod)}
                      className="text-xs font-semibold text-[var(--primary)] hover:underline px-2 py-1"
                    >
                      معاينة
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteProduct(prod.id)}
                      aria-label={`حذف ${prod.title}`}
                      className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Product Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={handleCloseCreateModal}
        title="إدراج سلعة جديدة في السوق"
        testId="tw-market-create-modal"
        contentClassName="max-w-lg"
      >
        <form
          onSubmit={handleSubmitCreateProduct}
          className="w-full rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text)]">إدراج سلعة جديدة في السوق</h3>
            <button
              type="button"
              onClick={handleCloseCreateModal}
              aria-label="إغلاق"
              className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

            <div className="p-5 overflow-y-auto flex flex-col gap-3">
              {/* Image Picker */}
              <div className="flex items-center gap-3">
                <label className="w-20 h-20 rounded-2xl bg-[var(--surface-2)] border border-dashed border-[var(--border-strong)] flex flex-col items-center justify-center cursor-pointer overflow-hidden shrink-0">
                  {prodMediaPreview ? (
                    <img src={prodMediaPreview} alt="معاينة المنتج" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImagePlus className="w-5 h-5 text-[var(--primary)]" />
                      <span className="text-[10px] text-[var(--text-muted)] mt-1">صورة</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePickProductMedia}
                    className="sr-only"
                  />
                </label>
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-xs font-bold text-[var(--text)]">صورة السلعة</span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    أرفق صورة واضحة للسلعة بصيغة JPG أو PNG أو WebP أو GIF.
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--text)]">اسم السلعة</label>
                <input
                  type="text"
                  required
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  placeholder="مثال: إبريق نحاسي بغدادي منقوش يدوياً"
                  className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[var(--text)]">السعر (د.ع)</label>
                  <input
                    type="number"
                    min={250}
                    required
                    dir="ltr"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="25000"
                    className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[var(--text)]">السعر السابق (اختياري)</label>
                  <input
                    type="number"
                    min={250}
                    dir="ltr"
                    value={prodComparePrice}
                    onChange={(e) => setProdComparePrice(e.target.value)}
                    placeholder="35000"
                    className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[var(--text)]">التصنيف</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)]"
                  >
                    {CATEGORIES.filter((c) => c !== 'الكل').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[var(--text)]">الحالة</label>
                  <select
                    value={prodCondition}
                    onChange={(e) => setProdCondition(e.target.value as 'new' | 'used')}
                    className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)]"
                  >
                    <option value="new">جديد</option>
                    <option value="used">مستعمل</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[var(--text)]">المحافظة</label>
                  <select
                    value={prodProvince}
                    onChange={(e) => setProdProvince(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)]"
                  >
                    {IRAQI_PROVINCES.filter((p) => p !== 'الكل').map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[var(--text)]">المدينة / المنطقة</label>
                  <input
                    type="text"
                    required
                    value={prodCity}
                    onChange={(e) => setProdCity(e.target.value)}
                    placeholder="الكرادة"
                    className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)]"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-[var(--border)] flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleCloseCreateModal}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" isLoading={isCreatingProd}>
                نشر السلعة في السوق
              </Button>
            </div>
          </form>
      </Modal>
    </div>
  );
}
