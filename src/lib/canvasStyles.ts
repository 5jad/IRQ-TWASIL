import type { CSSProperties } from 'react';
import {
  ALLOWED_ACCENTS,
  ALLOWED_BLOCK_TYPES,
  ALLOWED_FONTS,
  ALLOWED_LAYOUTS,
  ALLOWED_THEME_PRESETS,
  CANVAS_TEMPLATES,
  type CanvasBlockConfig,
  type ProfileCanvasConfig,
  validateCanvasJson,
} from './canvasSchema';

export type CanvasAccentKey = (typeof ALLOWED_ACCENTS)[number];
export type CanvasPresetKey = (typeof ALLOWED_THEME_PRESETS)[number];
export type CanvasFontKey = (typeof ALLOWED_FONTS)[number];
export type CanvasLayoutKey = (typeof ALLOWED_LAYOUTS)[number];
export type CanvasBlockType = (typeof ALLOWED_BLOCK_TYPES)[number];
export type CanvasMaqamKey = 'lami' | 'hijaz' | 'bayat' | 'saba';
export type CanvasSurfaceStyle = 'clean' | 'glass' | 'glow' | 'editorial-frame' | 'bento';
export type CanvasBackdropMode = 'standard' | 'mesh' | 'shanasheel' | 'aurora';
export type CanvasAvatarFrame = 'none' | 'ring' | 'lapis-gold' | 'neon-glow' | 'squircle';
export type CanvasGridStyle = 'classic' | 'bento' | 'masonry-cards';

export interface CanvasVisualEffects {
  surfaceStyle: CanvasSurfaceStyle;
  backdropMode: CanvasBackdropMode;
  avatarFrame: CanvasAvatarFrame;
  gridStyle: CanvasGridStyle;
  statusBadge: string | null;
}

export interface AccentPaletteTokens {
  label: string;
  swatch: string;
  primary: string;
  primaryFg: string;
  primaryText: string;
  primaryTint: string;
  accent: string;
  accentFg: string;
  accentText: string;
  accentTint: string;
  ring: string;
  darkPrimary: string;
  darkPrimaryFg: string;
  darkPrimaryText: string;
  darkPrimaryTint: string;
}

export const ACCENT_PALETTES: Record<CanvasAccentKey, AccentPaletteTokens> = {
  teal: {
    label: 'دجلة (تركواز)',
    swatch: '#0E7490',
    primary: '#0E7490',
    primaryFg: '#FFFFFF',
    primaryText: '#0A5568',
    primaryTint: '#E3EDEF',
    accent: '#0891B2',
    accentFg: '#FFFFFF',
    accentText: '#0E7490',
    accentTint: '#E0F2FE',
    ring: '#0E7490',
    darkPrimary: '#22D3EE',
    darkPrimaryFg: '#04222B',
    darkPrimaryText: '#67E8F9',
    darkPrimaryTint: '#0F2A33',
  },
  copper: {
    label: 'الصفافير (نحاسي)',
    swatch: '#B45309',
    primary: '#B45309',
    primaryFg: '#FFFFFF',
    primaryText: '#8A3F06',
    primaryTint: '#F6E6D2',
    accent: '#D97706',
    accentFg: '#FFFFFF',
    accentText: '#92400E',
    accentTint: '#FEF3C7',
    ring: '#B45309',
    darkPrimary: '#F59E0B',
    darkPrimaryFg: '#271402',
    darkPrimaryText: '#FCD34D',
    darkPrimaryTint: '#3A2308',
  },
  indigo: {
    label: 'بابل (نيلي)',
    swatch: '#4338CA',
    primary: '#4338CA',
    primaryFg: '#FFFFFF',
    primaryText: '#3730A3',
    primaryTint: '#E0E7FF',
    accent: '#6366F1',
    accentFg: '#FFFFFF',
    accentText: '#4338CA',
    accentTint: '#EEF2FF',
    ring: '#4338CA',
    darkPrimary: '#818CF8',
    darkPrimaryFg: '#0F1035',
    darkPrimaryText: '#A5B4FC',
    darkPrimaryTint: '#1E1B4B',
  },
  green: {
    label: 'النخيل (أخضر)',
    swatch: '#15803D',
    primary: '#15803D',
    primaryFg: '#FFFFFF',
    primaryText: '#14532D',
    primaryTint: '#DCFCE7',
    accent: '#16A34A',
    accentFg: '#FFFFFF',
    accentText: '#15803D',
    accentTint: '#ECFDF5',
    ring: '#15803D',
    darkPrimary: '#4ADE80',
    darkPrimaryFg: '#052E16',
    darkPrimaryText: '#86EFAC',
    darkPrimaryTint: '#0D2E1A',
  },
  rose: {
    label: 'الورد البغدادي',
    swatch: '#BE123C',
    primary: '#BE123C',
    primaryFg: '#FFFFFF',
    primaryText: '#9F1239',
    primaryTint: '#FFE4E6',
    accent: '#E11D48',
    accentFg: '#FFFFFF',
    accentText: '#BE123C',
    accentTint: '#FFF1F2',
    ring: '#BE123C',
    darkPrimary: '#FB7185',
    darkPrimaryFg: '#3B0613',
    darkPrimaryText: '#FDA4AF',
    darkPrimaryTint: '#3D101B',
  },
  violet: {
    label: 'أرجواني ليلي',
    swatch: '#6D28D9',
    primary: '#6D28D9',
    primaryFg: '#FFFFFF',
    primaryText: '#5B21B6',
    primaryTint: '#EDE9FE',
    accent: '#8B5CF6',
    accentFg: '#FFFFFF',
    accentText: '#6D28D9',
    accentTint: '#F5F3FF',
    ring: '#6D28D9',
    darkPrimary: '#A78BFA',
    darkPrimaryFg: '#1E0B4B',
    darkPrimaryText: '#C4B5FD',
    darkPrimaryTint: '#2A184D',
  },
  slate: {
    label: 'رخامي داكن',
    swatch: '#334155',
    primary: '#334155',
    primaryFg: '#FFFFFF',
    primaryText: '#1E293B',
    primaryTint: '#E2E8F0',
    accent: '#475569',
    accentFg: '#FFFFFF',
    accentText: '#334155',
    accentTint: '#F1F5F9',
    ring: '#334155',
    darkPrimary: '#94A3B8',
    darkPrimaryFg: '#0F172A',
    darkPrimaryText: '#CBD5E1',
    darkPrimaryTint: '#1E293B',
  },
  gold: {
    label: 'ذهب سومري',
    swatch: '#A16207',
    primary: '#A16207',
    primaryFg: '#FFFFFF',
    primaryText: '#713F12',
    primaryTint: '#FEF9C3',
    accent: '#CA8A04',
    accentFg: '#FFFFFF',
    accentText: '#854D0E',
    accentTint: '#FEFCE8',
    ring: '#A16207',
    darkPrimary: '#FACC15',
    darkPrimaryFg: '#281B00',
    darkPrimaryText: '#FDE047',
    darkPrimaryTint: '#362705',
  },
};

