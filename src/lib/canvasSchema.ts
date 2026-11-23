/**
 * IRQ تواصل — Profile Canvas Strict JSON Schema & Validator
 * Implements Section 14 (Signature Feature) & Task F14:
 * - Strict allowlist schema powered by Zod: rejects unknown keys at every level (.strict())
 * - Rejects raw HTML, CSS, JavaScript, prototype pollution, oversized configs (>20KB)
 * - Validates blocks (1 to 20), visible booleans, settings limits, motion intensity (finite 0..1)
 * - 12 authentic templates: رمال، دجلة، نخيل، بغداد ليلاً، زجاج، مجلة، ريترو ٩٠، معرض، متجر، بث، شاعر، تقني
 */

import { z } from 'zod';

export const ALLOWED_THEME_PRESETS = [
  'sand',
  'dijlah',
  'palm',
  'baghdad-night',
  'glass',
  'editorial',
  'retro90',
  'gallery',
  'merchant',
  'streamer',
  'poet',
  'tech',
] as const;

export const ALLOWED_ACCENTS = [
  'teal',
  'copper',
  'indigo',
  'green',
  'rose',
  'violet',
  'slate',
  'gold',
] as const;

export const ALLOWED_FONTS = ['cairo', 'reem-kufi', 'noto-naskh'] as const;

export const ALLOWED_LAYOUTS = ['editorial', 'modern', 'compact', 'showcase'] as const;

export const ALLOWED_BLOCK_TYPES = [
  'cover',
  'identity',
  'bio',
  'stats',
  'links',
  'pinned-post',
  'posts-grid',
  'shop-strip',
  'music-widget',
  'badges',
] as const;

export const ALLOWED_MOTION_PRESETS = ['none', 'subtle', 'smooth', 'gentle'] as const;

export interface CanvasBlockConfig {
  type: (typeof ALLOWED_BLOCK_TYPES)[number];
  visible: boolean;
  settings?: Record<string, string | number | boolean>;
}

export interface ProfileCanvasConfig {
  schemaVersion: 1;
  name: string;
  theme: {
    preset: (typeof ALLOWED_THEME_PRESETS)[number];
    accent: (typeof ALLOWED_ACCENTS)[number];
    background: 'surface' | 'gradient' | 'pattern';
    font: (typeof ALLOWED_FONTS)[number];
  };
  layout: (typeof ALLOWED_LAYOUTS)[number];
  blocks: CanvasBlockConfig[];
  motion: {
    preset: (typeof ALLOWED_MOTION_PRESETS)[number];
    intensity: number; // 0 to 1
  };
}

export interface CanvasValidationResult {
  valid: boolean;
  errors: string[];
  config?: ProfileCanvasConfig;
}

// Zod schemas with strict key rejection
const SettingKeyRegex = /^[a-z][a-zA-Z0-9]{0,30}$/;

const BlockSettingsSchema = z
  .record(
    z.string().refine((k) => SettingKeyRegex.test(k), {
      message: 'مفتاح الإعدادات غير صالح (يجب أن يبدأ بحرف صغير ولا يتجاوز 31 حرفاً).',
    }),
    z.union([
      z.string().max(200, 'قيمة الإعداد يجب ألا تتجاوز 200 حرف.'),
      z.number().refine((n) => Number.isFinite(n), 'القيمة الرقمية يجب أن تكون منتهية.'),
      z.boolean(),
    ])
  )
  .refine((obj) => Object.keys(obj).length <= 10, {
    message: 'الحد الأقصى لعدد إعدادات العنصر هو 10 إعدادات.',
  });

const CanvasBlockSchema = z
  .object({
    type: z.enum(ALLOWED_BLOCK_TYPES, {
      error: 'نوع العنصر غير مسموح به في القالب.',
    }),
    visible: z.boolean({
      error: 'حقل الرؤية (visible) يجب أن يكون قيمة منطقية.',
    }),
    settings: BlockSettingsSchema.optional(),
  })
  .strict();

