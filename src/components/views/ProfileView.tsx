import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { Button } from '../ui/Button';
import {
  Grid,
  Film,
  FileText,
  Bookmark,
  Calendar,
  MapPin,
  Sparkles,
  Music,
  Pin,
  ExternalLink,
  Store,
  Award,
  RotateCcw,
  Volume2,
  VolumeX,
  Camera,
  Star,
  Ban,
  Flag,
  LogIn,
} from 'lucide-react';
import { formatCompactCount, IRAQI_MONTHS, toArabicIndicDigits } from '../../lib/formatters';
import { validateCanvasJson } from '../../lib/canvasSchema';
import {
  resolveCanvasAppearance,
  extractCanvasLinks,
  getCanvasPinnedContent,
  getCanvasMusicContent,
  MAQAM_SCALES,
} from '../../lib/canvasStyles';
import { isVideoSource } from '../../lib/apiHelpers';
import { SmartImage } from '../ui/SmartImage';
import { ImageCropModal } from '../modals/ImageCropModal';

export function ProfileView() {
  const {
    currentUser,
    viewingUser,
    posts,
    setCurrentRoute,
    numeralSystem,
    activeCanvasConfig,
    setActiveCanvasConfig,
    toggleFollowUser,
    toggleCloseFriend,
    blockUser,
    openReportModal,
    startChatWithUser,
    openShareModal,
    updateCurrentUser,
    isAuthenticated,
    serverOnline,
    requireAuthForWrite,
  } = useApp();
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'text' | 'saved'>('posts');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<{
    file: File;
    target: 'avatar' | 'cover';
  } | null>(null);

  const navigate = useNavigate();
  const isOwnProfile = !viewingUser || viewingUser.id === currentUser.id;
  const profileUser = isOwnProfile ? currentUser : viewingUser;

  useEffect(() => {
    if (!isOwnProfile && activeTab === 'saved') {
      setActiveTab('posts');
    }
  }, [isOwnProfile, activeTab]);

  const userPosts = posts.filter((p) => p.author.id === profileUser.id);
  const mediaItems = userPosts.flatMap((p) =>
    (p.media ?? []).map((m) => ({ ...m, postId: p.id, postText: p.text }))
  );

  const parsedViewingCanvas =
    !isOwnProfile && profileUser.canvasConfig
      ? validateCanvasJson(profileUser.canvasConfig)
      : null;
  const resolvedCanvas = isOwnProfile
    ? activeCanvasConfig
    : parsedViewingCanvas?.valid && parsedViewingCanvas.config
    ? parsedViewingCanvas.config
    : null;

  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (musicTimerRef.current) clearInterval(musicTimerRef.current);
      if (musicCtxRef.current) {
        void musicCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const toggleCanvasMusic = () => {
    if (isPlayingMusic) {
      if (musicTimerRef.current) {
        clearInterval(musicTimerRef.current);
        musicTimerRef.current = null;
      }
      if (musicCtxRef.current) {
        void musicCtxRef.current.close().catch(() => {});
        musicCtxRef.current = null;
      }
      setIsPlayingMusic(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      musicCtxRef.current = ctx;
      const musicMeta = getCanvasMusicContent(resolvedCanvas);
      const freqs = MAQAM_SCALES[musicMeta.maqam]?.freqs ?? MAQAM_SCALES.lami.freqs;
      let step = 0;
      const playNote = () => {
        if (!musicCtxRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freqs[step % freqs.length]!;
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.46);
        step += 1;
      };
      playNote();
      musicTimerRef.current = setInterval(playNote, 520);
      setIsPlayingMusic(true);
    } catch {
      setIsPlayingMusic(false);
    }
  };

  // Check if a canvas block is visible
  const isBlockVisible = (type: string) => {
    if (!resolvedCanvas) return true;
    const block = resolvedCanvas.blocks.find((b) => b.type === type);
    return block ? block.visible : false;
  };

  const layout = resolvedCanvas?.layout ?? 'modern';
  const canvasAppearance = resolveCanvasAppearance(resolvedCanvas);
  const canvasLinks = extractCanvasLinks(resolvedCanvas);
  const canvasPinned = getCanvasPinnedContent(resolvedCanvas);
  const canvasMusic = getCanvasMusicContent(resolvedCanvas);
  const bodyBlockOrder = resolvedCanvas
    ? resolvedCanvas.blocks
        .filter((b) =>
          ['badges', 'music-widget', 'stats', 'pinned-post', 'links', 'shop-strip'].includes(b.type) &&
          b.visible
        )
        .map((b) => b.type)
    : ['stats'];

  const coverImageUrl = profileUser.coverUrl?.trim() ? profileUser.coverUrl : '';

  const joinLabel = (() => {
    if (!profileUser.createdAt) return null;
    const parsed = new Date(profileUser.createdAt);
    if (Number.isNaN(parsed.getTime())) return null;
    const month = IRAQI_MONTHS[parsed.getMonth()] ?? IRAQI_MONTHS[0];
    const yr =
      numeralSystem === 'arabic-indic'
        ? toArabicIndicDigits(parsed.getFullYear())
        : String(parsed.getFullYear());
    return `انضم في ${month} ${yr}`;
  })();

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!requireAuthForWrite()) return;
    setPendingCrop({ file, target: 'cover' });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!requireAuthForWrite()) return;
    setPendingCrop({ file, target: 'avatar' });
  };

  const handleConfirmCrop = async (croppedFile: File) => {
    if (!pendingCrop) return;
    const target = pendingCrop.target;
    if (target === 'cover') {
      setIsUploadingCover(true);
      try {
        await updateCurrentUser({}, { coverFile: croppedFile });
        setPendingCrop(null);
      } finally {
        setIsUploadingCover(false);
      }
    } else {
      setIsUploadingAvatar(true);
      try {
        await updateCurrentUser({}, { avatarFile: croppedFile });
        setPendingCrop(null);
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  return (
    <div
      style={canvasAppearance.style}
      data-canvas-preset={resolvedCanvas?.theme.preset ?? 'default'}
      data-canvas-accent={resolvedCanvas?.theme.accent ?? 'default'}
      data-canvas-surface={canvasAppearance.effects.surfaceStyle}
      data-canvas-backdrop={canvasAppearance.effects.backdropMode}
      data-canvas-frame={canvasAppearance.effects.avatarFrame}
      data-canvas-grid={canvasAppearance.effects.gridStyle}
      className={`w-full max-w-3xl mx-auto flex flex-col pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12 min-h-[calc(100vh-var(--header-h))] border-x transition-colors duration-300 ${canvasAppearance.containerClass}`}
    >
      {/* Active Profile Canvas Status Banner */}
      {activeCanvasConfig && isOwnProfile && (
        <div className="px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-bold text-[var(--text)]">
              تصميم كانفاس نشط: {activeCanvasConfig.name}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
              ({activeCanvasConfig.layout} · {activeCanvasConfig.theme.preset} · {activeCanvasConfig.theme.accent})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentRoute('canvas')}
              className="text-xs font-bold text-[var(--primary-text)] hover:underline flex items-center gap-1 px-2 py-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تعديل في Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCanvasConfig(null)}
              className="text-xs text-[var(--text-muted)] hover:text-rose-500 flex items-center gap-1 px-2 py-1"
              title="العودة للتصميم الافتراضي"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Cover Image Block */}
      {isBlockVisible('cover') && (
        <div
          style={!coverImageUrl && resolvedCanvas ? { background: 'var(--cover-bg)' } : undefined}
          className={`relative w-full ${canvasAppearance.coverAspectClass} bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] overflow-hidden`}
        >
          {coverImageUrl && (
            <SmartImage src={coverImageUrl} alt="صورة الغلاف" containerClassName="w-full h-full" loading="eager" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

          {isOwnProfile && (!serverOnline || isAuthenticated) && (
            <label className="absolute bottom-3 end-3 px-2.5 py-1.5 rounded-xl bg-black/60 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-black/80 transition-colors backdrop-blur-sm">
              <Camera className="w-3.5 h-3.5" />
              <span>{isUploadingCover ? 'جاري الرفع...' : 'تغيير الغلاف'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                onChange={handleCoverUpload}
                disabled={isUploadingCover}
                data-testid="tw-profile-cover-input"
                aria-label="تغيير صورة الغلاف"
                className="sr-only"
              />
            </label>
          )}
        </div>
      )}

      {/* 2. Profile Details & Header */}
      <div
        className={`${canvasAppearance.isCompact ? 'px-3 pb-3' : 'px-4 pb-4'} border-b border-[var(--border)] ${
          layout === 'editorial' ? 'text-center' : ''
        }`}
      >
        {/* Avatar & Action Buttons */}
        <div
          className={`flex ${
            layout === 'editorial'
              ? `flex-col items-center ${isBlockVisible('cover') ? '-mt-14 sm:-mt-16' : 'mt-4'} gap-3`
              : `flex-wrap justify-between items-end gap-2 ${isBlockVisible('cover') ? 'mt-2' : 'mt-4'} mb-3`
          }`}
        >
          <div
            className={`relative z-10 inline-flex shrink-0 ${
              layout !== 'editorial' && isBlockVisible('cover') ? '-mt-14 sm:-mt-16' : ''
            }`}
          >
            <div
              className={`inline-flex shrink-0 ${canvasAppearance.avatarFrameVisuals.wrapperClass}`}
              style={canvasAppearance.avatarFrameVisuals.wrapperStyle}
            >
              <Avatar
                src={profileUser.avatarUrl}
                name={profileUser.displayName}
                size={layout === 'editorial' ? 110 : 96}
                isVerified={profileUser.isVerified}
                verifiedKind={profileUser.verifiedKind}
                shape={canvasAppearance.avatarFrameVisuals.isSquircle ? 'squircle' : 'circle'}
                className={
                  canvasAppearance.effects.avatarFrame === 'none'
                    ? 'ring-4 ring-[var(--surface)] shadow-lg'
                    : 'shadow-md'
                }
                testId="tw-profile-avatar"
              />
            </div>
            {isOwnProfile && (!serverOnline || isAuthenticated) && (
              <label
                data-testid="tw-profile-avatar-upload"
                title={isUploadingAvatar ? 'جاري رفع الصورة...' : 'تغيير الصورة الشخصية'}
                aria-label="تغيير الصورة الشخصية"
                className={`absolute bottom-0 start-0 w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] ring-2 ring-[var(--surface)] flex items-center justify-center shadow-md cursor-pointer hover:opacity-95 transition-opacity ${
                  isUploadingAvatar ? 'opacity-70 cursor-wait' : ''
                }`}
              >
                <Camera className={`w-4 h-4 ${isUploadingAvatar ? 'animate-pulse' : ''}`} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                  data-testid="tw-profile-avatar-input"
                  aria-label="اختيار الصورة الشخصية"
                  className="sr-only"
                />
              </label>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isOwnProfile ? (
              !(serverOnline && !isAuthenticated) && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentRoute('canvas')}
                    className="h-9 px-3 text-xs gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>صمّم ملفك (Canvas)</span>
                  </Button>

                  <Button
                    variant="secondary"
                    data-testid="tw-profile-edit-button"
                    onClick={() => setCurrentRoute('settings')}
                    className="h-9 px-3 text-xs"
                  >
                    تعديل الملف
                  </Button>
                </>
              )
            ) : (
              <>
                <Button
                  variant={profileUser.isFollowing ? 'secondary' : 'primary'}
                  onClick={() => toggleFollowUser(profileUser.id)}
                  className="h-9 px-4 text-xs font-bold"
                >
                  {profileUser.isFollowing ? 'إلغاء المتابعة' : 'متابعة'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => startChatWithUser(profileUser)}
                  className="h-9 px-3 text-xs font-bold gap-1.5"
                >
                  <span>مراسلة</span>
                </Button>

                <button
                  type="button"
                  onClick={() => toggleCloseFriend(profileUser.id)}
                  className={`h-9 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors ${
                    profileUser.isCloseFriend
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                  title={profileUser.isCloseFriend ? 'إزالة من الأصدقاء المقرّبين' : 'إضافة للأصدقاء المقرّبين'}
                >
                  <Star className={`w-3.5 h-3.5 ${profileUser.isCloseFriend ? 'fill-current' : ''}`} />
                  <span className="hidden sm:inline">{profileUser.isCloseFriend ? 'مقرّب' : 'مقرّب؟'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openShareModal(`الملف الشخصي لـ ${profileUser.displayName}`, window.location.href)
                  }
                  className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] active:scale-95"
                  aria-label="مشاركة الملف"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => openReportModal('user', profileUser.displayName, profileUser.id)}
                  className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] active:scale-95"
                  aria-label="الإبلاغ عن الحساب"
                  title="الإبلاغ"
                >
                  <Flag className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => blockUser(profileUser.id)}
                  className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] active:scale-95"
                  aria-label="حظر الحساب"
                  title="حظر"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Guest prompt banner */}
        {isOwnProfile && serverOnline && !isAuthenticated && (
          <div className="mb-3 p-3.5 rounded-2xl bg-[var(--primary-tint)] border border-[var(--primary)]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--text)]">
              أنت تتصفح كزائر. سجّل برقم هاتفك العراقي لحفظ منشوراتك وتخصيص ملفك الشخصي.
            </span>
            <Button
              type="button"
              data-testid="tw-profile-login-btn"
              onClick={() => setCurrentRoute('auth')}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول أو إنشاء حساب</span>
            </Button>
          </div>
        )}

        {/* Identity Block */}
        {isBlockVisible('identity') && (
          <div className={`flex flex-col gap-1 ${layout === 'editorial' ? 'items-center mt-2' : ''}`}>
            <div className={`flex flex-wrap items-center gap-1.5 ${layout === 'editorial' ? 'justify-center' : ''}`}>
              <h1 className="text-xl font-bold text-[var(--text)]">{profileUser.displayName}</h1>
              <VerifiedBadge kind={profileUser.verifiedKind} size={18} />
              {canvasAppearance.effects.statusBadge && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] border border-[var(--primary)]/25 text-[11px] font-bold">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>{canvasAppearance.effects.statusBadge}</span>
                </span>
              )}
            </div>

            <span
              className={`text-xs text-[var(--text-muted)] font-mono ${layout === 'editorial' ? '' : 'self-start'}`}
              dir="ltr"
            >
              @{profileUser.username}
            </span>
          </div>
        )}

        {/* Bio Block */}
        {isBlockVisible('bio') && (
          <div className={`mt-2 ${layout === 'editorial' ? 'max-w-md mx-auto italic' : ''}`}>
            <p className="text-sm text-[var(--text)] leading-relaxed">{profileUser.bio}</p>

            {/* Location & Join date */}
            <div
              className={`flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] mt-1.5 ${
                layout === 'editorial' ? 'justify-center' : ''
              }`}
            >
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>
                  {profileUser.province} {profileUser.city ? `— ${profileUser.city}` : ''}
                </span>
              </div>

              {joinLabel && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{joinLabel}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ordered Customizable Canvas Body Blocks */}
        <div className="flex flex-col gap-3 mt-3">
          {bodyBlockOrder.map((blockType) => {
            if (blockType === 'badges') {
              return (
                <div
                  key="badges"
                  className={`flex flex-wrap items-center gap-2 ${layout === 'editorial' ? 'justify-center' : ''}`}
                >
                  {profileUser.isVerified && (
                    <span className="px-2.5 py-1 rounded-full bg-[var(--primary-tint)] border border-[var(--primary)]/30 text-[11px] font-bold text-[var(--primary-text)] flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      <span>موثّق رسمياً في العراق</span>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-bold text-[var(--text)] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>{profileUser.province || 'العراق'}</span>
                  </span>
                </div>
              );
            }

            if (blockType === 'music-widget' && resolvedCanvas) {
              return (
                <div
                  key="music-widget"
                  className={`w-full p-3 rounded-2xl ${canvasAppearance.cardClass} flex items-center justify-between select-none ${
                    layout === 'editorial' ? 'max-w-lg mx-auto' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center ${
                        isPlayingMusic ? 'animate-pulse' : ''
                      }`}
                    >
                      <Music className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-start">
                      <span className="text-xs font-bold text-[var(--text)]">{canvasMusic.trackTitle}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {isPlayingMusic ? 'قيد التشغيل...' : MAQAM_SCALES[canvasMusic.maqam].label}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleCanvasMusic}
                    className="p-2 rounded-xl text-[var(--primary-text)] bg-[var(--primary-tint)] hover:opacity-90"
                    aria-label={isPlayingMusic ? 'إيقاف الصوت' : 'تشغيل'}
                  >
                    {isPlayingMusic ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              );
            }

            if (blockType === 'stats') {
              return (
                <div
                  key="stats"
                  className={`flex items-center gap-6 pt-3 border-t border-[var(--border)] select-none ${
                    layout === 'editorial' ? 'justify-center' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('posts')}
                    className="flex items-center gap-1.5 hover:opacity-80"
                  >
                    <span className="text-sm font-bold text-[var(--text)]">
                      {formatCompactCount(profileUser.postsCount, numeralSystem)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">منشورات</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[var(--text)]">
                      {formatCompactCount(profileUser.followersCount, numeralSystem)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">متابعون</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[var(--text)]">
                      {formatCompactCount(profileUser.followingCount, numeralSystem)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">يتابع</span>
                  </div>
                </div>
              );
            }

            if (blockType === 'pinned-post' && resolvedCanvas) {
              return (
                <div
                  key="pinned-post"
                  className={`p-3.5 rounded-2xl ${canvasAppearance.cardClass} border-[var(--primary)]/30 flex items-start gap-3 text-start`}
                >
                  <div className="p-2 rounded-xl bg-[var(--primary-tint)] text-[var(--primary-text)] shrink-0">
                    <Pin className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--primary-text)]">{canvasPinned.badge}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">· {profileUser.province}</span>
                    </div>
                    <p className="text-xs text-[var(--text)] mt-1 leading-relaxed">
                      {canvasPinned.note || userPosts[0]?.text || `مرحباً بكم في ملف ${profileUser.displayName} على تواصل.`}
                    </p>
                  </div>
                </div>
              );
            }

            if (blockType === 'links' && resolvedCanvas && canvasLinks.length > 0) {
              return (
                <div
                  key="links"
                  className={`flex flex-wrap gap-2 ${layout === 'editorial' ? 'justify-center' : ''}`}
                >
                  {canvasLinks.map((lnk, idx) => (
                    <a
                      key={`${lnk.url}-${idx}`}
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary-tint)] text-[var(--primary-text)] border border-[var(--primary)]/25 text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>{lnk.title}</span>
                    </a>
                  ))}
                </div>
              );
            }

            if (blockType === 'shop-strip' && resolvedCanvas && profileUser.accountType === 'merchant') {
              return (
                <div
                  key="shop-strip"
                  className={`p-3.5 rounded-2xl ${canvasAppearance.cardClass} flex items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-xs font-bold text-[var(--text)]">متجر {profileUser.displayName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentRoute('market')}
                    className="text-xs font-bold text-[var(--primary-text)] hover:underline"
                  >
                    زيارة المتجر
                  </button>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* 3. SubBar Icon Tabs */}
      {isBlockVisible('posts-grid') && (
        <>
          <div className="flex items-center justify-around border-b border-[var(--border)] bg-[var(--surface)] sticky top-[var(--chrome-top)] md:top-0 z-10 transition-[top] duration-200 motion-reduce:transition-none select-none">
            {[
              { id: 'posts', label: 'المنشورات', icon: Grid },
              { id: 'reels', label: 'ريلز', icon: Film },
              { id: 'text', label: 'نصوص', icon: FileText },
              ...(isOwnProfile ? [{ id: 'saved', label: 'المحفوظات', icon: Bookmark }] : []),
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 h-12 flex items-center justify-center relative transition-colors ${
                    isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                  aria-label={tab.label}
                >
                  <Icon className="w-5 h-5" />
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-4 h-0.5 rounded-full bg-[var(--primary)]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* 4. Tab Content */}
          <div className="p-2">
            {activeTab === 'posts' && (
              mediaItems.length > 0 ? (
                canvasAppearance.effects.gridStyle === 'bento' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {mediaItems.map((media, i) => {
                      const isHeroTile = i === 0 && mediaItems.length > 1;
                      return (
                        <button
                          key={`${media.postId}-${i}`}
                          type="button"
                          onClick={() => navigate(`/post/${media.postId}`)}
                          aria-label={media.postText?.slice(0, 60) || 'عرض المنشور'}
                          className={`overflow-hidden hover:opacity-95 active:scale-98 transition-all rounded-2xl ${canvasAppearance.cardClass} ${
                            isHeroTile ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'
                          }`}
                        >
                          {isVideoSource(media.url) ? (
                            <video
                              src={media.url}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <SmartImage
                              src={media.url}
                              alt={media.postText?.slice(0, 60) || 'منشور'}
                              containerClassName="w-full h-full"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : canvasAppearance.effects.gridStyle === 'masonry-cards' ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {mediaItems.map((media, i) => (
                      <button
                        key={`${media.postId}-${i}`}
                        type="button"
                        onClick={() => navigate(`/post/${media.postId}`)}
                        aria-label={media.postText?.slice(0, 60) || 'عرض المنشور'}
                        className={`flex flex-col overflow-hidden text-start rounded-2xl ${canvasAppearance.cardClass} hover:opacity-95 active:scale-98 transition-all`}
                      >
                        <div className="w-full aspect-[4/3] overflow-hidden bg-[var(--surface-2)]">
                          {isVideoSource(media.url) ? (
                            <video
                              src={media.url}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <SmartImage
                              src={media.url}
                              alt={media.postText?.slice(0, 60) || 'منشور'}
                              containerClassName="w-full h-full"
                            />
                          )}
                        </div>
                        {media.postText && (
                          <div className="px-2.5 py-2 text-[11px] text-[var(--text)] line-clamp-2 leading-relaxed">
                            {media.postText}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`grid ${
                      layout === 'showcase' ? 'grid-cols-2 sm:grid-cols-3 gap-2' : 'grid-cols-3 gap-1'
                    }`}
                  >
                    {mediaItems.map((media, i) => (
                      <button
                        key={`${media.postId}-${i}`}
                        type="button"
                        onClick={() => navigate(`/post/${media.postId}`)}
                        aria-label={media.postText?.slice(0, 60) || 'عرض المنشور'}
                        className="aspect-square bg-[var(--surface-2)] overflow-hidden hover:opacity-90 active:scale-98 transition-all rounded-lg"
                      >
                        {isVideoSource(media.url) ? (
                          <video
                            src={media.url}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <SmartImage
                            src={media.url}
                            alt={media.postText?.slice(0, 60) || 'منشور'}
                            containerClassName="w-full h-full"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-muted)]">
                    لا توجد منشورات مصوّرة بعد
                  </span>
                </div>
              )
            )}

            {activeTab === 'text' && (
              <div className="flex flex-col gap-2 p-2">
                {userPosts.filter((p) => p.kind === 'text').length > 0 ? (
                  userPosts
                    .filter((p) => p.kind === 'text')
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/post/${p.id}`)}
                        className="w-full text-start p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--primary)]/40 transition-colors text-sm"
                      >
                        <p className="leading-relaxed">{p.text}</p>
                      </button>
                    ))
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-muted)]">
                      لا توجد منشورات نصية بعد
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reels' && (() => {
              const userReels = userPosts.filter((p) => p.kind === 'reel' || p.kind === 'video');
              if (userReels.length === 0) {
                return (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-muted)]">
                      لا توجد مقاطع ريلز بعد
                    </span>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-3 gap-1">
                  {userReels.map((reel) => {
                    const thumbUrl = reel.media?.[0]?.url;
                    const isVid = Boolean(thumbUrl && isVideoSource(thumbUrl));
                    return (
                      <button
                        key={reel.id}
                        type="button"
                        onClick={() => setCurrentRoute('reels')}
                        className="relative aspect-[9/16] bg-black overflow-hidden rounded-lg group text-start"
                      >
                        {thumbUrl ? (
                          isVid ? (
                            <video
                              src={thumbUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <SmartImage
                              src={thumbUrl}
                              alt={reel.text || 'ريلز'}
                              containerClassName="w-full h-full"
                            />
                          )
                        ) : null}
                        <span className="absolute top-2 end-2 p-1 rounded-full bg-black/50 text-white">
                          <Film className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {activeTab === 'saved' && (() => {
              const savedUserPosts = posts.filter((p) => p.isSaved);
              if (savedUserPosts.length === 0) {
                return (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-muted)]">
                      لا توجد عناصر محفوظة هنا بعد
                    </span>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-3 gap-1">
                  {savedUserPosts.map((p) => {
                    const url = p.media?.[0]?.url;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/post/${p.id}`)}
                        aria-label={p.text?.slice(0, 60) || 'عرض المنشور المحفوظ'}
                        className="aspect-square bg-[var(--surface-2)] overflow-hidden rounded-lg text-start hover:opacity-90 transition-opacity"
                      >
                        {url ? (
                          isVideoSource(url) ? (
                            <video src={url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                          ) : (
                            <SmartImage src={url} alt={p.text || 'محفوظ'} containerClassName="w-full h-full" />
                          )
                        ) : (
                          <div className="p-2 text-xs text-[var(--text)] line-clamp-4">{p.text}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}
      <ImageCropModal
        isOpen={Boolean(pendingCrop)}
        file={pendingCrop?.file ?? null}
        shape={pendingCrop?.target === 'cover' ? 'rect' : 'circle'}
        aspectRatio={
          pendingCrop?.target === 'cover' ? (layout === 'editorial' ? 2.4 : 3) : 1
        }
        outputWidth={pendingCrop?.target === 'cover' ? 1500 : 1024}
        outputHeight={
          pendingCrop?.target === 'cover' ? (layout === 'editorial' ? 625 : 500) : 1024
        }
        title={
          pendingCrop?.target === 'cover'
            ? 'تحديد قص صورة الغلاف'
            : 'تحديد قص الصورة الشخصية'
        }
        onCancel={() => setPendingCrop(null)}
        onConfirm={handleConfirmCrop}
      />
    </div>
  );
}