export interface PresetMeta {
  label: string;
  description: string;
  isDarkSurface: boolean;
  swatchBg: string;
  swatchFg: string;
}

export const PRESET_META: Record<CanvasPresetKey, PresetMeta> = {
  sand: {
    label: 'رمال الرافدين',
    description: 'دفء رملي كلاسيكي بتفاصيل تراثية',
    isDarkSurface: false,
    swatchBg: '#FAF6EE',
    swatchFg: '#3B2F24',
  },
  dijlah: {
    label: 'دجلة الصباح',
    description: 'لمسة نهرية صافية بألوان مائية هادئة',
    isDarkSurface: false,
    swatchBg: '#F0F9FB',
    swatchFg: '#0F2E36',
  },
  palm: {
    label: 'نخيل البصرة',
    description: 'هدوء أخضر طبيعي مستوحى من البساتين',
    isDarkSurface: false,
    swatchBg: '#F1F9F3',
    swatchFg: '#14331E',
  },
  'baghdad-night': {
    label: 'بغداد ليلاً',
    description: 'واجهة ليلية فاخرة بتوهّج دافئ',
    isDarkSurface: true,
    swatchBg: '#0B1220',
    swatchFg: '#F1F5F9',
  },
  glass: {
    label: 'زجاج شناشيل',
    description: 'شفافية زجاجية ناعمة وإطارات مضيئة',
    isDarkSurface: false,
    swatchBg: '#F6FAFC',
    swatchFg: '#1E293B',
  },
  editorial: {
    label: 'المجلة البغدادية',
    description: 'تنسيق تحريري متزن مخصص للكتابة والمقالات',
    isDarkSurface: false,
    swatchBg: '#FAF8F4',
    swatchFg: '#26211C',
  },
  retro90: {
    label: 'ريترو التسعينات',
    description: 'إطارات بارزة ولمسة حنين كلاسيكية',
    isDarkSurface: false,
    swatchBg: '#FFFDF5',
    swatchFg: '#1F1B18',
  },
  gallery: {
    label: 'معرض الفنان',
    description: 'مساحة نظيفة تبرز الأعمال والصور بوضوح',
    isDarkSurface: false,
    swatchBg: '#F8FAFC',
    swatchFg: '#18181B',
  },
  merchant: {
    label: 'المتجر الأصيل',
    description: 'مصمم لعرض السلع والثقة التجارية',
    isDarkSurface: false,
    swatchBg: '#FDF9F3',
    swatchFg: '#2B2118',
  },
  streamer: {
    label: 'منصة البث',
    description: 'تباين ليلي جريء لصنّاع الفيديو والبث',
    isDarkSurface: true,
    swatchBg: '#120F24',
    swatchFg: '#F5F3FF',
  },
  poet: {
    label: 'مجلس الشعراء',
    description: 'حروف نسخية وأجواء أدبية رصينة',
    isDarkSurface: false,
    swatchBg: '#FCF9F2',
    swatchFg: '#2B2318',
  },
  tech: {
    label: 'واحة التقني',
    description: 'شبكة منظمة دقيقة للمطورين والمختصين',
    isDarkSurface: false,
    swatchBg: '#F4F7FA',
    swatchFg: '#0F172A',
  },
};

export const FONT_STACKS: Record<CanvasFontKey, { label: string; cssFamily: string }> = {
  cairo: {
    label: 'Cairo قياسي',
    cssFamily: "'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  'reem-kufi': {
    label: 'Reem Kufi كوفي',
    cssFamily: "'Reem Kufi', 'Cairo', system-ui, sans-serif",
  },
  'noto-naskh': {
    label: 'Noto Naskh نسخ',
    cssFamily: "'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', Georgia, serif",
  },
};

