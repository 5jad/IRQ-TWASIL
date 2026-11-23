import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bookmark, Plus, Lock, Trash2, Sparkles, Folder } from 'lucide-react';
import { PostCard } from '../feed/PostCard';
import { ProductCard } from '../market/ProductCard';
import { SmartImage } from '../ui/SmartImage';
import { formatCompactCount } from '../../lib/formatters';

export function SavedView() {
  const {
    posts,
    products,
    savedCollections,
    createSavedCollection,
    deleteSavedCollection,
    toggleSavedCollectionItem,
    activeCanvasConfig,
    setCurrentRoute,
    numeralSystem,
    setActiveProductDetail,
  } = useApp();
  const [activeCollectionId, setActiveCollectionId] = useState<string>('all');
  const [activeTypeTab, setActiveTypeTab] = useState<'all' | 'posts' | 'products' | 'canvas'>('all');
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const savedPosts = posts.filter((p) => p.isSaved);
  const savedProducts = products.filter((pr) => pr.isWishlisted);

  const activeCollection =
    activeCollectionId === 'all'
      ? null
      : savedCollections.find((c) => c.id === activeCollectionId) ?? null;

  const displayedPosts = activeCollection
    ? posts.filter((p) => activeCollection.postIds.includes(p.id))
    : savedPosts;

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const created = await createSavedCollection(newCollectionName.trim());
      if (created) {
        setNewCollectionName('');
        setIsAddingCollection(false);
        setActiveCollectionId(created.id);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 py-4 flex flex-col gap-5 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12"
      data-testid="tw-saved-view"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <Bookmark className="w-6 h-6 text-[var(--primary)] shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-[var(--text)]">المحفوظات</h1>
            <p className="text-xs text-[var(--text-muted)]">
              تنظيم المنشورات، السلع، والتصاميم التي حفظتها للرجوع إليها لاحقاً
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingCollection(!isAddingCollection)}
          className="h-10 px-3.5 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-bold text-xs flex items-center gap-1.5 shadow-xs hover:opacity-95 active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>مجموعة جديدة</span>
        </button>
      </div>

      {isAddingCollection && (
        <form
          onSubmit={(e) => void handleCreateCollection(e)}
          className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2"
        >
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="أدخل اسم المجموعة الجديدة..."
            className="flex-1 h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newCollectionName.trim() || isCreating}
            className="h-10 px-4 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold disabled:opacity-40"
          >
            {isCreating ? 'جاري الحفظ...' : 'إضافة'}
          </button>
          <button
            type="button"
            onClick={() => setIsAddingCollection(false)}
            className="h-10 px-3 rounded-xl border border-[var(--border)] text-xs text-[var(--text-muted)]"
          >
            إلغاء
          </button>
        </form>
      )}

      {/* Collections Row */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold text-[var(--text-muted)]">المجموعات</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 select-none">
          {/* Built-in All Saved Collection */}
          <button
            type="button"
            onClick={() => setActiveCollectionId('all')}
            className={`p-3 rounded-2xl border text-start transition-all flex items-center gap-3 ${
              activeCollectionId === 'all'
                ? 'border-[var(--primary)] bg-[var(--primary-tint)] shadow-xs'
                : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <div className="w-12 h-12 rounded-xl shrink-0 bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[var(--text)] truncate">كل المحفوظات</span>
                <Lock className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {formatCompactCount(savedPosts.length + savedProducts.length, numeralSystem)} عنصر
              </span>
            </div>
          </button>

          {/* DB Saved Collections */}
          {savedCollections.map((col) => {
            const firstPost = posts.find((p) => col.postIds.includes(p.id) && p.media?.[0]?.url);
            const coverUrl = firstPost?.media?.[0]?.url;
            return (
              <div
                key={col.id}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-2.5 ${
                  activeCollectionId === col.id
                    ? 'border-[var(--primary)] bg-[var(--primary-tint)] shadow-xs'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveCollectionId(col.id)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-start"
                >
                  {coverUrl ? (
                    <SmartImage
                      src={coverUrl}
                      alt={col.name}
                      containerClassName="w-12 h-12 rounded-xl shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl shrink-0 bg-[var(--surface-2)] text-[var(--primary)] flex items-center justify-center">
                      <Folder className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-bold text-[var(--text)] truncate">{col.name}</span>
                    <span className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {formatCompactCount(col.postIds.length, numeralSystem)} عنصر
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteSavedCollection(col.id);
                    if (activeCollectionId === col.id) setActiveCollectionId('all');
                  }}
                  aria-label={`حذف مجموعة ${col.name}`}
                  className="w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)] flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs by type */}
      <div className="flex items-center gap-2 overflow-x-auto select-none border-b border-[var(--border)] pb-2 scrollbar-none">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'posts', label: 'المنشورات' },
          { id: 'products', label: 'السلع والمنتجات' },
          { id: 'canvas', label: 'تصاميم الكانفاس' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTypeTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
              activeTypeTab === tab.id
                ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div className="flex flex-col gap-4">
        {(activeTypeTab === 'posts' || activeTypeTab === 'all') && (
          <div className="flex flex-col gap-3">
            {displayedPosts.length > 0 && (
              <span className="text-xs font-bold text-[var(--text-muted)]">
                {activeCollection ? `منشورات ${activeCollection.name}` : 'المنشورات المحفوظة'}
              </span>
            )}
            {displayedPosts.map((post) => (
              <div key={post.id} className="flex flex-col gap-1.5">
                <PostCard post={post} />
                {savedCollections.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap px-2">
                    <span className="text-[11px] text-[var(--text-muted)]">إضافة إلى مجموعة:</span>
                    {savedCollections.map((col) => {
                      const inCol = col.postIds.includes(post.id);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => void toggleSavedCollectionItem(col.id, post.id)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                            inCol
                              ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
                              : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--primary)]'
                          }`}
                        >
                          {inCol ? '✓ ' : '+ '}
                          {col.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(activeTypeTab === 'products' || activeTypeTab === 'all') && activeCollectionId === 'all' && (
          <div className="flex flex-col gap-3">
            {savedProducts.length > 0 && (
              <span className="text-xs font-bold text-[var(--text-muted)]">السلع المحفوظة</span>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {savedProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onClick={() => setActiveProductDetail(prod)}
                />
              ))}
            </div>
          </div>
        )}

        {activeTypeTab === 'canvas' && (
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">تصميم البروفايل النشط</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {activeCanvasConfig
                      ? `${activeCanvasConfig.name} (${activeCanvasConfig.layout} · ${activeCanvasConfig.theme.preset})`
                      : 'لم تقم بتفعيل قالب كانفاس مخصص بعد.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentRoute('canvas')}
                className="px-3.5 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold shrink-0"
              >
                فتح محرر Canvas
              </button>
            </div>
          </div>
        )}

        {activeTypeTab !== 'canvas' &&
          displayedPosts.length === 0 &&
          (activeTypeTab !== 'all' || savedProducts.length === 0 || activeCollectionId !== 'all') &&
          (activeTypeTab !== 'products' || savedProducts.length === 0) && (
            <div className="p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-center text-xs text-[var(--text-muted)]">
              لا توجد عناصر محفوظة في هذا القسم بعد. احفظ أي منشور أو سلعة لتظهر هنا.
            </div>
          )}
      </div>
    </div>
  );
}