export const ProfileCanvasZodSchema = z
  .object({
    schemaVersion: z.literal(1, {
      error: 'إصدار المخطط غير مدعوم. الإصدار المطلوب هو 1.',
    }),
    name: z
      .string({
        error: 'اسم التصميم مطلوب ويجب أن يكون نصاً.',
      })
      .min(1, 'اسم التصميم يجب ألا يكون فارغاً.')
      .max(40, 'اسم التصميم يجب ألا يتجاوز 40 حرفاً.'),
    theme: z
      .object({
        preset: z.enum(ALLOWED_THEME_PRESETS, {
          error: 'نمط السمة غير موجود في قائمة السمات المعتمدة.',
        }),
        accent: z.enum(ALLOWED_ACCENTS, {
          error: 'اللون البارز غير مدعوم.',
        }),
        background: z.enum(['surface', 'gradient', 'pattern'], {
          error: 'خلفية السمة غير صالحة.',
        }),
        font: z.enum(ALLOWED_FONTS, {
          error: 'نوع الخط غير معتمد.',
        }),
      })
      .strict(),
    layout: z.enum(ALLOWED_LAYOUTS, {
      error: 'التخطيط غير معتمد.',
    }),
    blocks: z
      .array(CanvasBlockSchema, {
        error: 'قائمة العناصر (blocks) يجب أن تكون مصفوفة صالحة.',
      })
      .min(1, 'يجب توفير قائمة عناصر التخطيط (blocks) على الأقل عنصر واحد.')
      .max(20, 'الحد الأقصى لعدد العناصر هو 20 عنصراً.')
      .refine(
        (blocks) => {
          const allowedDuplicates = new Set(['links', 'pinned-post']);
          const seen = new Set<string>();
          for (const b of blocks) {
            if (!allowedDuplicates.has(b.type)) {
              if (seen.has(b.type)) return false;
              seen.add(b.type);
            }
          }
          return true;
        },
        { message: 'لا يسمح بتكرار هذا النوع من العناصر في الصفحة.' }
      ),
    motion: z
      .object({
        preset: z.enum(ALLOWED_MOTION_PRESETS, {
          error: 'نمط الحركة غير مدعوم.',
        }),
        intensity: z
          .number({
            error: 'شدة الحركة يجب أن تكون رقماً.',
          })
          .refine((n) => Number.isFinite(n) && n >= 0 && n <= 1, {
            message: 'شدة الحركة يجب أن تكون رقماً منتهياً بين 0 و 1.',
          }),
      })
      .strict(),
  })
  .strict();

/**
 * Validates a profile design JSON configuration strictly against allowlists
 * NEVER throws an exception on any input.
 */
export function validateCanvasJson(raw: unknown): CanvasValidationResult {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { valid: false, errors: ['التكوين يجب أن يكون كائن JSON صالح.'] };
    }

    // Size limit check: max 20 KB raw JSON
    let jsonStr: string;
    try {
      jsonStr = JSON.stringify(raw);
    } catch {
      return { valid: false, errors: ['تعذر تحويل التكوين إلى نص JSON صالح.'] };
    }

    if (new TextEncoder().encode(jsonStr).length > 20 * 1024) {
      return {
        valid: false,
        errors: ['حجم ملف التكوين يتجاوز الحد الأقصى المسموح به (20 كيلوبايت).'],
      };
    }

    // Recursive prototype pollution prevention
    const hasForbiddenKey = (node: unknown, depth = 0): boolean => {
      if (depth > 15 || typeof node !== 'object' || node === null) return false;
      if (Array.isArray(node)) {
        return node.some((item) => hasForbiddenKey(item, depth + 1));
      }
      if (
        Object.prototype.hasOwnProperty.call(node, '__proto__') ||
        Object.prototype.hasOwnProperty.call(node, 'constructor') ||
        Object.prototype.hasOwnProperty.call(node, 'prototype')
      ) {
        return true;
      }
      return Object.values(node).some((val) => hasForbiddenKey(val, depth + 1));
    };

    if (hasForbiddenKey(raw)) {
      return {
        valid: false,
        errors: ['تم رفض التكوين لاحتوائه على خصائص نظام محظورة (__proto__).'],
      };
    }

    // Secondary defense layer: detect raw HTML/script tags or javascript pseudoprotocols
    const dangerousPatterns = /<script\b|<\/?[a-z][^>]*>|javascript:|onerror\s*=|onload\s*=/i;
    if (dangerousPatterns.test(jsonStr)) {
      return {
        valid: false,
        errors: ['تم رفض التكوين لاحتوائه على نصوص أو وسوم برمجية غير مسموح بها.'],
      };
    }

    // Run Zod schema parse
    const parseResult = ProfileCanvasZodSchema.safeParse(raw);

    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues.map((issue) => {
        const path = issue.path.join('.');
        const msg = /[\u0600-\u06FF]/.test(issue.message)
          ? issue.message
          : 'قيمة أو حقل غير صالح في بنية التكوين.';
        return path ? `${path}: ${msg}` : msg;
      });
      return { valid: false, errors: errorMessages };
    }

    return {
      valid: true,
      errors: [],
      config: parseResult.data as ProfileCanvasConfig,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ غير متوقع أثناء فحص التكوين.';
    return { valid: false, errors: [msg] };
  }
}