export const LAYOUT_META: Record<CanvasLayoutKey, { label: string; hint: string }> = {
  editorial: { label: 'تحريري متمركز', hint: 'هوية متمركزة مع تركيز على النصوص' },
  modern: { label: 'عصري متوازن', hint: 'بطاقة متوازنة للصور والمنشورات' },
  compact: { label: 'مضغوط سريع', hint: 'مساحات مكثفة وعرض مباشر' },
  showcase: { label: 'معرض بصري', hint: 'غلاف بارز وشبكة وسائط واسعة' },
};

export const BLOCK_LABELS: Record<CanvasBlockType, string> = {
  cover: 'صورة الغلاف (Cover)',
  identity: 'الهوية والاسم الرمزي (Identity)',
  bio: 'النبذة التعريفية (Bio)',
  stats: 'شريط الإحصائيات (Stats)',
  badges: 'شارات الإنجاز والتوثيق (Badges)',
  'pinned-post': 'المنشور المثبت (Pinned Post)',
  links: 'الروابط المخصصة (Links)',
  'music-widget': 'أداة المقطوعة الموسيقية (Music)',
  'shop-strip': 'شريط منتجات المتجر (Shop Strip)',
  'posts-grid': 'شبكة المنشورات (Posts Grid)',
};

export const MAQAM_SCALES: Record<CanvasMaqamKey, { label: string; freqs: number[] }> = {
  lami: { label: 'مقام اللامي', freqs: [293.66, 329.63, 369.99, 440, 392, 329.63] },
  hijaz: { label: 'مقام الحجاز', freqs: [293.66, 311.13, 369.99, 392, 440, 369.99] },
  bayat: { label: 'مقام البيات', freqs: [293.66, 319.5, 349.23, 392, 440, 349.23] },
  saba: { label: 'مقام الصبا', freqs: [293.66, 319.5, 349.23, 369.99, 440, 349.23] },
};

export const SURFACE_STYLE_META: Record<CanvasSurfaceStyle, { label: string; hint: string }> = {
  clean: { label: 'قياسي صافي', hint: 'بطاقات متوازنة بحدود هادئة' },
  glass: { label: 'زجاجي (Glass)', hint: 'شفافية ضبابية ولمعة زجاجية' },
  glow: { label: 'توهّج ناعم (Glow)', hint: 'هالة ضوئية حول البطاقات' },
  'editorial-frame': { label: 'إطار مجلة', hint: 'خطوط رفيعة وهندسة تحريرية' },
  bento: { label: 'بطاقات Bento', hint: 'تقسيم معماري مريح بزوايا واسعة' },
};

export const BACKDROP_MODE_META: Record<CanvasBackdropMode, { label: string }> = {
  standard: { label: 'افتراضي' },
  mesh: { label: 'تدرّج شبكي (Mesh)' },
  shanasheel: { label: 'نقش شناشيل' },
  aurora: { label: 'شفق متحرك (Aurora)' },
};

export const AVATAR_FRAME_META: Record<CanvasAvatarFrame, { label: string }> = {
  none: { label: 'عادي' },
  ring: { label: 'حلقة مزدوجة' },
  'lapis-gold': { label: 'لازورد وذهب' },
  'neon-glow': { label: 'هالة مضيئة' },
  squircle: { label: 'مربع منحني (Bento)' },
};

export const GRID_STYLE_META: Record<CanvasGridStyle, { label: string }> = {
  classic: { label: 'شبكة ٣×٣' },
  bento: { label: 'عرض Bento' },
  'masonry-cards': { label: 'بطاقات معرض ٢×٢' },
};

