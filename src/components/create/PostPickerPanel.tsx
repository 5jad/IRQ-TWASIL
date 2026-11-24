import React, { useState, useRef } from 'react';
import {
  X,
  Maximize2,
  Infinity as InfinityIcon,
  Wand2,
  ChevronDown,
  LayoutGrid,
  Layers,
  Camera,
  ImagePlus,
  ChevronRight,
  MapPin,
  Globe,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IRAQI_LOCATIONS } from '../../lib/createUtils';
import { formatNumber } from '../../lib/formatters';
import { PostComposerPanel } from '../modals/GlobalComposerModal';

export interface PickedGalleryItem {
  id: string;
  url: string;
  persistUrl?: string;
  file?: File;
  type: 'image' | 'video';
  durationSec?: number;
}

export interface PostPickerPanelProps {
  items: PickedGalleryItem[];
  selectedIds: string[];
  isMultiSelect: boolean;
  onToggleMultiSelect: () => void;
  onAddFiles: (files: File[]) => void;
  onSelectTile: (id: string) => void;
  onOpenCamera: () => void;
  onOpenEffects: () => void;
  onOpenBoomerang: () => void;
  onOpenLayout: () => void;
  onClose: () => void;
  onPublished: () => void;
}

function formatVideoDuration(sec: number, numeralSystem: 'arabic-indic' | 'western'): string {
  const whole = Math.max(1, Math.round(sec));
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  const remStr = rem < 10 ? `${formatNumber(0, numeralSystem)}${formatNumber(rem, numeralSystem)}` : formatNumber(rem, numeralSystem);
  return `${formatNumber(mins, numeralSystem)}:${remStr}`;
}

