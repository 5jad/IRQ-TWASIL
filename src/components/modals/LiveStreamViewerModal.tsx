import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import {
  X,
  Heart,
  Gift,
  Send,
  Radio,
  Eye,
  Sparkles,
  Coins,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatCompactCount } from '../../lib/formatters';

const VIRTUAL_GIFTS = [
  { id: 'rose', name: 'وردة دجلة', icon: '🌹', cost: 5 },
  { id: 'coffee', name: 'فنجان قهوة عربية', icon: '☕', cost: 10 },
  { id: 'palm', name: 'سعفة نخيل عراقية', icon: '🌴', cost: 50 },
  { id: 'shanashil', name: 'شناشيل البصرة', icon: '🏛️', cost: 100 },
  { id: 'harp', name: 'قيثارة أور الذهبية', icon: '🎵', cost: 500 },
];

export function LiveStreamViewerModal() {
  const {
    activeLiveStream,
    setActiveLiveStream,
    walletBalance,
    spendCoinsForGift,
    toggleFollowUser,
    users,
    currentUser,
    numeralSystem,
  } = useApp();

  const [comments, setComments] = useState<{ id: string; user: string; text: string }[]>([]);
  const [inputComment, setInputComment] = useState('');
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [flyingHearts, setFlyingHearts] = useState<{ id: number; x: number }[]>([]);
  const [giftAlert, setGiftAlert] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const liveHost = activeLiveStream
    ? users.find((u) => u.id === activeLiveStream.host.id) ?? activeLiveStream.host
    : null;
  const isHostFollowing = Boolean(liveHost?.isFollowing);
  const isOwnStream = liveHost?.id === currentUser.id;

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputComment.trim()) return;
    setComments((prev) => [
      ...prev,
      { id: String(Date.now()), user: currentUser.displayName, text: inputComment.trim() },
    ]);
    setInputComment('');
  };

  const handleHeartClick = () => {
    const id = Date.now();
    const x = Math.floor(Math.random() * 40) - 20;
    setFlyingHearts((prev) => [...prev.slice(-10), { id, x }]);
    setTimeout(() => {
      setFlyingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 1500);
  };

  const handleSendGift = async (gift: (typeof VIRTUAL_GIFTS)[0]) => {
    if (!activeLiveStream) return;
    const success = await spendCoinsForGift(gift.name, gift.cost, activeLiveStream.host.id);
    if (success) {
      setGiftAlert(`أرسلت ${gift.icon} ${gift.name} للمستضيف!`);
      setShowGiftDrawer(false);
      setComments((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          user: currentUser.displayName,
          text: `🎁 أرسل هدية: ${gift.icon} ${gift.name}`,
        },
      ]);
      setTimeout(() => setGiftAlert(null), 3500);
    } else {
      setGiftAlert('رصيدك من الـ T-Coins غير كافٍ. يمكنك شحن الرصيد من صفحة المحفظة.');
      setTimeout(() => setGiftAlert(null), 3500);
    }
  };

  return (
    <Modal
      isOpen={Boolean(activeLiveStream)}
      onClose={() => setActiveLiveStream(null)}
      title={activeLiveStream?.title ?? 'بث مباشر'}
      testId="tw-live-stream-viewer"
      className="p-0 bg-black"
      overlayClassName="bg-black"
      contentClassName="h-full max-w-md flex items-center justify-center"
    >
      {activeLiveStream && liveHost && (
        <div className="relative w-full h-full sm:h-[840px] sm:rounded-3xl flex flex-col justify-between overflow-hidden select-none bg-gradient-to-br from-slate-900 via-teal-950 to-slate-950">
          {/* Background Live Stream Feed */}
          {liveHost.coverUrl && !coverFailed && (
            <img
              src={liveHost.coverUrl}
              alt={activeLiveStream.title}
              onError={() => setCoverFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Gradient Scrim */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />

          {/* Top Bar: Host Info, Live Badge, Viewers, Close */}
          <div className="relative z-10 flex items-center justify-between p-4 gap-2">
            <div className="flex items-center gap-2.5 bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 min-w-0">
              <Avatar
                src={liveHost.avatarUrl}
                name={liveHost.displayName}
                size={32}
              />
              <div className="flex flex-col text-white min-w-0">
                <span className="text-xs font-bold leading-none truncate">
                  {liveHost.displayName}
                </span>
                <span className="text-[11px] text-white/80 mt-0.5">
                  {formatCompactCount(liveHost.followersCount, numeralSystem)} متابع
                </span>
              </div>
              {!isOwnStream && (
                <button
                  type="button"
                  onClick={() => toggleFollowUser(liveHost.id)}
                  className={`ms-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-colors ${
                    isHostFollowing
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  }`}
                >
                  {isHostFollowing ? 'متابَع' : 'متابعة'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Live Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--danger)] text-[var(--danger-fg)] text-[11px] font-bold shadow-xs">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>مباشر</span>
              </div>

              {/* Viewers Counter */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/45 text-white text-[11px] font-bold backdrop-blur-md">
                <Eye className="w-3.5 h-3.5" />
                <span>{formatCompactCount(activeLiveStream.viewersCount, numeralSystem)}</span>
              </div>

              {/* Audio Toggle */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center backdrop-blur-md"
                aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => setActiveLiveStream(null)}
                className="w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/60"
                aria-label="إغلاق البث المباشر"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Gift Banner Notification */}
          {giftAlert && (
            <div className="relative z-20 mx-4 p-2.5 rounded-2xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{giftAlert}</span>
            </div>
          )}

          {/* Flying Hearts Container */}
          <div className="absolute bottom-24 end-5 pointer-events-none z-20">
            {flyingHearts.map((h) => (
              <div
                key={h.id}
                style={{ transform: `translateX(${h.x}px)` }}
                className="absolute bottom-0 end-0 text-2xl text-[var(--danger)] animate-float-heart"
              >
                ❤️
              </div>
            ))}
          </div>

          {/* Bottom Area: Comments and Controls */}
          <div className="relative z-10 p-4 flex flex-col gap-3">
            {/* Comments Stream */}
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar-none">
              {comments.slice(-5).map((c) => (
                <div
                  key={c.id}
                  className="self-start max-w-[85%] px-3 py-1.5 rounded-2xl bg-black/50 backdrop-blur-md text-white text-xs border border-white/10"
                >
                  <span className="font-bold text-[var(--gold)] me-1.5">{c.user}:</span>
                  <span className="leading-snug">{c.text}</span>
                </div>
              ))}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center gap-2">
              <form onSubmit={handleSendComment} className="flex-1 relative">
                <input
                  type="text"
                  value={inputComment}
                  onChange={(e) => setInputComment(e.target.value)}
                  placeholder="علّق في البث المباشر..."
                  className="w-full h-11 px-4 pe-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 text-xs focus:outline-hidden focus:border-[var(--primary)]"
                />
                <button
                  type="submit"
                  disabled={!inputComment.trim()}
                  className="absolute end-1.5 top-1.5 w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center -scale-x-100 disabled:opacity-40"
                  aria-label="إرسال التعليق"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Gift Button */}
              <button
                type="button"
                onClick={() => setShowGiftDrawer(!showGiftDrawer)}
                className="w-11 h-11 rounded-full bg-[var(--gold)] text-[var(--gold-fg)] flex items-center justify-center shadow-md active:scale-90 transition-transform"
                title="إرسال هدية افتراضية"
                aria-label="إرسال هدية افتراضية"
              >
                <Gift className="w-5 h-5" />
              </button>

              {/* Heart Reaction */}
              <button
                type="button"
                onClick={handleHeartClick}
                className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-90 transition-transform"
                title="إعجاب"
                aria-label="إعجاب"
              >
                <Heart className="w-5 h-5 fill-[var(--danger)] text-[var(--danger)]" />
              </button>
            </div>

            {/* Virtual Gifts Drawer */}
            {showGiftDrawer && (
              <div className="p-4 rounded-3xl bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] shadow-2xl animate-in slide-in-from-bottom duration-150">
                <div className="flex items-center justify-between mb-3 border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-xs font-bold text-[var(--text)]">هدايا الدعم (T-Coins)</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent-text)]">
                    <span>رصيدك:</span>
                    <span>{walletBalance}</span>
                    <span>عملة</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {VIRTUAL_GIFTS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleSendGift(g)}
                      className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--primary-tint)] border border-[var(--border)] active:scale-95 transition-all text-center"
                    >
                      <span className="text-2xl">{g.icon}</span>
                      <span className="text-[11px] font-bold text-[var(--text)] truncate max-w-[60px]">
                        {g.name}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--accent-text)]">{g.cost} كوين</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