export const CURATED_WOW_LOOKS: Array<{
  id: string;
  label: string;
  subtitle: string;
  swatchGradient: string;
  build: (base: ProfileCanvasConfig) => ProfileCanvasConfig;
}> = [
  {
    id: 'bento-baghdad',
    label: 'بنتو بغداد الليلي',
    subtitle: 'شبكة Bento · شفق متحرك · لازورد وذهب',
    swatchGradient: 'linear-gradient(135deg, #0B1220 0%, #1E3A8A 55%, #FACC15 100%)',
    build: (): ProfileCanvasConfig => ({
      schemaVersion: 1,
      name: 'بنتو بغداد الليلي',
      theme: { preset: 'baghdad-night', accent: 'gold', background: 'gradient', font: 'reem-kufi' },
      layout: 'showcase',
      motion: { preset: 'smooth', intensity: 1 },
      blocks: [
        {
          type: 'cover',
          visible: true,
          settings: { surfaceStyle: 'bento', backdropMode: 'aurora' },
        },
        {
          type: 'identity',
          visible: true,
          settings: { avatarFrame: 'lapis-gold', statusBadge: 'بغداد · تصميم Bento' },
        },
        { type: 'bio', visible: true },
        { type: 'badges', visible: true },
        { type: 'stats', visible: true },
        { type: 'pinned-post', visible: true },
        { type: 'links', visible: true },
        { type: 'music-widget', visible: true, settings: { maqam: 'lami' } },
        { type: 'posts-grid', visible: true, settings: { gridStyle: 'bento' } },
      ],
    }),
  },
  {
    id: 'dijlah-glass',
    label: 'زجاج دجلة المضيء',
    subtitle: 'زجاج شناشيل · Mesh مائي · توهّج تركواز',
    swatchGradient: 'linear-gradient(135deg, #E0F2FE 0%, #0E7490 60%, #22D3EE 100%)',
    build: (): ProfileCanvasConfig => ({
      schemaVersion: 1,
      name: 'زجاج دجلة المضيء',
      theme: { preset: 'glass', accent: 'teal', background: 'gradient', font: 'cairo' },
      layout: 'modern',
      motion: { preset: 'smooth', intensity: 0.9 },
      blocks: [
        {
          type: 'cover',
          visible: true,
          settings: { surfaceStyle: 'glass', backdropMode: 'mesh' },
        },
        {
          type: 'identity',
          visible: true,
          settings: { avatarFrame: 'neon-glow', statusBadge: 'على ضفاف دجلة' },
        },
        { type: 'bio', visible: true },
        { type: 'stats', visible: true },
        { type: 'links', visible: true },
        { type: 'pinned-post', visible: true },
        { type: 'posts-grid', visible: true, settings: { gridStyle: 'masonry-cards' } },
      ],
    }),
  },
  {
    id: 'shanasheel-heritage',
    label: 'شناشيل الذهب والنحاس',
    subtitle: 'نقش شناشيل تراثي · إطار مجلة · خط النسخ',
    swatchGradient: 'linear-gradient(135deg, #FAF6EE 0%, #B45309 65%, #713F12 100%)',
    build: (): ProfileCanvasConfig => ({
      schemaVersion: 1,
      name: 'شناشيل الذهب والنحاس',
      theme: { preset: 'poet', accent: 'copper', background: 'pattern', font: 'noto-naskh' },
      layout: 'editorial',
      motion: { preset: 'gentle', intensity: 0.7 },
      blocks: [
        {
          type: 'cover',
          visible: true,
          settings: { surfaceStyle: 'editorial-frame', backdropMode: 'shanasheel' },
        },
        {
          type: 'identity',
          visible: true,
          settings: { avatarFrame: 'lapis-gold', statusBadge: 'تراث وكتابة' },
        },
        { type: 'bio', visible: true },
        { type: 'pinned-post', visible: true },
        { type: 'stats', visible: true },
        { type: 'links', visible: true },
        { type: 'posts-grid', visible: true, settings: { gridStyle: 'bento' } },
      ],
    }),
  },
];

export function extractCanvasVisualEffects(
  config: ProfileCanvasConfig | null | undefined
): CanvasVisualEffects {
  if (!config) {
    return {
      surfaceStyle: 'clean',
      backdropMode: 'standard',
      avatarFrame: 'none',
      gridStyle: 'classic',
      statusBadge: null,
    };
  }
  const coverSettings = config.blocks.find((b) => b.type === 'cover')?.settings;
  const idSettings = config.blocks.find((b) => b.type === 'identity')?.settings;
  const gridSettings = config.blocks.find((b) => b.type === 'posts-grid')?.settings;

  const rawSurface = coverSettings?.surfaceStyle;
  const surfaceStyle: CanvasSurfaceStyle =
    rawSurface === 'glass' ||
    rawSurface === 'glow' ||
    rawSurface === 'editorial-frame' ||
    rawSurface === 'bento' ||
    rawSurface === 'clean'
      ? rawSurface
      : config.theme.preset === 'glass'
      ? 'glass'
      : config.theme.preset === 'editorial' || config.theme.preset === 'poet'
      ? 'editorial-frame'
      : 'clean';

  const rawBackdrop = coverSettings?.backdropMode;
  const backdropMode: CanvasBackdropMode =
    rawBackdrop === 'mesh' ||
    rawBackdrop === 'shanasheel' ||
    rawBackdrop === 'aurora' ||
    rawBackdrop === 'standard'
      ? rawBackdrop
      : 'standard';

  const rawFrame = idSettings?.avatarFrame;
  const avatarFrame: CanvasAvatarFrame =
    rawFrame === 'ring' ||
    rawFrame === 'lapis-gold' ||
    rawFrame === 'neon-glow' ||
    rawFrame === 'squircle' ||
    rawFrame === 'none'
      ? rawFrame
      : 'none';

  const rawGrid = gridSettings?.gridStyle;
  const gridStyle: CanvasGridStyle =
    rawGrid === 'bento' || rawGrid === 'masonry-cards' || rawGrid === 'classic'
      ? rawGrid
      : 'classic';

  const statusBadge =
    typeof idSettings?.statusBadge === 'string' && idSettings.statusBadge.trim()
      ? idSettings.statusBadge.trim()
      : null;

  return { surfaceStyle, backdropMode, avatarFrame, gridStyle, statusBadge };
}

export function getAvatarFrameVisuals(frame: CanvasAvatarFrame): {
  wrapperClass: string;
  wrapperStyle?: CSSProperties;
  isSquircle: boolean;
} {
  switch (frame) {
    case 'ring':
      return {
        wrapperClass: 'p-[3px] rounded-full bg-[var(--surface)] ring-2 ring-[var(--primary)] shadow-md',
        isSquircle: false,
      };
    case 'lapis-gold':
      return {
        wrapperClass: 'p-[4px] rounded-full shadow-lg',
        wrapperStyle: {
          background: 'linear-gradient(135deg, #1E4D8C 0%, #D9A21B 52%, #FACC15 100%)',
        },
        isSquircle: false,
      };
    case 'neon-glow':
      return {
        wrapperClass: 'p-[3px] rounded-full bg-[var(--primary)]',
        wrapperStyle: {
          boxShadow: '0 0 0 2px var(--surface), 0 0 22px var(--primary)',
        },
        isSquircle: false,
      };
    case 'squircle':
      return {
        wrapperClass: 'p-[3px] rounded-2xl bg-[var(--surface)] ring-2 ring-[var(--primary)] shadow-md',
        isSquircle: true,
      };
    default:
      return {
        wrapperClass: '',
        isSquircle: false,
      };
  }
}

