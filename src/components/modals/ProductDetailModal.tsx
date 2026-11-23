import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { SmartImage } from '../ui/SmartImage';
import { Modal } from '../ui/Modal';
import {
  X,
  MessageCircle,
  Heart,
  Share2,
  ShieldCheck,
  MapPin,
  Store,
  Info,
  AlertTriangle,
  ShoppingBag,
} from 'lucide-react';
import { formatPriceIQD, formatCompactCount } from '../../lib/formatters';

export function ProductDetailModal() {
  const {
    activeProductDetail,
    setActiveProductDetail,
    toggleWishlistProduct,
    createOrder,
    startChatWithUser,
    openShareModal,
    openReportModal,
    users,
    currentUser,
    numeralSystem,
    setViewingUser,
    setCurrentRoute,
  } = useApp();

  const [orderNote, setOrderNote] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);

  const fallbackSeller = users[0] ?? currentUser;
  const sellerUser = activeProductDetail
    ? users.find((u) => u.id === activeProductDetail.sellerId) ??
      users.find((u) => u.displayName === activeProductDetail.shopName) ??
      users.find((u) => u.accountType === 'merchant') ??
      fallbackSeller
    : fallbackSeller;

  const isOwnProduct = sellerUser.id === currentUser.id;

  const handleContactSeller = () => {
    if (isOwnProduct) return;
    setActiveProductDetail(null);
    startChatWithUser(sellerUser);
  };

  const handlePlaceOrder = async () => {
    if (!activeProductDetail || isOwnProduct || !activeProductDetail.inStock || isOrdering) return;
    setIsOrdering(true);
    try {
      const ok = await createOrder(activeProductDetail.id, orderNote.trim());
      if (ok) {
        setOrderNote('');
        setActiveProductDetail(null);
      }
    } finally {
      setIsOrdering(false);
    }
  };

  const handleVisitShop = () => {
    setActiveProductDetail(null);
    setViewingUser(sellerUser);
    setCurrentRoute('profile');
  };

  return (
    <Modal
      isOpen={Boolean(activeProductDetail)}
      onClose={() => setActiveProductDetail(null)}
      title="تفاصيل السلعة"
      testId="tw-product-detail-modal"
      className="items-end sm:items-center p-0 sm:p-4"
      contentClassName="sm:max-w-xl"
    >
      {activeProductDetail && (
        <div className="w-full bg-[var(--surface)] text-[var(--text)] rounded-t-3xl sm:rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] select-none">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-base font-bold text-[var(--text)]">تفاصيل السلعة</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  openShareModal(
                    activeProductDetail.title,
                    `${window.location.origin}/market/p/${activeProductDetail.id}`
                  );
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] active:scale-95"
                aria-label="مشاركة السلعة"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveProductDetail(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] active:scale-95"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Main Product Image Container */}
            <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] shadow-xs">
              <SmartImage
                src={activeProductDetail.imageUrl}
                alt={activeProductDetail.title}
                containerClassName="w-full h-full"
              />

              <span className="absolute top-3 start-3 px-3 py-1 rounded-lg bg-[var(--overlay)] backdrop-blur-md text-white text-xs font-bold">
                {activeProductDetail.condition === 'new' ? 'جديد بالكامل' : 'مستعمل بحالة ممتازة'}
              </span>

              <button
                type="button"
                onClick={() => toggleWishlistProduct(activeProductDetail.id)}
                className="absolute top-3 end-3 w-10 h-10 rounded-full bg-[var(--surface)]/90 backdrop-blur-md flex items-center justify-center text-[var(--text)] shadow-sm active:scale-90 transition-transform"
                aria-label="المفضلة"
              >
                <Heart
                  className={`w-5 h-5 ${
                    activeProductDetail.isWishlisted ? 'text-[var(--danger)] fill-[var(--danger)]' : ''
                  }`}
                />
              </button>
            </div>

            {/* Title & Price */}
            <div className="flex flex-col gap-1.5">
              <h2 className="font-sans text-lg font-bold text-[var(--text)] leading-snug">
                {activeProductDetail.title}
              </h2>

              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-[var(--accent-text)]">
                  {formatPriceIQD(activeProductDetail.priceIqd, numeralSystem)}
                </span>
                {activeProductDetail.compareAtPriceIqd && (
                  <span className="text-xs text-[var(--text-muted)] line-through">
                    {formatPriceIQD(activeProductDetail.compareAtPriceIqd, numeralSystem)}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--success-tint)] text-[var(--success)] font-bold">
                  {activeProductDetail.inStock ? 'متوفر حالياً' : 'نفذت الكمية'}
                </span>
              </div>
            </div>

            {/* Seller Card */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3">
              <button
                type="button"
                className="flex items-center gap-3 text-start"
                onClick={handleVisitShop}
              >
                <Avatar src={sellerUser.avatarUrl} name={sellerUser.displayName} size={44} />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--text)] hover:underline">
                      {activeProductDetail.shopName}
                    </span>
                    <VerifiedBadge kind={activeProductDetail.shopVerified ? 'merchant' : 'none'} size={14} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[var(--accent)]" />
                      {activeProductDetail.city}، {activeProductDetail.province}
                    </span>
                    <span>·</span>
                    <span>{formatCompactCount(sellerUser.followersCount, numeralSystem)} متابع</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleVisitShop}
                className="text-xs font-bold text-[var(--primary-text)] hover:underline px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
              >
                زيارة المتجر
              </button>
            </div>

            {!isOwnProduct && activeProductDetail.inStock && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text)]">
                  ملاحظة للبائع مع الطلب (اختياري)
                </label>
                <input
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  maxLength={240}
                  placeholder="عنوان التوصيل أو موعد المعاينة المقترح..."
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[var(--primary)]"
                />
              </div>
            )}

            {/* Honest Disclaimer Banner */}
            <div className="p-3 rounded-2xl bg-[var(--accent-tint)] border border-[var(--accent)]/30 flex items-start gap-2.5 text-xs text-[var(--accent-text)] select-none">
              <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">تنبيه المعاملة المباشرة:</span>
                <span className="leading-relaxed">
                  تواصل لا تفرض أي نسبة عمولة، ولا تتدخل كوسيط مالي أو شركة شحن. يتم الاتفاق الودي على المعاينة والتسليم والدفع نقداً عند الاستلام أو بالتحويل المباشر مع البائع.
                </span>
              </div>
            </div>

            {/* Safety Recommendations */}
            <div className="p-3 rounded-2xl bg-[var(--surface-2)]/70 border border-[var(--border)] flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text)]">
                <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
                <span>إرشادات الأمان للمشتري:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                <li>عاين السلعة بنفسك في مكان عام وواضح قبل الدفع.</li>
                <li>لا تقم بإرسال حوالات مالية مسبقة لأشخاص مجهولين.</li>
                <li>وثّق اتفاقك ومواصفات السلعة داخل محادثة تواصل.</li>
              </ul>
            </div>
          </div>

          {/* Fixed Action Bar at Bottom */}
          <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex items-center gap-2.5">
            {isOwnProduct ? (
              <span className="flex-1 text-center text-xs font-bold text-[var(--text-muted)] py-3 rounded-xl bg-[var(--surface-2)]">
                هذا المنتج معروض في متجرك
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!activeProductDetail.inStock || isOrdering}
                  onClick={() => void handlePlaceOrder()}
                  className="flex-1 h-12 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-bold text-sm flex items-center justify-center gap-2 shadow-xs hover:opacity-95 active:scale-98 transition-all disabled:opacity-40"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isOrdering ? 'جاري إرسال الطلب...' : 'اطلب الآن'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleContactSeller}
                  className="h-12 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-bold text-xs flex items-center justify-center gap-1.5 hover:border-[var(--primary)] active:scale-98 transition-all"
                >
                  <MessageCircle className="w-4 h-4 -scale-x-100" />
                  <span>مراسلة</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                openReportModal('product', activeProductDetail.title, activeProductDetail.id);
              }}
              className="h-12 px-3.5 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] flex items-center justify-center active:scale-95 transition-all"
              title="إبلاغ عن السلعة"
              aria-label="إبلاغ عن السلعة"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