/**
 * 12 Original, mobile-first accessible Iraqi templates
 */
export const CANVAS_TEMPLATES: ProfileCanvasConfig[] = [
  {
    schemaVersion: 1,
    name: 'رمال الرافدين',
    theme: { preset: 'sand', accent: 'copper', background: 'surface', font: 'cairo' },
    layout: 'editorial',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'stats', visible: true },
      { type: 'pinned-post', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'subtle', intensity: 0.8 },
  },
  {
    schemaVersion: 1,
    name: 'دجلة الصباح',
    theme: { preset: 'dijlah', accent: 'teal', background: 'gradient', font: 'cairo' },
    layout: 'modern',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'links', visible: true },
      { type: 'music-widget', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'smooth', intensity: 1 },
  },
  {
    schemaVersion: 1,
    name: 'نخيل البصرة',
    theme: { preset: 'palm', accent: 'green', background: 'surface', font: 'cairo' },
    layout: 'editorial',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'stats', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'subtle', intensity: 0.7 },
  },
  {
    schemaVersion: 1,
    name: 'بغداد ليلاً',
    theme: { preset: 'baghdad-night', accent: 'indigo', background: 'gradient', font: 'reem-kufi' },
    layout: 'showcase',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'pinned-post', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'smooth', intensity: 1 },
  },
  {
    schemaVersion: 1,
    name: 'زجاج شناشيل',
    theme: { preset: 'glass', accent: 'teal', background: 'pattern', font: 'cairo' },
    layout: 'modern',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'stats', visible: true },
      { type: 'links', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'subtle', intensity: 0.9 },
  },
  {
    schemaVersion: 1,
    name: 'المجلة البغدادية',
    theme: { preset: 'editorial', accent: 'copper', background: 'surface', font: 'noto-naskh' },
    layout: 'editorial',
    blocks: [
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'pinned-post', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'none', intensity: 0 },
  },
  {
    schemaVersion: 1,
    name: 'ريترو التسعينات',
    theme: { preset: 'retro90', accent: 'rose', background: 'pattern', font: 'reem-kufi' },
    layout: 'compact',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'music-widget', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'subtle', intensity: 0.5 },
  },
  {
    schemaVersion: 1,
    name: 'معرض الفنان التشكيلي',
    theme: { preset: 'gallery', accent: 'slate', background: 'surface', font: 'cairo' },
    layout: 'showcase',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'gentle', intensity: 0.6 },
  },
  {
    schemaVersion: 1,
    name: 'المتجر العراقي الأصيل',
    theme: { preset: 'merchant', accent: 'copper', background: 'surface', font: 'cairo' },
    layout: 'modern',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'shop-strip', visible: true },
      { type: 'bio', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'subtle', intensity: 0.8 },
  },
  {
    schemaVersion: 1,
    name: 'منصة البث المباشر',
    theme: { preset: 'streamer', accent: 'violet', background: 'gradient', font: 'reem-kufi' },
    layout: 'compact',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'links', visible: true },
      { type: 'pinned-post', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'smooth', intensity: 1 },
  },
  {
    schemaVersion: 1,
    name: 'مجلس الشعراء والكتاب',
    theme: { preset: 'poet', accent: 'gold', background: 'surface', font: 'noto-naskh' },
    layout: 'editorial',
    blocks: [
      { type: 'identity', visible: true },
      { type: 'bio', visible: true },
      { type: 'pinned-post', visible: true },
      { type: 'links', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'none', intensity: 0 },
  },
  {
    schemaVersion: 1,
    name: 'واحة المطور والتقني',
    theme: { preset: 'tech', accent: 'teal', background: 'surface', font: 'cairo' },
    layout: 'modern',
    blocks: [
      { type: 'cover', visible: true },
      { type: 'identity', visible: true },
      { type: 'badges', visible: true },
      { type: 'bio', visible: true },
      { type: 'links', visible: true },
      { type: 'posts-grid', visible: true },
    ],
    motion: { preset: 'subtle', intensity: 0.7 },
  },
];