export interface CanvasResolvedAppearance {
  style: CSSProperties;
  containerClass: string;
  coverAspectClass: string;
  cardClass: string;
  isDarkPreset: boolean;
  isEditorial: boolean;
  isCompact: boolean;
  isShowcase: boolean;
  motionClass: string;
  effects: CanvasVisualEffects;
  avatarFrameVisuals: ReturnType<typeof getAvatarFrameVisuals>;
}

export function resolveCanvasAppearance(config: ProfileCanvasConfig | null | undefined): CanvasResolvedAppearance {
  const defaultEffects = extractCanvasVisualEffects(config);
  if (!config) {
    return {
      style: {},
      containerClass: 'bg-[var(--surface)] border-[var(--border)]',
      coverAspectClass: 'aspect-[3/1]',
      cardClass: 'bg-[var(--surface-2)] border border-[var(--border)]',
      isDarkPreset: false,
      isEditorial: false,
      isCompact: false,
      isShowcase: false,
      motionClass: '',
      effects: defaultEffects,
      avatarFrameVisuals: getAvatarFrameVisuals('none'),
    };
  }

  const palette = ACCENT_PALETTES[config.theme.accent] ?? ACCENT_PALETTES.teal;
  const presetMeta = PRESET_META[config.theme.preset] ?? PRESET_META.sand;
  const isDarkPreset = presetMeta.isDarkSurface;

  const surfaceVars: Record<string, string> = isDarkPreset
    ? {
        '--surface': config.theme.preset === 'streamer' ? '#120F24' : '#0B1220',
        '--surface-2':
          defaultEffects.surfaceStyle === 'glass'
            ? 'rgba(20, 30, 48, 0.72)'
            : config.theme.preset === 'streamer'
            ? '#1D1838'
            : '#141E30',
        '--border': config.theme.preset === 'streamer' ? '#312A58' : '#26344B',
        '--border-strong': config.theme.preset === 'streamer' ? '#4C4285' : '#415575',
        '--text': '#F1F5F9',
        '--text-muted': '#B4C1D4',
        '--primary': palette.darkPrimary,
        '--primary-fg': palette.darkPrimaryFg,
        '--primary-text': palette.darkPrimaryText,
        '--primary-tint': palette.darkPrimaryTint,
        '--accent': palette.primary,
        '--accent-fg': palette.primaryFg,
        '--accent-text': palette.darkPrimaryText,
        '--accent-tint': palette.darkPrimaryTint,
        '--ring': palette.darkPrimary,
        '--cover-bg': `linear-gradient(135deg, #0F172A 0%, ${palette.primary} 55%, ${palette.darkPrimary} 100%)`,
      }
    : {
        '--surface': presetMeta.swatchBg,
        '--surface-2':
          defaultEffects.surfaceStyle === 'glass' || config.theme.preset === 'glass'
            ? 'rgba(255, 255, 255, 0.74)'
            : config.theme.preset === 'retro90'
            ? '#FFF6DE'
            : '#F3EFE8',
        '--border': config.theme.preset === 'retro90' ? '#2B241E' : '#E2DBD0',
        '--border-strong': config.theme.preset === 'retro90' ? '#1C1917' : '#857A6B',
        '--text': presetMeta.swatchFg,
        '--text-muted': '#57534E',
        '--primary': palette.primary,
        '--primary-fg': palette.primaryFg,
        '--primary-text': palette.primaryText,
        '--primary-tint': palette.primaryTint,
        '--accent': palette.accent,
        '--accent-fg': palette.accentFg,
        '--accent-text': palette.accentText,
        '--accent-tint': palette.accentTint,
        '--ring': palette.ring,
        '--cover-bg': `linear-gradient(135deg, ${palette.primary} 0%, ${palette.accent} 65%, ${palette.primaryTint} 100%)`,
      };

  // Rich pure-CSS backdrops: backdropMode takes precedence, falling back to theme.background
  let backgroundImage = 'none';
  let backgroundSize: string | undefined;
  let auroraClass = '';

  if (defaultEffects.backdropMode === 'aurora') {
    const a1 = isDarkPreset ? 'rgba(99, 102, 241, 0.28)' : `${palette.primary}29`;
    const a2 = isDarkPreset ? 'rgba(250, 204, 21, 0.16)' : `${palette.accent}24`;
    const a3 = isDarkPreset ? 'rgba(34, 211, 238, 0.20)' : `${palette.primary}18`;
    backgroundImage = `linear-gradient(120deg, ${a1} 0%, ${a2} 48%, ${a3} 100%)`;
    backgroundSize = '200% 200%';
    if (config.motion.preset !== 'none' && config.motion.intensity > 0) {
      auroraClass = 'tw-canvas-aurora';
    }
  } else if (defaultEffects.backdropMode === 'mesh') {
    const m1 = isDarkPreset ? 'rgba(56, 189, 248, 0.22)' : `${palette.primary}26`;
    const m2 = isDarkPreset ? 'rgba(168, 85, 247, 0.20)' : `${palette.accent}22`;
    const m3 = isDarkPreset ? 'rgba(250, 204, 21, 0.14)' : `${palette.primary}14`;
    backgroundImage = `radial-gradient(at 15% 15%, ${m1} 0px, transparent 52%), radial-gradient(at 85% 20%, ${m2} 0px, transparent 50%), radial-gradient(at 50% 88%, ${m3} 0px, transparent 55%)`;
  } else if (defaultEffects.backdropMode === 'shanasheel' || config.theme.background === 'pattern') {
    const lineColor = isDarkPreset ? 'rgba(255, 255, 255, 0.065)' : `${palette.primary}15`;
    const dotColor = isDarkPreset ? 'rgba(250, 204, 21, 0.12)' : `${palette.accent}1B`;
    backgroundImage = `radial-gradient(${dotColor} 1.35px, transparent 1.35px), linear-gradient(135deg, ${lineColor} 25%, transparent 25%, transparent 50%, ${lineColor} 50%, ${lineColor} 75%, transparent 75%, transparent)`;
    backgroundSize = '18px 18px, 36px 36px';
  } else if (config.theme.background === 'gradient') {
    const glowA = isDarkPreset ? 'rgba(99, 102, 241, 0.22)' : `${palette.primary}1F`;
    const glowB = isDarkPreset ? 'rgba(34, 211, 238, 0.14)' : `${palette.accent}1A`;
    backgroundImage = `radial-gradient(circle at 12% 8%, ${glowA} 0%, transparent 45%), radial-gradient(circle at 88% 22%, ${glowB} 0%, transparent 48%), linear-gradient(180deg, ${surfaceVars['--surface']} 0%, ${isDarkPreset ? '#070B14' : '#FFFFFF'} 100%)`;
  }

  const fontStack = FONT_STACKS[config.theme.font]?.cssFamily ?? FONT_STACKS.cairo.cssFamily;
  const isEditorial = config.layout === 'editorial';
  const isCompact = config.layout === 'compact';
  const isShowcase = config.layout === 'showcase';

  const presetBorder =
    config.theme.preset === 'retro90'
      ? 'border-2 border-[var(--border)] shadow-[4px_4px_0_0_var(--border)]'
      : defaultEffects.surfaceStyle === 'glass'
      ? 'backdrop-blur-md border border-[var(--border)] shadow-lg'
      : defaultEffects.surfaceStyle === 'glow'
      ? 'border border-[var(--primary)]/35 shadow-xl'
      : 'border border-[var(--border)]';

  const motionClass =
    config.motion.preset === 'none' || config.motion.intensity <= 0
      ? 'motion-reduce:transition-none'
      : config.motion.preset === 'smooth'
      ? 'transition-all duration-500 ease-out'
      : config.motion.preset === 'gentle'
      ? 'transition-all duration-300 ease-in-out'
      : 'transition-colors duration-200';

  const cardClass =
    config.theme.preset === 'retro90'
      ? 'bg-[var(--surface-2)] border-2 border-[var(--border)]'
      : defaultEffects.surfaceStyle === 'glass'
      ? 'bg-[var(--surface-2)] backdrop-blur-md border border-[var(--border)] shadow-sm'
      : defaultEffects.surfaceStyle === 'glow'
      ? 'bg-[var(--surface-2)] border border-[var(--primary)]/35 shadow-[0_6px_24px_-8px_var(--primary)]'
      : defaultEffects.surfaceStyle === 'bento'
      ? 'bg-[var(--surface-2)] border border-[var(--border)] rounded-3xl shadow-xs'
      : defaultEffects.surfaceStyle === 'editorial-frame'
      ? 'bg-[var(--surface-2)] border border-[var(--border-strong)]/40 rounded-xl'
      : 'bg-[var(--surface-2)] border border-[var(--border)]';

  const style: CSSProperties = {
    ...(surfaceVars as CSSProperties),
    fontFamily: fontStack,
    backgroundColor: surfaceVars['--surface'],
    color: surfaceVars['--text'],
    backgroundImage,
    ...(backgroundSize ? { backgroundSize } : {}),
  };

  return {
    style,
    containerClass: `${presetBorder} ${motionClass} ${auroraClass}`.trim(),
    coverAspectClass: isShowcase
      ? 'aspect-[2.2/1]'
      : isCompact
      ? 'aspect-[3.6/1]'
      : isEditorial
      ? 'aspect-[2.5/1]'
      : 'aspect-[3/1]',
    cardClass,
    isDarkPreset,
    isEditorial,
    isCompact,
    isShowcase,
    motionClass,
    effects: defaultEffects,
    avatarFrameVisuals: getAvatarFrameVisuals(defaultEffects.avatarFrame),
  };
}

