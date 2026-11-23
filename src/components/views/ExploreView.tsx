import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { SearchField } from '../ui/Input';
import { SmartImage } from '../ui/SmartImage';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { Film, ShoppingBag, Users as UsersIcon } from 'lucide-react';
import { isVideoSource } from '../../lib/apiHelpers';
import { arabicTextMatches } from '../../lib/arabicSearch';
import { apiFetch } from '../../lib/api';
import type { CommunityItem, Post, User } from '../../types';

export function ExploreView() {
  const navigate = useNavigate();
  const {
    posts,
    users,
    communities,
    currentUser,
    serverOnline,
    exploreQuery,
    setExploreQuery,
    setCurrentRoute,
    setViewingUser,
  } = useApp();
  const [activeTopic, setActiveTopic] = useState('الكل');
  const [serverResults, setServerResults] = useState<{
    users: User[];
    posts: Post[];
    communities: CommunityItem[];
  } | null>(null);

  const TOPICS = [
    { label: 'الكل', keywords: [] as string[] },
    { label: 'فن وعمارة', keywords: ['فن', 'عمارة', 'بغداد', 'تراث', 'متحف'] },
    { label: 'حرف تراثية', keywords: ['نحاس', 'سجاد', 'حرف', 'تراث', 'فضة', 'خزف'] },
    { label: 'تقنية', keywords: ['تقنية', 'برمجة', 'ذكاء', 'تطبيق', 'تطوير'] },
    { label: 'شعر وأدب', keywords: ['شعر', 'أدب', 'قصيدة', 'كتاب', 'المتنبي'] },
    { label: 'سياحة وأماكن', keywords: ['دجلة', 'بصرة', 'أربيل', 'سفر', 'سياحة', 'جبل'] },
    { label: 'طبخ عراقي', keywords: ['مسكوف', 'دولمة', 'كبة', 'شاي', 'طبخ', 'قهوة'] },
  ];

  const selectedTopicObj = TOPICS.find((t) => t.label === activeTopic) ?? TOPICS[0];
  const rawQuery = exploreQuery.trim();

  useEffect(() => {
    if (!rawQuery || !serverOnline) {
      setServerResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void apiFetch<{
        users: User[];
        posts: Post[];
        communities: CommunityItem[];
      }>(`/api/search?q=${encodeURIComponent(rawQuery)}`)
        .then((res) => {
          if (!cancelled) {
            setServerResults({
              users: res.users ?? [],
              posts: res.posts ?? [],
              communities: res.communities ?? [],
            });
          }
        })
        .catch(() => {
          if (!cancelled) setServerResults(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawQuery, serverOnline]);

  const mergedUsers = useMemo(() => {
    const byId = new Map<string, User>();
    for (const u of users) byId.set(u.id, u);
    if (serverResults?.users) {
      for (const u of serverResults.users) {
        if (!byId.has(u.id)) byId.set(u.id, u);
      }
    }
    return Array.from(byId.values());
  }, [users, serverResults]);

  const mergedCommunities = useMemo(() => {
    const byId = new Map<string, CommunityItem>();
    for (const c of communities) byId.set(c.id, c);
    if (serverResults?.communities) {
      for (const c of serverResults.communities) {
        if (!byId.has(c.id)) byId.set(c.id, c);
      }
    }
    return Array.from(byId.values());
  }, [communities, serverResults]);

  const mergedPosts = useMemo(() => {
    const byId = new Map<string, Post>();
    for (const p of posts) byId.set(p.id, p);
    if (serverResults?.posts) {
      for (const p of serverResults.posts) {
        if (!byId.has(p.id)) byId.set(p.id, p);
      }
    }
    return Array.from(byId.values());
  }, [posts, serverResults]);

  const matchedUsers = rawQuery
    ? mergedUsers.filter(
        (u) =>
          u.id !== currentUser.id &&
          arabicTextMatches(`${u.displayName} ${u.username} ${u.province}`, rawQuery)
      )
    : [];

  const matchedCommunities = rawQuery
    ? mergedCommunities.filter((c) =>
        arabicTextMatches(`${c.name} ${c.province} ${c.category ?? ''} ${c.description}`, rawQuery)
      )
    : [];

  const mediaPosts = mergedPosts.filter((p) => {
    if (!p.media || p.media.length === 0) return false;
    if (rawQuery) {
      const hay = `${p.text} ${p.author.displayName} ${p.author.username} ${p.location ?? ''}`;
      if (!arabicTextMatches(hay, rawQuery)) return false;
    }
    if (selectedTopicObj.keywords.length > 0) {
      const hay = `${p.text} ${p.location ?? ''}`;
      if (!selectedTopicObj.keywords.some((kw) => arabicTextMatches(hay, kw))) return false;
    }
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12">
      {/* Search Input */}
      <SearchField
        value={exploreQuery}
        onChange={(e) => setExploreQuery(e.target.value)}
        onClear={() => setExploreQuery('')}
        placeholder="ابحث عن حسابات، وسوم، مجتمعات، أو منتجات..."
        className="w-full"
      />

      {/* Topics */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 select-none">
        {TOPICS.map((topic) => (
          <button
            key={topic.label}
            type="button"
            onClick={() => setActiveTopic(topic.label)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
              activeTopic === topic.label
                ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]'
            }`}
          >
            {topic.label}
          </button>
        ))}
      </div>

      {/* Matched Users & Communities */}
      {matchedUsers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-bold text-[var(--text-muted)]">الحسابات</h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {matchedUsers.slice(0, 8).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setViewingUser(u);
                  setCurrentRoute('profile');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shrink-0 hover:border-[var(--primary)]"
              >
                <Avatar src={u.avatarUrl} name={u.displayName} size={32} />
                <div className="text-start">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-[var(--text)]">{u.displayName}</span>
                    <VerifiedBadge kind={u.verifiedKind} size={12} />
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]" dir="ltr">@{u.username}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedCommunities.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-bold text-[var(--text-muted)]">المجتمعات</h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {matchedCommunities.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCurrentRoute('communities')}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shrink-0 hover:border-[var(--primary)]"
              >
                <UsersIcon className="w-4 h-4 text-[var(--primary)]" />
                <span className="text-xs font-bold text-[var(--text)]">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid of media */}
      {mediaPosts.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-[var(--text-muted)]">
          <p className="text-sm font-bold text-[var(--text)]">
            {matchedUsers.length > 0 || matchedCommunities.length > 0
              ? 'لا توجد منشورات وسائط مطابقة'
              : 'لا توجد نتائج مطابقة'}
          </p>
          <p className="text-xs">جرّب تغيير كلمة البحث أو تصفح كل التصنيفات.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {mediaPosts.map((post, idx) => (
            <button
              key={post.id}
              type="button"
              onClick={() => navigate(`/post/${post.id}`)}
              className={`relative overflow-hidden bg-[var(--surface-2)] cursor-pointer group ${
                idx % 5 === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'
              } rounded-lg`}
            >
              {post.media?.[0]?.url && isVideoSource(post.media[0].url) ? (
                <video
                  src={post.media[0].url}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <SmartImage
                  src={post.media?.[0]?.url}
                  alt={post.text}
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}
              {(post.kind === 'video' || post.kind === 'reel') && (
                <Film className="absolute top-2 end-2 w-4 h-4 text-white drop-shadow-md" />
              )}
              {post.taggedProducts && post.taggedProducts.length > 0 && (
                <ShoppingBag className="absolute bottom-2 end-2 w-4 h-4 text-white drop-shadow-md" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
