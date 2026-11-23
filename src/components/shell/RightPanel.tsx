import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { SearchField } from '../ui/Input';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { FollowButton } from '../ui/Button';
import { TrendingUp, Store } from 'lucide-react';
import { SmartImage } from '../ui/SmartImage';
import { formatPriceIQD } from '../../lib/formatters';

export function RightPanel() {
  const navigate = useNavigate();
  const {
    users,
    posts,
    products,
    currentUser,
    toggleFollowUser,
    setViewingUser,
    setCurrentRoute,
    exploreQuery,
    setExploreQuery,
    setActiveProductDetail,
    numeralSystem,
  } = useApp();
  const isDevMode = Boolean(import.meta.env.DEV);

  const suggestedUsers = users
    .filter((u) => u.id !== currentUser.id && u.kind !== 'bot' && !u.handle?.endsWith('_bot'))
    .slice(0, 5);
  const featuredProduct = products[0];

  const tagCounts = new Map<string, number>();
  for (const post of posts) {
    const matches = post.text.match(/#([\p{L}\p{N}_]+)/gu) ?? [];
    for (const rawTag of matches) {
      const clean = rawTag.slice(1);
      tagCounts.set(clean, (tagCounts.get(clean) ?? 0) + 1);
    }
  }
  const liveTrends = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));

  return (
    <aside
      className="hidden lg:flex flex-col w-[340px] h-screen sticky top-0 py-6 px-4 gap-6 select-none shrink-0 overflow-y-auto"
      aria-label="الاستكشاف والتريندات"
    >
      {/* Search Bar */}
      <SearchField
        placeholder="ابحث في تواصل..."
        value={exploreQuery}
        onChange={(e) => setExploreQuery(e.target.value)}
        onClear={() => setExploreQuery('')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setCurrentRoute('explore');
          }
        }}
        className="w-full"
      />

      {/* Dynamic Iraqi Trends Section (only shown when posts have real hashtags) */}
      {liveTrends.length > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">الأكثر تداولاً</h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {liveTrends.map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => {
                  setExploreQuery(`#${t.tag}`);
                  setCurrentRoute('explore');
                }}
                className="flex flex-col text-start cursor-pointer group"
              >
                <span className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors">
                  #{t.tag}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">{t.count} منشور</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Accounts */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[var(--text)]">اقتراحات للمتابعة</h2>

        {suggestedUsers.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">لا توجد حسابات مقترحة حالياً</p>
        ) : (
          <div className="flex flex-col gap-3">
            {suggestedUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewingUser(user);
                    setCurrentRoute('profile');
                  }}
                  className="flex items-center gap-2 overflow-hidden text-start"
                >
                  <Avatar src={user.avatarUrl} name={user.displayName} size={36} />
                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-[var(--text)] truncate">
                        {user.displayName}
                      </span>
                      <VerifiedBadge kind={user.verifiedKind} size={13} />
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] truncate" dir="ltr">
                      @{user.username}
                    </span>
                  </div>
                </button>

                <FollowButton
                  isFollowing={!!user.isFollowing}
                  onToggle={() => toggleFollowUser(user.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Merchants Near You / Featured Product */}
      {featuredProduct && (
        <button
          type="button"
          onClick={() => {
            setActiveProductDetail(featuredProduct);
            setCurrentRoute('market');
          }}
          className="w-full text-start p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2.5 hover:border-[var(--accent)] transition-all group"
        >
          <div className="flex items-center justify-between w-full text-xs font-semibold text-[var(--accent-text)]">
            <span className="flex items-center gap-1">
              <Store className="w-3.5 h-3.5" />
              <span>متاجر بالقرب منك</span>
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">{featuredProduct.province}</span>
          </div>

          <div className="flex gap-2.5 items-center w-full">
            <SmartImage
              src={featuredProduct.imageUrl}
              alt={featuredProduct.title}
              containerClassName="w-14 h-14 rounded-xl shrink-0"
            />
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-[var(--text)] truncate group-hover:text-[var(--accent-text)]">
                {featuredProduct.title}
              </span>
              <span className="text-xs font-bold text-[var(--accent-text)]">
                {formatPriceIQD(featuredProduct.priceIqd, numeralSystem)}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] truncate">
                {featuredProduct.shopName}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Footer Info */}
      <footer className="text-[11px] text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1 px-1">
        {isDevMode && (
          <a href="/design" onClick={(e) => { e.preventDefault(); setCurrentRoute('gallery'); }} className="hover:underline">نظام التصميم</a>
        )}
        <a href="/settings/privacy" onClick={(e) => { e.preventDefault(); navigate('/settings/privacy'); }} className="hover:underline">الخصوصية والأمان</a>
        <a href="/settings/support" onClick={(e) => { e.preventDefault(); navigate('/settings/support'); }} className="hover:underline">الشروط</a>
        <a href="/market" onClick={(e) => { e.preventDefault(); setCurrentRoute('market'); }} className="hover:underline">دليل التجار</a>
        <span>© ٢٠٢٦ IRQ Digital</span>
      </footer>
    </aside>
  );
}