/**
 * Ensures all 10 allowed block types are present for editing while preserving existing order & settings.
 */
export function mergeAllCanvasBlocks(blocks: CanvasBlockConfig[]): CanvasBlockConfig[] {
  const result: CanvasBlockConfig[] = blocks.map((b) => ({
    ...b,
    settings: b.settings ? { ...b.settings } : undefined,
  }));
  const present = new Set(result.map((b) => b.type));
  for (const type of ALLOWED_BLOCK_TYPES) {
    if (!present.has(type)) {
      result.push({ type, visible: false });
    }
  }
  return result;
}

export function reorderCanvasBlocks(
  blocks: CanvasBlockConfig[],
  index: number,
  direction: 'up' | 'down'
): CanvasBlockConfig[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= blocks.length || targetIndex < 0 || targetIndex >= blocks.length) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(index, 1);
  if (!moved) return blocks;
  next.splice(targetIndex, 0, moved);
  return next;
}

export function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface CanvasCustomLink {
  title: string;
  url: string;
}

export function extractCanvasLinks(config: ProfileCanvasConfig | null | undefined): CanvasCustomLink[] {
  if (!config) return [];
  const linksBlock = config.blocks.find((b) => b.type === 'links');
  const settings = linksBlock?.settings;
  const extracted: CanvasCustomLink[] = [];
  if (settings) {
    for (let i = 1; i <= 3; i += 1) {
      const title = settings[`title${i}`];
      const url = settings[`url${i}`];
      if (isSafeHttpUrl(url)) {
        extracted.push({
          title: typeof title === 'string' && title.trim() ? title.trim() : `رابط ${i}`,
          url: url.trim(),
        });
      }
    }
  }
  return extracted;
}

