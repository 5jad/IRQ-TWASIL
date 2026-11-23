import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ProfileCanvasConfig,
  CANVAS_TEMPLATES,
  ALLOWED_ACCENTS,
  ALLOWED_FONTS,
  ALLOWED_LAYOUTS,
  ALLOWED_THEME_PRESETS,
  validateCanvasJson,
} from '../../lib/canvasSchema';
import {
  ACCENT_PALETTES,
  AVATAR_FRAME_META,
  BACKDROP_MODE_META,
  BLOCK_LABELS,
  CURATED_WOW_LOOKS,
  FONT_STACKS,
  GRID_STYLE_META,
  LAYOUT_META,
  MAQAM_SCALES,
  PRESET_META,
  SURFACE_STYLE_META,
  extractCanvasLinks,
  getCanvasMusicContent,
  getCanvasPinnedContent,
  mergeAllCanvasBlocks,
  parseSafeCanvasDslOrJson,
  reorderCanvasBlocks,
  resolveCanvasAppearance,
  serializeCanvasToDsl,
  type CanvasAvatarFrame,
  type CanvasBackdropMode,
  type CanvasBlockType,
  type CanvasGridStyle,
  type CanvasMaqamKey,
  type CanvasSurfaceStyle,
} from '../../lib/canvasStyles';
import {
  Smartphone,
  Tablet,
  Laptop,
  Sparkles,
  Copy,
  Check,
  Save,
  Eye,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Pin,
  Music,
  ExternalLink,
  Store,
  Award,
  MapPin,
  Code2,
} from 'lucide-react';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { SmartImage } from '../ui/SmartImage';
import { formatCompactCount } from '../../lib/formatters';

