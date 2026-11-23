import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { SmartImage } from '../ui/SmartImage';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Music,
  Volume2,
  VolumeX,
  Plus,
  Camera,
  Film,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { formatCompactCount } from '../../lib/formatters';
import { isVideoSource } from '../../lib/apiHelpers';

export function ReelsView() {
  const {
    posts,
    currentUser,
    numeralSystem,
    currentRoute,
    setCurrentRoute,
    setViewingUser,
    openCreate,
    setActiveLiveStream,
    setActivePostComments,
    toggleLikePost,
    toggleSavePost,
    toggleFollowUser,
    openShareModal,
  } = useApp();
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [mode, setMode] = useState<'reels' | 'video'>(currentRoute === 'video' ? 'video' : 'reels');

  const reelPosts = posts.filter((p) =>
    mode === 'video' ? p.kind === 'video' : p.kind === 'reel'
  );
  const safeIndex = reelPosts.length > 0 ? Math.min(activeReelIndex, reelPosts.length - 1) : 0;
  const reelPost = reelPosts[safeIndex];

  useEffect(() => {
    if (currentRoute === 'video') {
      setMode('video');
    } else if (currentRoute === 'reels') {
      setMode('reels');
    } else if (currentRoute === 'live') {
      setActiveLiveStream({
        id: 'live-1',
        title: 'بث مباشر على تواصل',
        host: reelPost?.author ?? currentUser,
        viewersCount: 0,
      });
    }
  }, [currentRoute, currentUser, reelPost?.author, setActiveLiveStream]);

  const handleOpenLive = () => {
    setActiveLiveStream({
      id: 'live-1',
      title: 'بث مباشر على تواصل',
      host: reelPost?.author ?? currentUser,
      viewersCount: 0,
    });
  };

  const mediaUrl = reelPost?.media?.[0]?.url;
  const mediaIsVideo = Boolean(mediaUrl && isVideoSource(mediaUrl));

  return (
    <div
      className="w-full h-[calc(100dvh-var(--header-h))] max-w-md mx-auto relative bg-black flex items-center justify-center overflow-hidden select-none"
      data-testid="tw-reels-view"
    >
      {/* Video / Background Media or Empty State */}
      {reelPost && mediaUrl ? (
        mediaIsVideo ? (
          <video
            key={reelPost.id}
            src={mediaUrl}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover"
            data-testid="tw-reel-video"
          />
        ) : (
          <SmartImage
            src={mediaUrl}
            alt={reelPost.text || 'ريلز'}
            containerClassName="w-full h-full"
            className="w-full h-full object-cover"
          />
        )
      ) : (
        <div className="px-6 text-center flex flex-col items-center gap-3 text-white z-10">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <Film className="w-8 h-8 text-white/80" />
          </div>
          <p className="text-base font-bold">
            {mode === 'video' ? 'لا توجد فيديوهات مطوّلة بعد' : 'لا توجد مقاطع ريلز بعد'}
          </p>
          <p className="text-xs text-white/70 max-w-xs">
            {mode === 'video'
              ? 'ارفع فيديو من صفحة الإنشاء ليظهر في قسم الفيديو المطوّل.'
              : 'انشر أول مقطع ريلز بالصوت والمؤثرات ليظهر هنا وفي ملفك الشخصي.'}
          </p>
          <button
            type="button"
            onClick={() => openCreate(mode === 'video' ? 'post' : 'reel')}
            className="mt-1 px-5 h-10 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>{mode === 'video' ? 'رفع فيديو' : 'إنشاء ريلز'}</span>
          </button>
        </div>
      )}

      {/* Scrim Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

      {/* Top Controls: Segmented 'ريلز | مباشر | فيديو مطول' */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 text-sm font-bold text-white drop-shadow-md">
          <button
            type="button"
            onClick={() => setMode('reels')}
            className={`${
              mode === 'reels' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] pb-0.5' : 'opacity-70'
            }`}
          >
            ريلز
          </button>
          <button
            type="button"
            onClick={handleOpenLive}
            className="opacity-70 hover:opacity-100 flex items-center gap-1"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--live)] animate-pulse" />
            <span>مباشر</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('video')}
            className={`${
              mode === 'video' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] pb-0.5' : 'opacity-70'
            }`}
          >
            فيديو مطول
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="tw-reels-create-button"
            onClick={() => openCreate('reel')}
            className="w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center active:scale-95"
            aria-label="إنشاء ريلز"
          >
            <Camera className="w-5 h-5" />
          </button>

          {reelPost && (
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center"
              aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Multi-reel Prev/Next Navigation */}
      {reelPosts.length > 1 && (
        <div className="absolute top-1/2 -translate-y-1/2 start-3 flex flex-col gap-2 z-10">
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => setActiveReelIndex((i) => Math.max(0, i - 1))}
            aria-label="الريلز السابق"
            className="w-9 h-9 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center disabled:opacity-30"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={safeIndex >= reelPosts.length - 1}
            onClick={() => setActiveReelIndex((i) => Math.min(reelPosts.length - 1, i + 1))}
            aria-label="الريلز التالي"
            className="w-9 h-9 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center disabled:opacity-30"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {reelPost && (
        <>
          {/* Action Rail (End side) */}
          <div className="absolute bottom-[104px] md:bottom-20 end-3 flex flex-col items-center gap-4 z-10 text-white">
            {/* Creator Avatar with follow + badge */}
            <div className="relative">
              <button
                type="button"
                aria-label={`ملف ${reelPost.author.displayName}`}
                onClick={() => {
                  setViewingUser(reelPost.author);
                  setCurrentRoute('profile');
                }}
                className="rounded-full"
              >
                <Avatar
                  src={reelPost.author.avatarUrl}
                  name={reelPost.author.displayName}
                  size={46}
                  className="ring-2 ring-white"
                />
              </button>
              {reelPost.author.id !== currentUser.id && !reelPost.author.isFollowing && (
                <button
                  type="button"
                  onClick={() => toggleFollowUser(reelPost.author.id)}
                  className="absolute -bottom-1 start-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shadow-xs"
                  aria-label="متابعة"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
              )}
            </div>

            {/* Like Button */}
            <button
              type="button"
              onClick={() => toggleLikePost(reelPost.id)}
              className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
              aria-label="إعجاب"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                <Heart
                  className={`w-6 h-6 ${reelPost.isLiked ? 'text-[var(--danger)] fill-[var(--danger)]' : 'text-white'}`}
                />
              </div>
              <span className="text-xs font-bold drop-shadow-md">
                {formatCompactCount(reelPost.likesCount, numeralSystem)}
              </span>
            </button>

            {/* Comment Button */}
            <button
              type="button"
              onClick={() => setActivePostComments(reelPost)}
              className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
              aria-label="عرض التعليقات"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-bold drop-shadow-md">
                {formatCompactCount(reelPost.commentsCount, numeralSystem)}
              </span>
            </button>

            {/* Share Button (mirrored) */}
            <button
              type="button"
              onClick={() =>
                openShareModal(
                  reelPost.text.slice(0, 50) || 'ريلز على تواصل',
                  `${window.location.origin}/post/${reelPost.id}`
                )
              }
              className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
              aria-label="مشاركة"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center -scale-x-100">
                <Send className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-bold drop-shadow-md">مشاركة</span>
            </button>

            {/* Save Bookmark */}
            <button
              type="button"
              onClick={() => toggleSavePost(reelPost.id)}
              aria-label="حفظ"
              className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                <Bookmark
                  className={`w-6 h-6 ${reelPost.isSaved ? 'text-[var(--primary)] fill-[var(--primary)]' : 'text-white'}`}
                />
              </div>
            </button>
          </div>

          {/* Bottom Creator Info & Caption */}
          <div className="absolute bottom-[96px] md:bottom-6 inset-x-4 flex flex-col gap-2 z-10 text-white pe-16">
            <button
              type="button"
              onClick={() => {
                setViewingUser(reelPost.author);
                setCurrentRoute('profile');
              }}
              className="flex items-center gap-1.5 w-fit text-start"
            >
              <span className="text-sm font-bold drop-shadow-md">{reelPost.author.displayName}</span>
              <VerifiedBadge kind={reelPost.author.verifiedKind} size={14} />
            </button>

            {reelPost.text && (
              <p className="text-xs line-clamp-2 drop-shadow-md leading-relaxed">{reelPost.text}</p>
            )}

            {/* Audio Track */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
              <Music className="w-3.5 h-3.5 animate-pulse" />
              <span className="truncate">{reelPost.audioTrack ?? 'الصوت الأصلي — تواصل'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