export function getCanvasPinnedContent(config: ProfileCanvasConfig | null | undefined): {
  badge: string;
  note: string | null;
} {
  const block = config?.blocks.find((b) => b.type === 'pinned-post');
  const badge =
    typeof block?.settings?.badge === 'string' && block.settings.badge.trim()
      ? block.settings.badge.trim()
      : 'منشور مثبت في الواجهة';
  const note =
    typeof block?.settings?.note === 'string' && block.settings.note.trim()
      ? block.settings.note.trim()
      : null;
  return { badge, note };
}

export function getCanvasMusicContent(config: ProfileCanvasConfig | null | undefined): {
  trackTitle: string;
  maqam: CanvasMaqamKey;
} {
  const block = config?.blocks.find((b) => b.type === 'music-widget');
  const rawMaqam = block?.settings?.maqam;
  const maqam: CanvasMaqamKey =
    rawMaqam === 'hijaz' || rawMaqam === 'bayat' || rawMaqam === 'saba' || rawMaqam === 'lami'
      ? rawMaqam
      : 'lami';
  const trackTitle =
    typeof block?.settings?.trackTitle === 'string' && block.settings.trackTitle.trim()
      ? block.settings.trackTitle.trim()
      : `${MAQAM_SCALES[maqam].label} — نغمة الملف`;
  return { trackTitle, maqam };
}

/**
 * Formats a ProfileCanvasConfig into a clean human-readable YAML-style declarative DSL.
 */
export function serializeCanvasToDsl(config: ProfileCanvasConfig): string {
  const visibleBlocks = config.blocks
    .filter((b) => b.visible)
    .map((b) => b.type)
    .join(', ');
  const effects = extractCanvasVisualEffects(config);
  const lines = [
    `name: ${config.name}`,
    `preset: ${config.theme.preset}`,
    `accent: ${config.theme.accent}`,
    `background: ${config.theme.background}`,
    `surface: ${effects.surfaceStyle}`,
    `backdrop: ${effects.backdropMode}`,
    `avatarFrame: ${effects.avatarFrame}`,
    `grid: ${effects.gridStyle}`,
    `font: ${config.theme.font}`,
    `layout: ${config.layout}`,
    `motion: ${config.motion.preset}`,
    `blocks: ${visibleBlocks}`,
  ];
  if (effects.statusBadge) {
    lines.push(`badge: ${effects.statusBadge}`);
  }
  const links = extractCanvasLinks(config);
  links.forEach((l, idx) => {
    lines.push(`link${idx + 1}: ${l.title} | ${l.url}`);
  });
  const pinned = getCanvasPinnedContent(config);
  if (pinned.note) {
    lines.push(`note: ${pinned.note}`);
  }
  const music = getCanvasMusicContent(config);
  lines.push(`maqam: ${music.maqam}`);
  return lines.join('\n');
}

/**
 * Accepts EITHER strict JSON OR readable key: value declarative DSL,
 * compiling strictly through validateCanvasJson so unsafe HTML/JS/HTMX can never pass.
 */
