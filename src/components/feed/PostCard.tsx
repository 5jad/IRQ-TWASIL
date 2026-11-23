import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Post } from '../../types';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { SmartImage } from '../ui/SmartImage';
import {
  Heart,
  MessageCircle,
  Repeat,
  Send,
  Bookmark,
  MoreHorizontal,
  ShoppingBag,
  Trash2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { formatCompactCount, formatRelativeTime, formatPriceIQD } from '../../lib/formatters';
import { isVideoSource } from '../../lib/apiHelpers';

export interface PostCardProps {
  post: Post;
  testId?: string;
}

export function PostCard({ post, testId }: PostCardProps) {
  const navigate = useNavigate();
  const {
    currentUser,
    toggleLikePost,
    toggleRepostPost,
    toggleSavePost,
    deletePost,
    votePoll,
    numeralSystem,
    setCurrentRoute,
    openShareModal,
    openReportModal,
    setActivePostComments,
    setViewingUser,
  } = useApp();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [showTaggedSheet, setShowTaggedSheet] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const lastTapRef = useRef<number>(0);

  const hasMedia = post.media && post.media.length > 0;
  const isCarousel = post.media && post.media.length > 1;
  const postShareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : `/post/${post.id}`;

  // Handle double-tap to like with burst (skips interactive video/button targets)
  const handleMediaTouch = (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('video, button, a')) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.isLiked) {
        toggleLikePost(post.id);
      }
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 700);
    }
    lastTapRef.current = now;
  };

  return (
    <article
      data-testid={testId ?? `tw-post-${post.id}`}
      className="bg-[var(--surface)] border-b-8 md:border md:border-b md:rounded-2xl border-[var(--border)] md:my-4 overflow-hidden"
    >
      {/* 1. Header */}
      <div className="h-14 px-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setViewingUser(post.author);
            setCurrentRoute('profile');
          }}
          className="flex items-center gap-2.5 text-start select-none"
        >
          <Avatar
            src={post.author.avatarUrl}
            name={post.author.displayName}
            size={38}
            hasStory={post.author.hasActiveStory}
            hasUnseenStory={post.author.hasUnseenStory}
            isMerchant={post.author.accountType === 'merchant'}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-[var(--text)] hover:underline">
                {post.author.displayName}
              </span>
              <VerifiedBadge kind={post.author.verifiedKind} size={14} />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              {post.isSponsored ? (
                <span className="font-semibold text-[var(--accent-text)]">إعلان ممول</span>
              ) : post.audioTrack ? (
                <span className="truncate max-w-[180px]">{post.audioTrack}</span>
              ) : post.location ? (
                <span className="truncate max-w-[180px]">{post.location}</span>
              ) : (
                <span>{formatRelativeTime(post.createdAt, undefined, numeralSystem)}</span>
              )}
            </div>
          </div>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowActionMenu(!showActionMenu)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] active:scale-95"
            aria-label="المزيد من الخيارات"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showActionMenu && (
            <div
              className="absolute end-0 top-10 w-44 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl py-1.5 z-30 select-none animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  openShareModal(post.text.slice(0, 50) || 'منشور على تواصل', postShareUrl);
                }}
                className="w-full px-3.5 py-2 text-start text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2"
              >
                <span>مشاركة المنشور</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowActionMenu(false);
                  openReportModal('post', `منشور من ${post.author.displayName}`, post.id);
                }}
                className="w-full px-3.5 py-2 text-start text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2"
              >
                <span>إبلاغ عن محتوى أو ابتزاز</span>
              </button>

              {post.author.id === currentUser.id && (
                <button
                  type="button"
                  onClick={() => {
                    setShowActionMenu(false);
                    void deletePost(post.id);
                  }}
                  className="w-full px-3.5 py-2 text-start text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-tint)] flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المنشور</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Media Area (Edge-to-edge on mobile) */}
      {hasMedia && (
        <div
          className="relative w-full bg-black select-none overflow-hidden aspect-[4/5] max-h-[580px] flex items-center justify-center"
          onClick={handleMediaTouch}
        >
          {post.media?.map((m, idx) =>
            isVideoSource(m.url) || (post.kind === 'video' && m.url.startsWith('blob:')) ? (
              <video
                key={idx}
                src={m.url}
                controls
                playsInline
                preload="metadata"
                className={`w-full h-full object-cover bg-black ${
                  idx === currentSlideIndex ? 'block' : 'hidden'
                }`}
              />
            ) : (
              <SmartImage
                key={idx}
                src={m.url}
                alt={m.alt ?? 'وسائط المنشور'}
                fallbackText={post.author.displayName}
                containerClassName={`w-full h-full ${
                  idx === currentSlideIndex ? 'block' : 'hidden'
                }`}
              />
            )
          )}

          {/* Carousel Slide Counter Badge + Prev/Next controls */}
          {isCarousel && post.media && (
            <>
              <div className="absolute top-3 end-3 px-2.5 py-0.5 rounded-full bg-[var(--overlay)] backdrop-blur-md text-white text-xs font-bold pointer-events-none" dir="ltr">
                {currentSlideIndex + 1} / {post.media.length}
              </div>
              {currentSlideIndex > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlideIndex((idx) => Math.max(0, idx - 1));
                  }}
                  aria-label="الشريحة السابقة"
                  className="absolute top-1/2 -translate-y-1/2 start-2 w-9 h-9 rounded-full bg-[var(--overlay)] text-white flex items-center justify-center shadow-md"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              {currentSlideIndex < post.media.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlideIndex((idx) => Math.min((post.media?.length ?? 1) - 1, idx + 1));
                  }}
                  aria-label="الشريحة التالية"
                  className="absolute top-1/2 -translate-y-1/2 end-2 w-9 h-9 rounded-full bg-[var(--overlay)] text-white flex items-center justify-center shadow-md"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
            </>
          )}

          {/* Tagged Products Bag Button */}
          {post.taggedProducts && post.taggedProducts.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTaggedSheet(!showTaggedSheet);
              }}
              className="absolute bottom-3 end-3 w-10 h-10 rounded-full bg-[var(--overlay)] backdrop-blur-md text-white flex items-center justify-center shadow-lg active:scale-95"
              aria-label="عرض المنتجات المرتبطة"
            >
              <ShoppingBag className="w-5 h-5" />
            </button>
          )}

          {/* Double-tap heart burst animation */}
          {showHeartBurst && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
              <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl" />
            </div>
          )}
        </div>
      )}

      {/* Carousel dots indicator */}
      {isCarousel && post.media && (
        <div className="flex items-center justify-center gap-1.5 py-2">
          {post.media.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlideIndex(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentSlideIndex
                  ? 'bg-[var(--primary)] w-3'
                  : 'bg-[var(--border)]'
              }`}
              aria-label={`شريحة ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Tagged Products Overlay Drawer */}
      {showTaggedSheet && post.taggedProducts && (
        <div className="p-3 bg-[var(--surface-2)] border-t border-[var(--border)] flex flex-col gap-2">
          <span className="text-xs font-bold text-[var(--accent)] flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>منتجات مميزة في هذه الصورة:</span>
          </span>
          {post.taggedProducts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[var(--text)]">{p.title}</span>
                <span className="text-xs font-bold text-[var(--accent-text)]">
                  {formatPriceIQD(p.priceIqd, numeralSystem)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentRoute('market')}
                className="px-3 py-1 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold hover:brightness-105 active:scale-95"
              >
                اطلب الآن
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 3. Action Row (44px min targets) */}
      <div className="h-12 px-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Like Button */}
          <button
            type="button"
            onClick={() => toggleLikePost(post.id)}
            className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            aria-label={post.isLiked ? 'إلغاء الإعجاب' : 'إعجاب'}
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                post.isLiked
                  ? 'text-[var(--danger)] fill-[var(--danger)]'
                  : 'text-[var(--text)]'
              }`}
            />
          </button>

          {/* Comment Button */}
          <button
            type="button"
            onClick={() => setActivePostComments(post)}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-[var(--text)] active:scale-90 transition-transform"
            aria-label="تعليق"
          >
            <MessageCircle className="w-6 h-6" />
          </button>

          {/* Repost Button */}
          <button
            type="button"
            onClick={() => toggleRepostPost(post.id)}
            className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            aria-label={post.isReposted ? 'إلغاء إعادة النشر' : 'إعادة نشر'}
          >
            <Repeat
              className={`w-6 h-6 transition-colors ${
                post.isReposted ? 'text-[var(--success)]' : 'text-[var(--text)]'
              }`}
            />
          </button>

          {/* Share Button (mirrored for RTL) */}
          <button
            type="button"
            onClick={() =>
              openShareModal(post.text.slice(0, 50) || 'منشور على تواصل', postShareUrl)
            }
            className="w-11 h-11 rounded-xl flex items-center justify-center text-[var(--text)] active:scale-90 transition-transform -scale-x-100"
            aria-label="مشاركة"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>

        {/* Save Bookmark */}
        <button
          type="button"
          onClick={() => toggleSavePost(post.id)}
          className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          aria-label={post.isSaved ? 'محفوظ' : 'حفظ'}
        >
          <Bookmark
            className={`w-6 h-6 transition-colors ${
              post.isSaved
                ? 'text-[var(--primary)] fill-[var(--primary)]'
                : 'text-[var(--text)]'
            }`}
          />
        </button>
      </div>

      {/* 4. Likes count line */}
      <div className="px-4 text-sm font-bold text-[var(--text)]">
        {formatCompactCount(post.likesCount, numeralSystem)} إعجاب
      </div>

      {/* 5. Caption text with clamp 3 lines */}
      <div className="px-4 py-1 text-sm text-[var(--text)] leading-relaxed">
        <button
          type="button"
          onClick={() => {
            setViewingUser(post.author);
            setCurrentRoute('profile');
          }}
          className="font-bold hover:underline me-1.5"
        >
          {post.author.displayName}
        </button>
        <span className={isCaptionExpanded ? '' : 'line-clamp-3 whitespace-pre-line'}>
          {post.text}
        </span>
        {post.text.length > 120 && !isCaptionExpanded && (
          <button
            type="button"
            onClick={() => setIsCaptionExpanded(true)}
            className="text-[var(--text-muted)] font-semibold text-xs ms-1 hover:underline"
          >
            المزيد
          </button>
        )}
      </div>

      {/* Poll Component (if present) */}
      {post.poll && (
        <div className="mx-4 my-2.5 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2">
          <span className="text-xs font-bold text-[var(--text)]">{post.poll.question}</span>
          <div className="flex flex-col gap-2">
            {post.poll.options.map((opt, i) => {
              const hasVoted = post.poll?.userVotedIndex !== undefined;
              const isUserChoice = post.poll?.userVotedIndex === i;
              const pct =
                post.poll && post.poll.totalVotes > 0
                  ? Math.round((opt.votes / post.poll.totalVotes) * 100)
                  : 0;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={hasVoted}
                  onClick={() => votePoll(post.id, i)}
                  className={`relative h-11 px-3.5 rounded-xl border border-[var(--border)] overflow-hidden flex items-center justify-between text-xs font-semibold transition-all ${
                    isUserChoice ? 'ring-2 ring-[var(--primary)]' : ''
                  }`}
                >
                  {hasVoted && (
                    <span
                      style={{ width: `${pct}%` }}
                      className="absolute inset-y-0 start-0 bg-[var(--primary-tint)] opacity-80"
                    />
                  )}
                  <span className="relative z-10 text-[var(--text)]">{opt.text}</span>
                  {hasVoted && (
                    <span className="relative z-10 font-bold text-[var(--text)]">
                      {pct}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {formatCompactCount(post.poll.totalVotes, numeralSystem)} صوت · ينتهي بعد ٤٨ ساعة
          </span>
        </div>
      )}

      {/* 6. Comments link */}
      {post.commentsCount > 0 && (
        <button
          type="button"
          onClick={() => setActivePostComments(post)}
          className="px-4 py-1 text-xs text-[var(--text-muted)] hover:underline block"
        >
          عرض كل {formatCompactCount(post.commentsCount, numeralSystem)} تعليق
        </button>
      )}

      {/* 7. Timestamp (clickable to /post/:id) */}
      <button
        type="button"
        onClick={() => navigate(`/post/${post.id}`)}
        className="px-4 pb-3 text-[11px] text-[var(--text-muted)] hover:underline block text-start"
      >
        {formatRelativeTime(post.createdAt, undefined, numeralSystem)}
        {post.repostsCount > 0 && ` · ${formatCompactCount(post.repostsCount, numeralSystem)} إعادة نشر`}
      </button>
    </article>
  );
}