export function PostPickerPanel({
  items,
  selectedIds,
  isMultiSelect,
  onToggleMultiSelect,
  onAddFiles,
  onSelectTile,
  onOpenCamera,
  onOpenEffects,
  onOpenBoomerang,
  onOpenLayout,
  onClose,
  onPublished,
}: PostPickerPanelProps) {
  const { createPost, numeralSystem, requireAuthForWrite } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [subView, setSubView] = useState<'picker' | 'composer' | 'edit'>('picker');
  const [fitCover, setFitCover] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [albumFilter, setAlbumFilter] = useState<'all' | 'image' | 'video'>('all');
  const [albumMenuOpen, setAlbumMenuOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Edit step state
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState<string>('');
  const [postAudience, setPostAudience] = useState<'everyone' | 'followers' | 'friends'>('everyone');

  const selectedItems = selectedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is PickedGalleryItem => Boolean(item));
  const primaryItem = selectedItems[0] ?? null;

  const filteredItems = items.filter((item) =>
    albumFilter === 'all' ? true : item.type === albumFilter
  );

  const albumLabel =
    albumFilter === 'image' ? 'الصور' : albumFilter === 'video' ? 'الفيديو' : 'الأخيرة';

  const handlePublish = async () => {
    if (selectedItems.length === 0 || isPublishing) return;
    if (!requireAuthForWrite()) return;
    setIsPublishing(true);
    try {
      const mediaSources = selectedItems.map((it) => it.file ?? (it.persistUrl || it.url));
      const trimmedCaption = caption.trim();
      const postText = trimmedCaption || (location ? `في ${location}` : 'منشور جديد');
      const ok = await createPost(postText, mediaSources, {
        location: location || undefined,
        audience: postAudience,
      });
      if (ok) {
        onPublished();
      }
    } finally {
      setIsPublishing(false);
    }
  };

  if (subView === 'composer') {
    return (
      <div
        data-testid="tw-create-post-panel"
        className="absolute inset-0 bottom-[76px] z-20 flex flex-col bg-[var(--surface)] overflow-y-auto"
      >
        <PostComposerPanel
          fullScreen
          onCancel={() => setSubView('picker')}
          onPublished={onPublished}
        />
      </div>
    );
  }

  if (subView === 'edit' && primaryItem) {
    return (
      <div
        data-testid="tw-post-edit-step"
        className="absolute inset-0 z-30 bg-[var(--cam-bg)] text-[var(--cam-text)] flex flex-col"
      >
        <header className="h-[56px] mt-[max(36px,calc(12px+var(--sat)))] px-2 flex items-center justify-between border-b border-white/10">
          <button
            type="button"
            onClick={() => setSubView('picker')}
            aria-label="رجوع"
            className="w-[44px] h-[44px] flex items-center justify-center text-[var(--cam-text)]"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <h1 className="text-[17px] font-bold">منشور جديد</h1>
          <button
            type="button"
            data-testid="tw-post-publish-btn"
            disabled={isPublishing}
            onClick={() => void handlePublish()}
            className="px-4 h-9 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-sm font-bold disabled:opacity-50"
          >
            {isPublishing ? 'جاري النشر...' : 'نشر'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedItems.map((it) => (
              <div
                key={it.id}
                className="w-32 h-40 rounded-2xl overflow-hidden bg-[var(--cam-surface)] shrink-0 border border-white/10"
              >
                {it.type === 'video' ? (
                  it.url ? <video src={it.url} muted playsInline className="w-full h-full object-contain bg-black" /> : null
                ) : it.url ? (
                  <img src={it.url} alt="معاينة المنشور" className="w-full h-full object-contain bg-black" />
                ) : null}
              </div>
            ))}
          </div>

          <textarea
            rows={4}
            data-testid="tw-post-caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="اكتب وصفاً لمنشورك..."
            className="w-full p-3 rounded-2xl bg-[var(--cam-surface)] border border-white/10 text-sm text-[var(--cam-text)] placeholder:text-[var(--cam-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[var(--cam-muted)] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[var(--primary)]" />
              <span>الموقع</span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {IRAQI_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation((prev) => (prev === loc ? '' : loc))}
                  className={`h-8 px-3 rounded-full text-xs font-semibold shrink-0 border ${
                    location === loc
                      ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
                      : 'bg-[var(--cam-surface)] text-[var(--cam-text)] border-white/10'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[var(--cam-muted)] flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[var(--primary)]" />
              <span>الجمهور</span>
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'everyone' as const, label: 'الجميع' },
                { id: 'followers' as const, label: 'المتابِعون' },
                { id: 'friends' as const, label: 'الأصدقاء' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPostAudience(opt.id)}
                  className={`h-10 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                    postAudience === opt.id
                      ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
                      : 'bg-[var(--cam-surface)] text-[var(--cam-text)] border-white/10'
                  }`}
                >
                  {postAudience === opt.id && <Check className="w-3.5 h-3.5" />}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="tw-create-post-panel"
      className="absolute inset-0 z-20 bg-[var(--cam-bg)] text-[var(--cam-text)] select-none"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        data-testid="tw-post-file-input"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length > 0) onAddFiles(picked);
          e.target.value = '';
        }}
      />

      {/* Top Bar: top=36, height=56 (bottom y=92) */}
      <header className="absolute top-[max(36px,calc(12px+var(--sat)))] inset-x-0 h-[56px] px-2 flex items-center justify-between z-30">
        <button
          type="button"
          data-testid="tw-create-close"
          onClick={onClose}
          aria-label="إغلاق"
          className="w-[44px] h-[44px] flex items-center justify-center text-[var(--cam-text)] active:scale-95"
        >
          <X className="w-[26px] h-[26px]" />
        </button>

        <h1 className="text-[17px] font-bold text-[var(--cam-text)]">منشور جديد</h1>

        <button
          type="button"
          data-testid="tw-post-next"
          disabled={selectedItems.length === 0}
          onClick={() => setSubView('edit')}
          className="h-9 px-3.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] text-[17px] font-bold disabled:opacity-40 transition-opacity"
        >
          التالي
        </button>
      </header>

      {/* Preview Frame: top=92, height=385, inset-x=2 */}
      <div
        data-testid="tw-post-preview"
        className="absolute top-[92px] inset-x-[2px] h-[385px] bg-[var(--cam-bg)] overflow-hidden flex items-center justify-center rounded-[12px]"
      >
        {primaryItem ? (
          primaryItem.type === 'video' ? (
            <video
              key={primaryItem.id}
              src={primaryItem.url}
              controls
              playsInline
              muted
              data-testid="tw-post-preview-video"
              className={`w-full h-full ${fitCover ? 'object-cover' : 'object-contain'}`}
            />
          ) : (
            <img
              src={primaryItem.url}
              alt="معاينة المنشور"
              data-testid="tw-post-preview-image"
              className={`w-full h-full ${fitCover ? 'object-cover' : 'object-contain'}`}
              draggable={false}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <ImagePlus className="w-10 h-10 text-[var(--cam-muted)]" />
            <p className="text-sm font-semibold text-[var(--cam-muted)]">
              اختر صورة أو فيديو من جهازك للمعاينة
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-4 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
            >
              اختيار من الجهاز
            </button>
          </div>
        )}

        {/* Fit/Cover toggle button (44px, 13px from start/bottom) */}
        <button
          type="button"
          data-testid="tw-post-fit-toggle"
          onClick={() => setFitCover((v) => !v)}
          aria-label="تبديل ملء الإطار"
          className="absolute bottom-[13px] start-[13px] z-20 w-[44px] h-[44px] rounded-full bg-[var(--cam-scrim)] backdrop-blur-xs text-[var(--cam-text)] flex items-center justify-center active:scale-95"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay Tool Column on Preview Start Side: centers at y=253, 297, 341, 385 */}
      <div
        data-testid="tw-post-overlay-tools"
        className="absolute top-[231px] start-[10px] z-30 flex flex-col items-start gap-0"
      >
        <button
          type="button"
          data-testid="tw-post-tool-create"
          onClick={() => setSubView('composer')}
          className="h-[44px] px-2 rounded-full flex items-center gap-2.5 text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] active:scale-95"
        >
          <span className="w-7 text-center text-[21px] font-medium leading-none">Aa</span>
          <span className="text-[15px] font-semibold">إنشاء</span>
        </button>

        <button
          type="button"
          data-testid="tw-post-tool-boomerang"
          onClick={onOpenBoomerang}
          className="h-[44px] px-2 rounded-full flex items-center gap-2.5 text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] active:scale-95"
        >
          <InfinityIcon className="w-7 h-7" />
          <span className="text-[15px] font-semibold">بوميرانغ</span>
        </button>

        <button
          type="button"
          data-testid="tw-post-tool-effects"
          onClick={onOpenEffects}
          className="h-[44px] px-2 rounded-full flex items-center gap-2.5 text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] active:scale-95"
        >
          <Wand2 className="w-6 h-6" />
          <span className="text-[15px] font-semibold">مؤثرات</span>
        </button>

        {toolsExpanded && (
          <button
            type="button"
            data-testid="tw-post-tool-layout"
            onClick={onOpenLayout}
            className="h-[44px] px-2 rounded-full flex items-center gap-2.5 text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] active:scale-95"
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-[15px] font-semibold">تخطيط</span>
          </button>
        )}

        <button
          type="button"
          data-testid="tw-post-tools-chevron"
          onClick={() => setToolsExpanded((v) => !v)}
          aria-label={toolsExpanded ? 'إخفاء الأدوات الإضافية' : 'المزيد من الأدوات'}
          className="h-[44px] w-[44px] flex items-center justify-center text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
        >
          <ChevronDown
            className={`w-6 h-6 transition-transform duration-150 ${
              toolsExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Album Row: center y ~ 500 (top=478, h=44) */}
      <div className="absolute top-[478px] inset-x-0 h-[44px] px-3 flex items-center justify-between z-20">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAlbumMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[20px] font-bold text-[var(--cam-text)] leading-none"
          >
            <span>{albumLabel}</span>
            <ChevronDown className="w-5 h-5" />
          </button>

          {albumMenuOpen && (
            <div className="absolute top-9 start-0 z-40 min-w-[130px] rounded-2xl bg-[var(--cam-surface-2)] border border-white/10 shadow-xl p-1 flex flex-col">
              {[
                { id: 'all' as const, label: 'الأخيرة' },
                { id: 'image' as const, label: 'الصور' },
                { id: 'video' as const, label: 'الفيديو' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAlbumFilter(opt.id);
                    setAlbumMenuOpen(false);
                  }}
                  className={`h-9 px-3 rounded-xl text-xs font-bold text-start ${
                    albumFilter === opt.id
                      ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                      : 'text-[var(--cam-text)] hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          data-testid="tw-post-multiselect-btn"
          onClick={onToggleMultiSelect}
          className={`min-w-[108px] h-[40px] px-3.5 rounded-full flex items-center justify-center gap-2 text-sm font-bold border transition-colors ${
            isMultiSelect
              ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
              : 'bg-[var(--cam-surface-2)] text-[var(--cam-text)] border-white/10'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>تحديد</span>
        </button>
      </div>

      {/* 4-column scrollable media grid starting at y = 524 */}
      <div
        data-testid="tw-post-grid"
        className="absolute top-[524px] inset-x-0 bottom-[76px] overflow-y-auto px-[1px] pb-6"
      >
        <p className="px-3 py-1 text-[11px] text-[var(--cam-muted)]">
          تقتصر معاينة الويب على الملفات التي تختارها من جهازك (حتى {formatNumber(10, numeralSystem)} عناصر).
        </p>

        <div className="grid grid-cols-4 gap-[1px]">
          {/* Tile 1: Pick from device */}
          <button
            type="button"
            data-testid="tw-post-pick-device-tile"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square bg-[var(--cam-surface-2)] flex flex-col items-center justify-center gap-1.5 p-2 text-center active:opacity-80"
          >
            <ImagePlus className="w-6 h-6 text-[var(--primary)]" />
            <span className="text-[11px] font-bold leading-tight text-[var(--cam-text)]">
              اختيار من الجهاز
            </span>
          </button>

          {/* Tile 2: Camera shortcut */}
          <button
            type="button"
            data-testid="tw-post-camera-tile"
            onClick={onOpenCamera}
            aria-label="فتح الكاميرا"
            className="aspect-square bg-[var(--cam-surface)] flex items-center justify-center active:opacity-80"
          >
            <Camera className="w-[40px] h-[40px] text-[var(--cam-text)] stroke-[1.75]" />
          </button>

          {/* Picked session thumbnails */}
          {filteredItems.map((item) => {
            const selIndex = selectedIds.indexOf(item.id);
            const isSelected = selIndex !== -1;
            return (
              <button
                key={item.id}
                type="button"
                data-testid="tw-post-grid-thumb"
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => onSelectTile(item.id)}
                className={`relative aspect-square overflow-hidden bg-[var(--cam-surface)] ${
                  isSelected ? 'ring-2 ring-inset ring-[var(--primary)]' : ''
                }`}
              >
                {item.type === 'video' ? (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt="صورة مختارة"
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                )}

                {(isMultiSelect || isSelected) && (
                  <span
                    className={`absolute top-1.5 end-1.5 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center border ${
                      isSelected
                        ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
                        : 'bg-black/45 text-white border-white/80'
                    }`}
                  >
                    {isSelected ? formatNumber(selIndex + 1, numeralSystem) : ''}
                  </span>
                )}

                {item.type === 'video' && (
                  <span className="absolute bottom-1 end-1.5 text-[11px] font-bold text-[var(--cam-text)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {formatVideoDuration(item.durationSec ?? 5, numeralSystem)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