export function parseSafeCanvasDslOrJson(
  rawText: string,
  baseConfig: ProfileCanvasConfig = CANVAS_TEMPLATES[0]!
): { valid: boolean; errors: string[]; config?: ProfileCanvasConfig } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, errors: ['أدخل صيغة JSON أو أوامر التنسيق النصية أولاً.'] };
  }

  const unfenced = trimmed
    .replace(/^```(?:json|yaml|yml|css|dsl)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (/<\/?[a-z][^>]*>|hx-[a-z-]+=/i.test(unfenced)) {
    return {
      valid: false,
      errors: [
        'لأمان الزوّار، لا يُسمح بإدخال وسوم HTML أو خصائص HTMX مباشرة. استخدم أوامر التنسيق الآمنة (preset, accent, surface, backdrop, avatarFrame, grid, layout, font, blocks, link1) أو JSON المعتمد.',
      ],
    };
  }

  if (unfenced.startsWith('{') || unfenced.startsWith('[')) {
    try {
      const parsed = JSON.parse(unfenced);
      return validateCanvasJson(parsed);
    } catch {
      return { valid: false, errors: ['تعذر قراءة كائن JSON — تأكد من الأقواس والفواصل.'] };
    }
  }

  const draft: ProfileCanvasConfig = structuredClone(baseConfig);
  draft.blocks = mergeAllCanvasBlocks(draft.blocks);
  const ensureBlock = (bType: CanvasBlockType, makeVisible = true) => {
    let found = draft.blocks.find((b) => b.type === bType);
    if (!found) {
      found = { type: bType, visible: makeVisible, settings: {} };
      draft.blocks.push(found);
    }
    if (makeVisible) found.visible = true;
    found.settings = found.settings ?? {};
    return found;
  };

  const lines = unfenced.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) {
    return { valid: false, errors: ['لم يتم العثور على إعدادات صالحة.'] };
  }

  let matchedAnyKey = false;
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) {
      return { valid: false, errors: [`سطر غير مفهوم: "${line}" — الصيغة الصحيحة هي المفتاح: القيمة`] };
    }
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    matchedAnyKey = true;

    if (key === 'name' || key === 'الاسم') {
      draft.name = val;
    } else if (key === 'preset' || key === 'النمط' || key === 'theme') {
      draft.theme.preset = val as CanvasPresetKey;
    } else if (key === 'accent' || key === 'اللون') {
      draft.theme.accent = val as CanvasAccentKey;
    } else if (key === 'background' || key === 'bg' || key === 'الخلفية') {
      draft.theme.background = val as 'surface' | 'gradient' | 'pattern';
    } else if (key === 'surface' || key === 'البطاقات') {
      if (!(val in SURFACE_STYLE_META)) {
        return { valid: false, errors: [`نمط السطح "${val}" غير مدعوم (المسموح: clean, glass, glow, editorial-frame, bento).`] };
      }
      const cover = ensureBlock('cover');
      cover.settings!.surfaceStyle = val;
    } else if (key === 'backdrop' || key === 'المشهد') {
      if (!(val in BACKDROP_MODE_META)) {
        return { valid: false, errors: [`نمط الخلفية "${val}" غير مدعوم (المسموح: standard, mesh, shanasheel, aurora).`] };
      }
      const cover = ensureBlock('cover');
      cover.settings!.backdropMode = val;
    } else if (key === 'avatarframe' || key === 'frame' || key === 'الاطار') {
      if (!(val in AVATAR_FRAME_META)) {
        return { valid: false, errors: [`إطار الصورة "${val}" غير مدعوم (المسموح: none, ring, lapis-gold, neon-glow, squircle).`] };
      }
      const identity = ensureBlock('identity');
      identity.settings!.avatarFrame = val;
    } else if (key === 'badge' || key === 'الحالة') {
      const identity = ensureBlock('identity');
      if (val) {
        identity.settings!.statusBadge = val;
      } else {
        delete identity.settings!.statusBadge;
      }
    } else if (key === 'grid' || key === 'الشبكة') {
      if (!(val in GRID_STYLE_META)) {
        return { valid: false, errors: [`نمط الشبكة "${val}" غير مدعوم (المسموح: classic, bento, masonry-cards).`] };
      }
      const grid = ensureBlock('posts-grid');
      grid.settings!.gridStyle = val;
    } else if (key === 'font' || key === 'الخط') {
      draft.theme.font = val as CanvasFontKey;
    } else if (key === 'layout' || key === 'التخطيط') {
      draft.layout = val as CanvasLayoutKey;
    } else if (key === 'motion' || key === 'الحركة') {
      draft.motion.preset = val as ProfileCanvasConfig['motion']['preset'];
    } else if (key === 'blocks' || key === 'العناصر') {
      const blockMap = new Map<CanvasBlockType, CanvasBlockConfig>(
        draft.blocks.map((b) => [b.type, b])
      );
      const requested = val
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const nextBlocks: CanvasBlockConfig[] = [];
      const seen = new Set<string>();
      for (const reqType of requested) {
        if ((ALLOWED_BLOCK_TYPES as readonly string[]).includes(reqType) && !seen.has(reqType)) {
          const existing = blockMap.get(reqType as CanvasBlockType);
          nextBlocks.push({ ...(existing ?? { type: reqType as CanvasBlockType }), visible: true });
          seen.add(reqType);
        } else {
          return { valid: false, errors: [`اسم عنصر غير معتمد في blocks: ${reqType}`] };
        }
      }
      if (nextBlocks.length === 0) {
        return { valid: false, errors: ['يجب تفعيل عنصر واحد على الأقل في blocks.'] };
      }
      for (const [bType, bCfg] of blockMap.entries()) {
        if (!seen.has(bType)) {
          nextBlocks.push({ ...bCfg, visible: false });
        }
      }
      draft.blocks = nextBlocks;
    } else if (key === 'link1' || key === 'link2' || key === 'link3') {
      const idx = key.slice(-1);
      const parts = val.split('|').map((s) => s.trim());
      const urlPart = parts.length > 1 ? parts[1]! : parts[0]!;
      const titlePart = parts.length > 1 && parts[0] ? parts[0] : `رابط ${idx}`;
      if (!isSafeHttpUrl(urlPart)) {
        return { valid: false, errors: [`رابط غير صالح في ${key}: يجب أن يبدأ بـ https:// أو http://`] };
      }
      const linksBlock = ensureBlock('links');
      linksBlock.settings![`title${idx}`] = titlePart;
      linksBlock.settings![`url${idx}`] = urlPart;
    } else if (key === 'note' || key === 'الملاحظة') {
      const pinnedBlock = ensureBlock('pinned-post');
      pinnedBlock.settings!.note = val;
    } else if (key === 'maqam' || key === 'المقام') {
      const musicBlock = ensureBlock('music-widget');
      musicBlock.settings!.maqam = val;
    } else {
      return { valid: false, errors: [`المفتاح "${key}" غير مدعوم في صيغة التصميم.`] };
    }
  }

  if (!matchedAnyKey) {
    return { valid: false, errors: ['لم يتم العثور على إعدادات صالحة.'] };
  }

  return validateCanvasJson(draft);
}
