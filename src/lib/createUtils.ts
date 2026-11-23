import type { CameraFilterId, CreateMode } from '../types';

export interface CreateModeDef {
  id: CreateMode;
  label: string;
}

// Order from the start side (right in RTL)
export const CREATE_MODES: CreateModeDef[] = [
  { id: 'post', label: 'منشور' },
  { id: 'story', label: 'ستوري' },
  { id: 'instants', label: 'لحظات' },
  { id: 'reel', label: 'ريلز' },
  { id: 'live', label: 'بث مباشر' },
];

export function parseCreateMode(raw: string | null | undefined): CreateMode {
  if (raw === 'post' || raw === 'story' || raw === 'instants' || raw === 'reel' || raw === 'live') {
    return raw;
  }
  return 'story';
}

export interface CameraFilterDef {
  id: CameraFilterId;
  label: string;
  cssFilter: string;
  swatchGradient: string;
}

export const CAMERA_FILTERS: CameraFilterDef[] = [
  {
    id: 'none',
    label: 'بدون',
    cssFilter: 'none',
    swatchGradient: 'linear-gradient(135deg, var(--cam-surface-2), var(--cam-surface))',
  },
  {
    id: 'tigris',
    label: 'دجلة',
    cssFilter: 'hue-rotate(15deg) saturate(1.15) contrast(1.05)',
    swatchGradient: 'linear-gradient(135deg, var(--lapis), var(--primary))',
  },
  {
    id: 'palms',
    label: 'النخيل',
    cssFilter: 'hue-rotate(-14deg) saturate(1.22) brightness(1.02)',
    swatchGradient: 'linear-gradient(135deg, var(--success), var(--primary))',
  },
  {
    id: 'sun',
    label: 'الشمس',
    cssFilter: 'sepia(0.24) saturate(1.32) brightness(1.06)',
    swatchGradient: 'linear-gradient(135deg, var(--gold), var(--accent))',
  },
  {
    id: 'vintage',
    label: 'قديم',
    cssFilter: 'sepia(0.58) contrast(0.95) brightness(0.98)',
    swatchGradient: 'linear-gradient(135deg, var(--accent-text), var(--warning))',
  },
  {
    id: 'baghdad-night',
    label: 'ليل بغداد',
    cssFilter: 'contrast(1.28) brightness(0.86) saturate(1.1)',
    swatchGradient: 'linear-gradient(135deg, var(--cam-bg), var(--lapis))',
  },
];

export function buildPreviewFilterCss(filterId: CameraFilterId, beautyLevel: number): string {
  const base = CAMERA_FILTERS.find((f) => f.id === filterId)?.cssFilter ?? 'none';
  const parts: string[] = [];
  if (base !== 'none') parts.push(base);
  if (beautyLevel > 0) {
    const clamped = Math.max(0, Math.min(100, beautyLevel));
    const blurPx = ((clamped / 100) * 1.2).toFixed(2);
    const bright = (1 + (clamped / 100) * 0.08).toFixed(2);
    parts.push(`blur(${blurPx}px)`, `brightness(${bright})`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export function getCanvasFilterCss(filterId: CameraFilterId, beautyLevel: number): string {
  return buildPreviewFilterCss(filterId, beautyLevel);
}

export interface SeedAudioTrack {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  audioUrl: string;
  notesHz: number[];
}

export const SEED_AUDIO_TRACKS: SeedAudioTrack[] = [
  { id: 'snd-1', title: 'دجلة عند الغروب — راست', artist: 'عود بغدادي', durationSec: 20, audioUrl: '/seed/audio/rast.mp3', notesHz: [293.66, 329.63, 369.99, 440, 392] },
  { id: 'snd-2', title: 'مقام نهاوند حديث', artist: 'فرقة الرشيد', durationSec: 22, audioUrl: '/seed/audio/nahawand.mp3', notesHz: [261.63, 293.66, 311.13, 392, 415.3] },
  { id: 'snd-3', title: 'أهوار الجنوب — بيات', artist: 'تراث بصري', durationSec: 22, audioUrl: '/seed/audio/bayat.mp3', notesHz: [329.63, 349.23, 415.3, 440, 329.63] },
  { id: 'snd-4', title: 'ليالي قلعة أربيل — صبا', artist: 'ألحان كوردستان', durationSec: 20, audioUrl: '/seed/audio/saba.mp3', notesHz: [293.66, 349.23, 392, 440, 523.25] },
  { id: 'snd-5', title: 'إيقاع شارع المتنبي — حجاز', artist: 'نبض العراق', durationSec: 24, audioUrl: '/seed/audio/hijaz.mp3', notesHz: [246.94, 293.66, 369.99, 392, 440] },
  { id: 'snd-6', title: 'نخيل البصرة — سيكا', artist: 'شط العرب', durationSec: 24, audioUrl: '/seed/audio/sikah.mp3', notesHz: [220, 261.63, 329.63, 392, 440] },
];

export const REEL_DURATIONS = [15, 30, 60, 90] as const;
export const REEL_SPEEDS = [0.3, 0.5, 1, 2, 3] as const;
export const TIMER_OPTIONS = [0, 3, 10] as const;
export const LAYOUT_OPTIONS = [
  { id: 'none', label: 'بدون تخطيط' },
  { id: '2x2', label: 'شبكة ٢×٢' },
  { id: '3x1', label: '٣×١ عمودي' },
  { id: '4x4', label: 'شبكة ٤×٤' },
] as const;

export type LayoutGridId = (typeof LAYOUT_OPTIONS)[number]['id'];

export const GREEN_SCREEN_PRESETS = [
  { id: 'none', label: 'بدون خلفية', gradient: '' },
  { id: 'tigris-blue', label: 'أزرق دجلة', gradient: 'linear-gradient(160deg, var(--lapis), var(--primary))' },
  { id: 'basra-palms', label: 'نخيل البصرة', gradient: 'linear-gradient(160deg, var(--success), var(--primary))' },
  { id: 'baghdad-gold', label: 'ذهب بابل', gradient: 'linear-gradient(160deg, var(--accent), var(--gold))' },
] as const;

export interface CameraSettingsPrefs {
  showGrid: boolean;
  highQuality: boolean;
  saveOriginal: boolean;
  beautyUsed: boolean;
  toolsExpanded: boolean;
}

export const CAMERA_SETTINGS_STORAGE_KEY = 'tw.camera.v1';

export const DEFAULT_CAMERA_SETTINGS: CameraSettingsPrefs = {
  showGrid: false,
  highQuality: true,
  saveOriginal: false,
  beautyUsed: false,
  toolsExpanded: false,
};

export function readCameraSettings(): CameraSettingsPrefs {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CAMERA_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CameraSettingsPrefs>;
        return {
          showGrid: Boolean(parsed.showGrid),
          highQuality: parsed.highQuality !== undefined ? Boolean(parsed.highQuality) : true,
          saveOriginal: Boolean(parsed.saveOriginal),
          beautyUsed: Boolean(parsed.beautyUsed),
          toolsExpanded: Boolean(parsed.toolsExpanded),
        };
      }
    }
  } catch {}
  return { ...DEFAULT_CAMERA_SETTINGS };
}