export function CanvasEditorView() {
  const {
    currentUser,
    posts,
    setCurrentRoute,
    activeCanvasConfig,
    setActiveCanvasConfig,
    numeralSystem,
    serverOnline,
    isAuthenticated,
    requireAuthForWrite,
    showAppToast,
  } = useApp();

  const normalizeForEditor = (cfg: ProfileCanvasConfig): ProfileCanvasConfig => ({
    ...cfg,
    blocks: mergeAllCanvasBlocks(cfg.blocks),
  });

  const [currentConfig, setCurrentConfig] = useState<ProfileCanvasConfig>(() =>
    normalizeForEditor(activeCanvasConfig ?? CANVAS_TEMPLATES[0]!)
  );
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [activeTab, setActiveTab] = useState<'layout' | 'theme' | 'dsl' | 'ai'>('layout');
  const [aiWish, setAiWish] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [codeInput, setCodeInput] = useState(() => serializeCanvasToDsl(activeCanvasConfig ?? CANVAS_TEMPLATES[0]!));
  const [codeMode, setCodeMode] = useState<'dsl' | 'json'>('dsl');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showUndoSnackbar, setShowUndoSnackbar] = useState(false);
  const previousPublishedRef = useRef<ProfileCanvasConfig | null>(activeCanvasConfig);

  useEffect(() => {
    if (activeCanvasConfig) {
      const merged = normalizeForEditor(activeCanvasConfig);
      setCurrentConfig(merged);
      setCodeInput(
        codeMode === 'dsl'
          ? serializeCanvasToDsl(merged)
          : JSON.stringify(activeCanvasConfig, null, 2)
      );
    }
  }, [activeCanvasConfig]);

  const handleSwitchCodeMode = (nextMode: 'dsl' | 'json') => {
    setCodeMode(nextMode);
    setCodeError(null);
    setCodeInput(
      nextMode === 'dsl'
        ? serializeCanvasToDsl(currentConfig)
        : JSON.stringify(currentConfig, null, 2)
    );
  };

  const updateBlockSettings = (
    blockType: CanvasBlockType,
    patch: Record<string, string | number | boolean>,
    forceVisible = true
  ) => {
    setCurrentConfig((prev) => {
      const merged = mergeAllCanvasBlocks(prev.blocks);
      const nextBlocks = merged.map((b) => {
        if (b.type !== blockType) return b;
        const nextSettings: Record<string, string | number | boolean> = { ...(b.settings ?? {}) };
        for (const [k, v] of Object.entries(patch)) {
          if (typeof v === 'string' && v.trim() === '') {
            delete nextSettings[k];
          } else {
            nextSettings[k] = v;
          }
        }
        return {
          ...b,
          visible: forceVisible ? true : b.visible,
          settings: Object.keys(nextSettings).length > 0 ? nextSettings : undefined,
        };
      });
      return { ...prev, blocks: nextBlocks };
    });
  };

  // Generate AI Prompt for Google AI Studio / Gemini (Safe Declarative DSL or strict JSON)
  const generateAiPrompt = () => {
    return `أنت مساعد تصميم واجهات لـ IRQ تواصل. صمّم بروفايل مستخدم حسب الطلب باستخدام صيغة التصميم الآمنة (أو JSON المعتمد) بدون أي كود HTML أو HTMX أو JavaScript:

رغبة المستخدم في التصميم:
"${aiWish || 'تصميم عصري بتقسيم Bento وشفق متحرك مع إطار لازوردي وذهبي'}"

الصيغة المقروءة الموصى بها (انسخ الأسطر مباشرة):
name: اسم التصميم (حتى ٤٠ حرفاً)
preset: sand | dijlah | palm | baghdad-night | glass | editorial | retro90 | gallery | merchant | streamer | poet | tech
accent: teal | copper | indigo | green | rose | violet | slate | gold
background: surface | gradient | pattern
surface: clean | glass | glow | editorial-frame | bento
backdrop: standard | mesh | shanasheel | aurora
avatarFrame: none | ring | lapis-gold | neon-glow | squircle
grid: classic | bento | masonry-cards
badge: شارة قصيرة بجانب الاسم (اختياري)
font: cairo | reem-kufi | noto-naskh
layout: editorial | modern | compact | showcase
motion: subtle | smooth | gentle | none
blocks: cover, identity, bio, stats, badges, pinned-post, links, music-widget, posts-grid
note: ملاحظة ترحيبية مثبتة (اختياري)
maqam: lami | hijaz | bayat | saba

أخرج سطور الصيغة أعلاه فقط بدون شرح إضافي.`;
  };

  const handleCopyPrompt = () => {
    void navigator.clipboard?.writeText(generateAiPrompt()).catch(() => {});
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleApplyCode = () => {
    const result = parseSafeCanvasDslOrJson(codeInput, currentConfig);
    if (!result.valid || !result.config) {
      setCodeError(result.errors.join(' · '));
      return;
    }
    const merged = normalizeForEditor(result.config);
    setCurrentConfig(merged);
    setCodeError(null);
    showAppToast('تم تطبيق التصميم والتحقق من أمانه بنجاح', 'success');
    setActiveTab('layout');
  };

  const handlePublish = async () => {
    if (serverOnline && !isAuthenticated) {
      requireAuthForWrite();
      return;
    }
    // Strip disabled extra settings cleanly before strict validation
    const candidate: ProfileCanvasConfig = {
      ...currentConfig,
      name: currentConfig.name.trim() || 'تصميمي المخصص',
      blocks: currentConfig.blocks.slice(0, 20),
    };
    const checked = validateCanvasJson(candidate);
    if (!checked.valid || !checked.config) {
      showAppToast(checked.errors[0] ?? 'تعذر التحقق من إعدادات التصميم', 'error');
      return;
    }
    previousPublishedRef.current = activeCanvasConfig ? structuredClone(activeCanvasConfig) : null;
    setIsPublishing(true);
    try {
      const ok = await setActiveCanvasConfig(checked.config);
      if (ok) {
        setShowUndoSnackbar(true);
        setTimeout(() => setShowUndoSnackbar(false), 10000);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUndoPublish = async () => {
    const prev = previousPublishedRef.current;
    setIsPublishing(true);
    try {
      const ok = await setActiveCanvasConfig(prev);
      if (ok) {
        setCurrentConfig(normalizeForEditor(prev ?? CANVAS_TEMPLATES[0]!));
        setShowUndoSnackbar(false);
        showAppToast('تم التراجع واستعادة التصميم السابق', 'info');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleResetDefault = async () => {
    if (serverOnline && !isAuthenticated) {
      requireAuthForWrite();
      return;
    }
    setIsPublishing(true);
    try {
      const ok = await setActiveCanvasConfig(null);
      if (ok) {
        setShowUndoSnackbar(false);
        showAppToast('تمت استعادة التصميم الافتراضي للملف الشخصي', 'success');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const appearance = resolveCanvasAppearance(currentConfig);
  const userPosts = posts.filter((p) => p.author.id === currentUser.id);
  const previewLinks = extractCanvasLinks(currentConfig);
  const previewPinned = getCanvasPinnedContent(currentConfig);
  const previewMusic = getCanvasMusicContent(currentConfig);
  const previewBodyOrder = currentConfig.blocks
    .filter(
      (b) =>
        ['badges', 'music-widget', 'stats', 'pinned-post', 'links', 'shop-strip'].includes(b.type) &&
        b.visible
    )
    .map((b) => b.type);

  const linkSettings = currentConfig.blocks.find((b) => b.type === 'links')?.settings ?? {};

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-4 flex flex-col gap-5 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12">
      {/* Top Bar with actions */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary-tint)] text-[var(--primary-text)] flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[var(--text)]">
              استوديو تصميم الملف الشخصي (Profile Canvas)
            </h1>
            <span className="text-xs text-[var(--text-muted)]">
              تخصيص بصري فوري + صيغة تنسيق آمنة بدون ثغرات
            </span>
          </div>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setPreviewDevice('mobile')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
              previewDevice === 'mobile' ? 'bg-[var(--surface)] shadow-xs text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">هاتف (390)</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice('tablet')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
              previewDevice === 'tablet' ? 'bg-[var(--surface)] shadow-xs text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span className="hidden sm:inline">لوحي (768)</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice('desktop')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
              previewDevice === 'desktop' ? 'bg-[var(--surface)] shadow-xs text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span className="hidden sm:inline">حاسوب (1280)</span>
          </button>
        </div>

        {/* Publish & Reset Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {activeCanvasConfig && (
            <Button
              type="button"
              variant="outline"
              onClick={handleResetDefault}
              disabled={isPublishing}
              className="h-10 text-xs gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setCurrentRoute('profile')} className="h-10 text-xs">
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handlePublish}
            disabled={isPublishing}
            data-testid="tw-canvas-publish-btn"
            className="h-10 text-xs gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{isPublishing ? 'جارٍ الحفظ...' : 'اعتماد ونشر التصميم'}</span>
          </Button>
        </div>
      </div>

      {/* Undo / View Snackbar if published */}
      {showUndoSnackbar && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>تم اعتماد ونشر تصميم ملفك بنجاح! أصبح نشطاً الآن في صفحة البروفايل.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentRoute('profile')}
              className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>مشاهدة ملفك الآن</span>
            </button>
            <button
              type="button"
              onClick={handleUndoPublish}
              disabled={isPublishing}
              className="text-xs font-bold text-amber-300 hover:underline px-2 py-1"
            >
              تراجع (Undo)
            </button>
          </div>
        </div>
      )}

      {/* Editor & Preview Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-[var(--surface-2)] p-1 rounded-2xl border border-[var(--border)] select-none">
            {[
              { id: 'layout', label: 'القوالب والعناصر' },
              { id: 'theme', label: 'الألوان والمحتوى' },
              { id: 'dsl', label: 'تنسيق سريع / JSON' },
              { id: 'ai', label: 'مساعد AI' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id as 'layout' | 'theme' | 'dsl' | 'ai');
                  if (t.id === 'dsl') {
                    setCodeInput(
                      codeMode === 'dsl'
                        ? serializeCanvasToDsl(currentConfig)
                        : JSON.stringify(currentConfig, null, 2)
                    );
                  }
                }}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl transition-all text-center ${
                  activeTab === t.id
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 1. Layout & Templates Tab */}
          {activeTab === 'layout' && (
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tw-canvas-name" className="text-xs font-bold text-[var(--text)]">
                  اسم التصميم:
                </label>
                <input
                  id="tw-canvas-name"
                  type="text"
                  maxLength={40}
                  value={currentConfig.name}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
                  className="h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Curated Wow Looks */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>إطلالات جاهزة فائقة الجمال (Bento · Glass · Mesh):</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {CURATED_WOW_LOOKS.map((look) => {
                    const isSelected = currentConfig.name === look.label;
                    return (
                      <button
                        key={look.id}
                        type="button"
                        data-testid={`tw-canvas-wow-${look.id}`}
                        onClick={() => setCurrentConfig(normalizeForEditor(look.build(currentConfig)))}
                        className={`p-2.5 rounded-2xl border text-start flex items-center gap-3 transition-all ${
                          isSelected
                            ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold shadow-xs'
                            : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--text-muted)]'
                        }`}
                      >
                        <span
                          className="w-11 h-11 rounded-xl shrink-0 border border-black/15 shadow-xs"
                          style={{ background: look.swatchGradient }}
                        />
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs font-bold text-[var(--text)] truncate">{look.label}</span>
                          <span className="text-[11px] text-[var(--text-muted)] truncate">{look.subtitle}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border)]">
                <h3 className="text-xs font-bold text-[var(--text)]">القوالب العراقية الجاهزة (١٢ قالباً):</h3>
                <div className="grid grid-cols-2 gap-2">
                  {CANVAS_TEMPLATES.map((tmpl) => {
                    const pMeta = PRESET_META[tmpl.theme.preset];
                    const aMeta = ACCENT_PALETTES[tmpl.theme.accent];
                    const isSelected = currentConfig.name === tmpl.name;
                    return (
                      <button
                        key={tmpl.name}
                        type="button"
                        onClick={() => setCurrentConfig(normalizeForEditor(tmpl))}
                        className={`p-2.5 rounded-xl border text-start flex flex-col gap-1.5 transition-all shrink-0 ${
                          isSelected
                            ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold'
                            : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--text-muted)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 w-full">
                          <span className="text-xs text-[var(--text)] truncate">{tmpl.name}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <span
                              className="w-3 h-3 rounded-full border border-black/15"
                              style={{ backgroundColor: pMeta.swatchBg }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/15"
                              style={{ backgroundColor: aMeta.swatch }}
                            />
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {LAYOUT_META[tmpl.layout].label} · {aMeta.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layout Picker */}
              <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                <span className="text-xs font-bold text-[var(--text)]">نمط التخطيط (Layout):</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALLOWED_LAYOUTS.map((lKey) => (
                    <button
                      key={lKey}
                      type="button"
                      onClick={() => setCurrentConfig({ ...currentConfig, layout: lKey })}
                      className={`p-2 rounded-xl border text-start flex flex-col gap-0.5 transition-all ${
                        currentConfig.layout === lKey
                          ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary-text)] font-bold'
                          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                      }`}
                    >
                      <span className="text-xs">{LAYOUT_META[lKey].label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{LAYOUT_META[lKey].hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* All 10 Blocks Toggle + Order */}
              <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                <span className="text-xs font-bold text-[var(--text)]">عناصر الصفحة وترتيبها (١٠ عناصر):</span>
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pe-1">
                  {currentConfig.blocks.map((block, idx) => (
                    <div
                      key={`${block.type}-${idx}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]"
                    >
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={block.visible}
                          onChange={(e) => {
                            const updated = [...currentConfig.blocks];
                            updated[idx] = { ...block, visible: e.target.checked };
                            setCurrentConfig({ ...currentConfig, blocks: updated });
                          }}
                          className="rounded text-[var(--primary)]"
                        />
                        <span className="text-[var(--text)]">{BLOCK_LABELS[block.type] ?? block.type}</span>
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            setCurrentConfig({
                              ...currentConfig,
                              blocks: reorderCanvasBlocks(currentConfig.blocks, idx, 'up'),
                            })
                          }
                          aria-label={`تحريك ${BLOCK_LABELS[block.type] ?? block.type} للأعلى`}
                          className="p-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-35"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === currentConfig.blocks.length - 1}
                          onClick={() =>
                            setCurrentConfig({
                              ...currentConfig,
                              blocks: reorderCanvasBlocks(currentConfig.blocks, idx, 'down'),
                            })
                          }
                          aria-label={`تحريك ${BLOCK_LABELS[block.type] ?? block.type} للأسفل`}
                          className="p-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-35"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. Theme, Colors & Custom Content Tab */}
          {activeTab === 'theme' && (
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
              {/* Theme Preset */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[var(--text)]">السمة العامة (Theme Preset):</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALLOWED_THEME_PRESETS.map((presetKey) => {
                    const meta = PRESET_META[presetKey];
                    const active = currentConfig.theme.preset === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() =>
                          setCurrentConfig({
                            ...currentConfig,
                            theme: { ...currentConfig.theme, preset: presetKey },
                          })
                        }
                        className={`p-2 rounded-xl border text-start flex items-center gap-2 transition-all ${
                          active
                            ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold'
                            : 'border-[var(--border)] bg-[var(--surface-2)]'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-lg border border-black/20 shrink-0"
                          style={{ backgroundColor: meta.swatchBg }}
                        />
                        <span className="text-xs text-[var(--text)] truncate">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Swatches */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)]">اللون البارز (Accent):</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALLOWED_ACCENTS.map((acc) => {
                    const palette = ACCENT_PALETTES[acc];
                    const active = currentConfig.theme.accent === acc;
                    return (
                      <button
                        key={acc}
                        type="button"
                        onClick={() =>
                          setCurrentConfig({
                            ...currentConfig,
                            theme: { ...currentConfig.theme, accent: acc },
                          })
                        }
                        className={`px-2.5 py-2 rounded-xl text-xs border flex items-center gap-2 ${
                          active
                            ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold text-[var(--text)]'
                            : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-black/15"
                          style={{ backgroundColor: palette.swatch }}
                        />
                        <span className="truncate">{palette.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Treatment */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)]">نسيج الخلفية (Background):</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'surface', label: 'سطح صافي' },
                    { id: 'gradient', label: 'تدرّج لوني' },
                    { id: 'pattern', label: 'نقش هندسي' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() =>
                        setCurrentConfig({
                          ...currentConfig,
                          theme: {
                            ...currentConfig.theme,
                            background: bg.id as 'surface' | 'gradient' | 'pattern',
                          },
                        })
                      }
                      className={`p-2 rounded-xl text-xs font-semibold border text-center ${
                        currentConfig.theme.background === bg.id
                          ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold text-[var(--primary-text)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Effects & Frames (Bento, Mesh, Glass, Avatar Frame, Status Badge) */}
              <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)]">
                  المؤثرات والإطار (Bento · Mesh · Glass):
                </span>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">أسلوب البطاقات (Surface):</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(SURFACE_STYLE_META) as CanvasSurfaceStyle[]).map((sKey) => {
                      const active = appearance.effects.surfaceStyle === sKey;
                      return (
                        <button
                          key={sKey}
                          type="button"
                          onClick={() => updateBlockSettings('cover', { surfaceStyle: sKey }, false)}
                          className={`p-2 rounded-xl text-start border flex flex-col gap-0.5 ${
                            active
                              ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold text-[var(--primary-text)]'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                          }`}
                        >
                          <span className="text-xs">{SURFACE_STYLE_META[sKey].label}</span>
                          <span className="text-[10px] text-[var(--text-muted)] font-normal">
                            {SURFACE_STYLE_META[sKey].hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">خلفية فنية (Backdrop):</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(BACKDROP_MODE_META) as CanvasBackdropMode[]).map((bKey) => {
                      const active = appearance.effects.backdropMode === bKey;
                      return (
                        <button
                          key={bKey}
                          type="button"
                          onClick={() => updateBlockSettings('cover', { backdropMode: bKey }, false)}
                          className={`p-2 rounded-xl text-xs font-semibold border text-center ${
                            active
                              ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold text-[var(--primary-text)]'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                          }`}
                        >
                          {BACKDROP_MODE_META[bKey].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">إطار الصورة الشخصية (Avatar Frame):</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(AVATAR_FRAME_META) as CanvasAvatarFrame[]).map((fKey) => {
                      const active = appearance.effects.avatarFrame === fKey;
                      return (
                        <button
                          key={fKey}
                          type="button"
                          onClick={() => updateBlockSettings('identity', { avatarFrame: fKey }, false)}
                          className={`p-2 rounded-xl text-xs font-semibold border text-center ${
                            active
                              ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold text-[var(--primary-text)]'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                          }`}
                        >
                          {AVATAR_FRAME_META[fKey].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">شكل عرض المنشورات (Grid):</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(GRID_STYLE_META) as CanvasGridStyle[]).map((gKey) => {
                      const active = appearance.effects.gridStyle === gKey;
                      return (
                        <button
                          key={gKey}
                          type="button"
                          onClick={() => updateBlockSettings('posts-grid', { gridStyle: gKey }, false)}
                          className={`p-2 rounded-xl text-xs font-semibold border text-center ${
                            active
                              ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold text-[var(--primary-text)]'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                          }`}
                        >
                          {GRID_STYLE_META[gKey].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="tw-canvas-status-badge" className="text-[11px] font-semibold text-[var(--text-muted)]">
                    شارة حالة قصيرة بجانب الاسم:
                  </label>
                  <input
                    id="tw-canvas-status-badge"
                    type="text"
                    maxLength={40}
                    placeholder="مثال: مصور من بغداد · متاح للتعاون"
                    value={appearance.effects.statusBadge ?? ''}
                    onChange={(e) => updateBlockSettings('identity', { statusBadge: e.target.value }, false)}
                    className="h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>
              </div>

              {/* Font */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)]">الخط العربي:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {ALLOWED_FONTS.map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() =>
                        setCurrentConfig({
                          ...currentConfig,
                          theme: { ...currentConfig.theme, font },
                        })
                      }
                      className={`p-2 rounded-xl text-xs font-semibold border text-center ${
                        currentConfig.theme.font === font
                          ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold text-[var(--primary-text)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                      }`}
                    >
                      {FONT_STACKS[font].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motion */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)]">الحركة (Motion):</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['subtle', 'smooth', 'gentle', 'none'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setCurrentConfig({
                          ...currentConfig,
                          motion: { ...currentConfig.motion, preset: m },
                        })
                      }
                      className={`p-1.5 rounded-xl text-xs font-semibold border text-center ${
                        currentConfig.motion.preset === m
                          ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold'
                          : 'border-[var(--border)] bg-[var(--surface-2)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* No-Code Block Content Editor (Pinned Note, Maqam, Links) */}
              <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text)]">محتوى مخصص بدون كود:</span>

                <div className="flex flex-col gap-1">
                  <label htmlFor="tw-canvas-pinned-note" className="text-[11px] font-semibold text-[var(--text-muted)]">
                    رسالة أو منشور مثبت في الواجهة:
                  </label>
                  <input
                    id="tw-canvas-pinned-note"
                    type="text"
                    maxLength={180}
                    placeholder="اكتب جملة ترحيبية تظهر أعلى ملفك..."
                    value={previewPinned.note ?? ''}
                    onChange={(e) => updateBlockSettings('pinned-post', { note: e.target.value })}
                    className="h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="tw-canvas-maqam" className="text-[11px] font-semibold text-[var(--text-muted)]">
                    مقام النغمة التراثية للملف:
                  </label>
                  <select
                    id="tw-canvas-maqam"
                    value={previewMusic.maqam}
                    onChange={(e) =>
                      updateBlockSettings('music-widget', { maqam: e.target.value as CanvasMaqamKey })
                    }
                    className="h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  >
                    {Object.entries(MAQAM_SCALES).map(([k, info]) => (
                      <option key={k} value={k}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                    روابط مخصصة (https://):
                  </span>
                  {[1, 2].map((idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-1.5">
                      <input
                        type="text"
                        maxLength={40}
                        placeholder={`عنوان ${idx}`}
                        value={String(linkSettings[`title${idx}`] ?? '')}
                        onChange={(e) => updateBlockSettings('links', { [`title${idx}`]: e.target.value })}
                        className="col-span-2 h-8 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] text-[var(--text)]"
                      />
                      <input
                        type="url"
                        dir="ltr"
                        maxLength={180}
                        placeholder="https://..."
                        value={String(linkSettings[`url${idx}`] ?? '')}
                        onChange={(e) => updateBlockSettings('links', { [`url${idx}`]: e.target.value })}
                        className="col-span-3 h-8 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-mono text-[var(--text)]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. Safe Declarative DSL or JSON Tab */}
          {activeTab === 'dsl' && (
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                  <Code2 className="w-4 h-4 text-[var(--primary)]" />
                  <span>محرر الصيغة الآمنة</span>
                </div>
                <div className="flex items-center gap-1 bg-[var(--surface-2)] p-0.5 rounded-lg border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => handleSwitchCodeMode('dsl')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                      codeMode === 'dsl' ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    صيغة مبسطة (DSL)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchCodeMode('json')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                      codeMode === 'json' ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    JSON صارم
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                يمكنك التعديل بأسطر نصية بسيطة مثل <code dir="ltr">preset: baghdad-night</code> و<code dir="ltr">accent: gold</code> أو لصق JSON — ويتم فحص كل مدخل ومنع أي HTML/HTMX أو سكربت لحماية الزوّار.
              </p>

              <textarea
                rows={9}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                dir="ltr"
                className="w-full p-2.5 rounded-xl bg-[var(--surface-2)] text-xs text-[var(--text)] font-mono border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />

              {codeError && (
                <div className="p-2.5 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] border border-[var(--danger)]/30 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{codeError}</span>
                </div>
              )}

              <Button type="button" variant="primary" onClick={handleApplyCode} className="w-full text-xs">
                فحص وتطبيق التصميم على المعاينة
              </Button>
            </div>
          )}

          {/* 4. AI Prompt Workflow */}
          {activeTab === 'ai' && (
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
              <span className="text-xs font-bold text-[var(--text)]">صف التصميم الذي تريده بالعربية:</span>
              <textarea
                rows={3}
                value={aiWish}
                onChange={(e) => setAiWish(e.target.value)}
                placeholder="مثال: تصميم تراثي فخم لسوق الصفافير بالألوان النحاسية والخط الكوفي مع خلفية منقوشة..."
                className="w-full p-3 rounded-xl bg-[var(--surface-2)] text-xs text-[var(--text)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              />

              <Button
                type="button"
                variant="copper"
                onClick={handleCopyPrompt}
                className="w-full text-xs gap-1.5"
              >
                {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPrompt ? 'تم نسخ البرومبت!' : 'نسخ برومبت التصميم الآمن'}</span>
              </Button>

              <span className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                بعد توليد النتيجة بالذكاء الاصطناعي، الصقها في تبويب «تنسيق سريع / JSON» لتظهر فوراً في المعاينة الحية.
              </span>
            </div>
          )}
        </div>

        {/* Live Preview Column (7 cols) */}
        <div className="lg:col-span-7 lg:sticky lg:top-4 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-2 px-2">
            <span>معاينة مطابقة تماماً للبروفايل المنشور</span>
            <span>
              {currentConfig.name} · {PRESET_META[currentConfig.theme.preset]?.label}
            </span>
          </div>

          {/* Device Frame */}
          <div
            data-testid="tw-canvas-preview-frame"
            data-canvas-preset={currentConfig.theme.preset}
            data-canvas-accent={currentConfig.theme.accent}
            data-canvas-surface={appearance.effects.surfaceStyle}
            data-canvas-backdrop={appearance.effects.backdropMode}
            data-canvas-frame={appearance.effects.avatarFrame}
            data-canvas-grid={appearance.effects.gridStyle}
            style={{
              ...appearance.style,
              width: previewDevice === 'mobile' ? '390px' : '100%',
              maxWidth: previewDevice === 'mobile' ? '390px' : previewDevice === 'tablet' ? '580px' : '680px',
            }}
            className={`rounded-3xl shadow-2xl overflow-hidden ${appearance.containerClass}`}
          >
            {/* Live Rendered Profile Canvas */}
            <div className="flex flex-col">
              {/* Cover block */}
              {isBlockVisible(currentConfig, 'cover') && (
                <div
                  style={!currentUser.coverUrl ? { background: 'var(--cover-bg)' } : undefined}
                  className={`relative w-full ${appearance.coverAspectClass} bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] overflow-hidden`}
                >
                  {currentUser.coverUrl && (
                    <img
                      src={currentUser.coverUrl}
                      alt="غلاف"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />
                </div>
              )}

              {/* Identity, Bio & Ordered Blocks */}
              <div
                className={`${appearance.isCompact ? 'p-3' : 'p-4'} flex flex-col gap-3 ${
                  appearance.isEditorial ? 'text-center items-center' : ''
                }`}
              >
                {isBlockVisible(currentConfig, 'identity') && (
                  <div
                    className={`flex w-full ${
                      appearance.isEditorial
                        ? `flex-col items-center ${isBlockVisible(currentConfig, 'cover') ? '-mt-12' : ''} gap-2`
                        : `items-end gap-3 ${isBlockVisible(currentConfig, 'cover') ? '-mt-10' : ''}`
                    }`}
                  >
                    <div
                      className={`inline-flex shrink-0 ${appearance.avatarFrameVisuals.wrapperClass}`}
                      style={appearance.avatarFrameVisuals.wrapperStyle}
                    >
                      <Avatar
                        src={currentUser.avatarUrl}
                        name={currentUser.displayName}
                        size={appearance.isEditorial ? 76 : 68}
                        isVerified={currentUser.isVerified}
                        verifiedKind={currentUser.verifiedKind}
                        shape={appearance.avatarFrameVisuals.isSquircle ? 'squircle' : 'circle'}
                        className={
                          appearance.effects.avatarFrame === 'none'
                            ? 'ring-4 ring-[var(--surface)] shadow-md shrink-0'
                            : 'shadow-md shrink-0'
                        }
                      />
                    </div>
                    <div className={`flex flex-col ${appearance.isEditorial ? 'items-center' : 'pb-0.5'}`}>
                      <div className={`flex flex-wrap items-center gap-1 font-bold text-sm text-[var(--text)] ${appearance.isEditorial ? 'justify-center' : ''}`}>
                        <span>{currentUser.displayName}</span>
                        <VerifiedBadge kind={currentUser.verifiedKind} size={14} />
                        {appearance.effects.statusBadge && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] border border-[var(--primary)]/25 text-[10px] font-bold">
                            <Sparkles className="w-2.5 h-2.5 shrink-0" />
                            <span>{appearance.effects.statusBadge}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-muted)] font-mono" dir="ltr">
                        @{currentUser.username}
                      </span>
                    </div>
                  </div>
                )}

                {isBlockVisible(currentConfig, 'bio') && (
                  <p className={`text-xs text-[var(--text)] leading-relaxed ${appearance.isEditorial ? 'max-w-sm italic' : 'w-full text-start'}`}>
                    {currentUser.bio || 'مستكشف على منصة تواصل العراقية'}
                  </p>
                )}

                {/* Ordered Body Blocks matching ProfileView */}
                <div className="w-full flex flex-col gap-2.5">
                  {previewBodyOrder.map((blockType) => {
                    if (blockType === 'badges') {
                      return (
                        <div
                          key="badges"
                          className={`flex flex-wrap gap-1.5 ${appearance.isEditorial ? 'justify-center' : ''}`}
                        >
                          {currentUser.isVerified && (
                            <span className="px-2.5 py-1 rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] border border-[var(--primary)]/25 text-[11px] font-bold flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              <span>موثّق رسمياً</span>
                            </span>
                          )}
                          <span className="px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-bold text-[var(--text)] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--accent)]" />
                            <span>{currentUser.province || 'بغداد'}</span>
                          </span>
                        </div>
                      );
                    }

                    if (blockType === 'stats') {
                      return (
                        <div
                          key="stats"
                          className={`flex items-center gap-6 text-xs text-[var(--text-muted)] py-2 border-y border-[var(--border)] ${
                            appearance.isEditorial ? 'justify-center' : ''
                          }`}
                        >
                          <span>
                            <strong className="text-[var(--text)]">
                              {formatCompactCount(currentUser.postsCount, numeralSystem)}
                            </strong>{' '}
                            منشورات
                          </span>
                          <span>
                            <strong className="text-[var(--text)]">
                              {formatCompactCount(currentUser.followersCount, numeralSystem)}
                            </strong>{' '}
                            متابعون
                          </span>
                          <span>
                            <strong className="text-[var(--text)]">
                              {formatCompactCount(currentUser.followingCount, numeralSystem)}
                            </strong>{' '}
                            يتابع
                          </span>
                        </div>
                      );
                    }

                    if (blockType === 'pinned-post') {
                      return (
                        <div
                          key="pinned-post"
                          className={`p-3 rounded-2xl ${appearance.cardClass} flex items-start gap-2.5 text-start`}
                        >
                          <div className="p-1.5 rounded-xl bg-[var(--primary-tint)] text-[var(--primary-text)] shrink-0">
                            <Pin className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-[var(--primary-text)]">
                              {previewPinned.badge}
                            </span>
                            <p className="text-xs text-[var(--text)] mt-0.5 leading-relaxed">
                              {previewPinned.note ||
                                userPosts[0]?.text ||
                                `مرحباً بكم في ملف ${currentUser.displayName} على تواصل.`}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (blockType === 'links') {
                      return (
                        <div
                          key="links"
                          className={`flex flex-wrap gap-1.5 ${appearance.isEditorial ? 'justify-center' : ''}`}
                        >
                          {previewLinks.length > 0 ? (
                            previewLinks.map((lnk, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--primary-tint)] text-[var(--primary-text)] border border-[var(--primary)]/25 text-[11px] font-bold"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>{lnk.title}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              أضف روابطك المخصصة من تبويب «الألوان والمحتوى»
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (blockType === 'music-widget') {
                      return (
                        <div
                          key="music-widget"
                          className={`p-2.5 rounded-xl ${appearance.cardClass} flex items-center justify-between text-xs font-semibold`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center">
                              <Music className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-[var(--text)]">{previewMusic.trackTitle}</span>
                          </div>
                          <span className="text-[11px] text-[var(--primary-text)] font-bold">
                            {MAQAM_SCALES[previewMusic.maqam].label}
                          </span>
                        </div>
                      );
                    }

                    if (blockType === 'shop-strip') {
                      return (
                        <div
                          key="shop-strip"
                          className={`p-2.5 rounded-xl ${appearance.cardClass} flex items-center justify-between text-xs`}
                        >
                          <span className="flex items-center gap-1.5 font-bold text-[var(--text)]">
                            <Store className="w-3.5 h-3.5 text-[var(--accent)]" />
                            <span>متجر {currentUser.displayName}</span>
                          </span>
                          <span className="text-[11px] font-bold text-[var(--primary-text)]">زيارة المتجر</span>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>

                {isBlockVisible(currentConfig, 'posts-grid') && (
                  userPosts.length > 0 ? (
                    appearance.effects.gridStyle === 'bento' ? (
                      <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
                        {userPosts.slice(0, 5).map((p, i, arr) => {
                          const isHeroTile = i === 0 && arr.length > 1;
                          return (
                            <div
                              key={p.id}
                              className={`overflow-hidden flex items-center justify-center p-1.5 rounded-2xl ${appearance.cardClass} ${
                                isHeroTile ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'
                              }`}
                            >
                              {p.media?.[0]?.url ? (
                                <SmartImage
                                  src={p.media[0].url}
                                  alt="منشور"
                                  containerClassName="w-full h-full"
                                />
                              ) : (
                                <span className="text-[11px] text-[var(--text-muted)] line-clamp-4 text-center px-2">
                                  {p.text}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : appearance.effects.gridStyle === 'masonry-cards' ? (
                      <div className="w-full grid grid-cols-2 gap-2 mt-1">
                        {userPosts.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            className={`flex flex-col overflow-hidden rounded-2xl ${appearance.cardClass} text-start`}
                          >
                            {p.media?.[0]?.url && (
                              <div className="w-full aspect-[4/3] overflow-hidden bg-[var(--surface-2)]">
                                <SmartImage
                                  src={p.media[0].url}
                                  alt="منشور"
                                  containerClassName="w-full h-full"
                                />
                              </div>
                            )}
                            <span className="p-2 text-[10px] text-[var(--text)] line-clamp-2 leading-relaxed">
                              {p.text || 'منشور مصوّر'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`w-full grid ${
                          appearance.isShowcase ? 'grid-cols-2 gap-1.5' : 'grid-cols-3 gap-1'
                        } mt-1`}
                      >
                        {userPosts.slice(0, 6).map((p) => (
                          <div
                            key={p.id}
                            className={`aspect-square rounded-lg overflow-hidden flex items-center justify-center p-1.5 ${appearance.cardClass}`}
                          >
                            {p.media?.[0]?.url ? (
                              <SmartImage
                                src={p.media[0].url}
                                alt="منشور"
                                containerClassName="w-full h-full"
                              />
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)] line-clamp-3 text-center">
                                {p.text}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className={`w-full py-6 rounded-xl ${appearance.cardClass} text-center text-[11px] text-[var(--text-muted)]`}>
                      ستظهر منشوراتك وصورك بنمط {GRID_STYLE_META[appearance.effects.gridStyle].label} بعد النشر
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function isBlockVisible(config: ProfileCanvasConfig, type: string): boolean {
  const block = config.blocks.find((b) => b.type === type);
  return block ? block.visible : false;
}
