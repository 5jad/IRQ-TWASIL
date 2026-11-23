import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StoriesRow } from '../feed/StoriesRow';
import { PostCard } from '../feed/PostCard';

export function HomeView() {
  const {
    posts,
    currentUser,
    postsHasMore,
    isLoadingMorePosts,
    loadMorePosts,
  } = useApp();
  const [activeChip, setActiveChip] = useState<'all' | 'following' | 'province' | 'merchants'>('all');
  const myProvince = currentUser.province || 'بغداد';

  const CHIPS: { id: 'all' | 'following' | 'province' | 'merchants'; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'following', label: 'المتابَعون' },
    { id: 'province', label: `محافظتي (${myProvince})` },
    { id: 'merchants', label: 'تجار العراق' },
  ];

  const filteredPosts = posts.filter((p) => {
    if (activeChip === 'following') return p.author.isFollowing;
    if (activeChip === 'province') {
      return p.author.province === myProvince || (p.location?.includes(myProvince) ?? false);
    }
    if (activeChip === 'merchants') return p.author.accountType === 'merchant' || p.isSponsored;
    return true;
  });

  return (
    <div className="w-full flex flex-col pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12">
      {/* 1. Stories Row */}
      <StoriesRow />

      {/* 2. SubBar Filter Chips (Sticky) */}
      <div
        data-testid="tw-home-filter-chips"
        className="sticky top-[var(--strip-top)] md:top-0 z-10 transition-[top] duration-200 motion-reduce:transition-none bg-[var(--bg)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none select-none"
      >
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setActiveChip(chip.id)}
            className={`h-9 px-4 rounded-full text-xs font-semibold shrink-0 transition-colors ${
              activeChip === chip.id
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 3. Feed of PostCards */}
      <div className="w-full max-w-[640px] mx-auto flex flex-col md:px-3">
        {filteredPosts.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center gap-2 text-[var(--text-muted)]">
            <p className="text-sm font-bold text-[var(--text)]">لا توجد منشورات بعد</p>
            <p className="text-xs">ابدأ بنشر أول منشور ليظهر هنا.</p>
          </div>
        ) : (
          <>
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {postsHasMore && (
              <div className="py-4 px-4 flex justify-center">
                <button
                  type="button"
                  data-testid="tw-load-more-posts"
                  disabled={isLoadingMorePosts}
                  onClick={() => void loadMorePosts()}
                  className="h-10 px-6 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary-text)] disabled:opacity-60 transition-colors"
                >
                  {isLoadingMorePosts ? 'جارٍ تحميل المزيد...' : 'عرض المزيد من المنشورات'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