export function writeCameraSettings(next: CameraSettingsPrefs): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CAMERA_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
}

export function pickSupportedVideoMimeType(isSupported: (mime: string) => boolean): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((m) => isSupported(m)) ?? '';
}

export function computeStoryExpiryIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
}

export function clampStoryDurationSec(rawSec: number, mediaType: 'image' | 'video' | 'text'): number {
  if (mediaType !== 'video') return 5;
  return Math.max(1, Math.min(15, Number(rawSec.toFixed(1))));
}

export const IRAQI_LOCATIONS = [
  'بغداد — الكرادة',
  'بغداد — المنصور',
  'بغداد — شارع المتنبي',
  'البصرة — شط العرب',
  'أربيل — القلعة',
  'نينوى — الموصل',
  'النجف الأشرف',
  'كربلاء المقدسة',
  'بابل — الحلة',
  'السليمانية',
  'كركوك',
  'ذي قار — أور',
] as const;

export const TEXT_STORY_GRADIENTS = [
  'linear-gradient(155deg, var(--primary), var(--lapis))',
  'linear-gradient(155deg, var(--accent), var(--gold))',
  'linear-gradient(155deg, var(--cam-surface), var(--primary-text))',
  'linear-gradient(155deg, var(--success), var(--primary))',
] as const;

export const EDITOR_COLOR_TOKENS = [
  { id: 'white', label: 'أبيض', cssVar: 'var(--cam-text)' },
  { id: 'primary', label: 'أساسي', cssVar: 'var(--primary)' },
  { id: 'accent', label: 'نحاسي', cssVar: 'var(--accent)' },
  { id: 'lapis', label: 'لازوردي', cssVar: 'var(--lapis)' },
  { id: 'gold', label: 'ذهبي', cssVar: 'var(--gold)' },
  { id: 'live', label: 'أحمر', cssVar: 'var(--live)' },
] as const;

export const EDITOR_FONT_OPTIONS = [
  { id: 'cairo-bold', label: 'القاهرة عريض', className: 'font-sans font-bold' },
  { id: 'reem-kufi', label: 'كوفي', className: 'font-display font-bold' },
  { id: 'cairo-black', label: 'خط ديواني', className: 'font-sans font-extrabold' },
] as const;

export interface HeritageMotifDef {
  id: string;
  label: string;
}

export const HERITAGE_MOTIFS: HeritageMotifDef[] = [
  { id: 'cuneiform', label: 'مسماري' },
  { id: 'palm', label: 'نخلة' },
  { id: 'date', label: 'تمرة' },
  { id: 'ishtar-arch', label: 'بوابة عشتار' },
  { id: 'malwiya', label: 'الملوية' },
  { id: 'wheel', label: 'العجلة السومرية' },
  { id: 'dallah', label: 'دلة' },
  { id: 'cup', label: 'فنجان' },
  { id: 'boat', label: 'مشحوف' },
  { id: 'dome', label: 'قبة' },
  { id: 'wave', label: 'موجة دجلة' },
  { id: 'star', label: 'نجمة بابل' },
];

/**
 * Generates normalized [0..1] SVG superellipse path data (squircle) for clipPathUnits="objectBoundingBox".
 */
export function buildSquircleSvgPath(exponent = 4.2, steps = 64): string {
  const pts: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const theta = (i / steps) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const x = 0.5 + 0.5 * Math.sign(cos) * Math.pow(Math.abs(cos), 2 / exponent);
    const y = 0.5 + 0.5 * Math.sign(sin) * Math.pow(Math.abs(sin), 2 / exponent);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(4)} ${y.toFixed(4)}`);
  }
  return `${pts.join(' ')} Z`;
}

export const SQUIRCLE_CLIP_PATH_D = buildSquircleSvgPath(4.2, 64);

