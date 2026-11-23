import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabicText, arabicTextMatches } from './arabicSearch';
import { validateCanvasJson, CANVAS_TEMPLATES } from './canvasSchema';

const HAS_ARABIC = /[\u0600-\u06FF]/;

test('normalizeArabicText unifies alef, strips tashkeel and normalizes digits', () => {
  const input = 'أَحْمَدُ الإِلْكِتْرُونِيّ';
  const expected = 'احمد الالكتروني';
  assert.equal(normalizeArabicText(input), expected);

  assert.equal(normalizeArabicText('بغداد ١٢٣'), 'بغداد 123');
  assert.equal(normalizeArabicText('مدينة البصرة'), 'مدينه البصره');
});

test('arabicTextMatches matches fuzzy queries in dialect', () => {
  const text = 'ورشة صناعة النحاس في سوق الصفافير ببغداد';
  assert.equal(arabicTextMatches(text, 'نحاس'), true);
  assert.equal(arabicTextMatches(text, 'صفافير'), true);
  assert.equal(arabicTextMatches(text, 'أربيل'), false);
});

test('validateCanvasJson passes all 12 valid canvas schema templates', () => {
  assert.equal(CANVAS_TEMPLATES.length, 12);
  for (const template of CANVAS_TEMPLATES) {
    const result = validateCanvasJson(template);
    assert.equal(result.valid, true, `Template ${template.name} failed validation`);
    assert.ok(result.config);
  }
});

test('validateCanvasJson accepts legitimate Arabic names like "إعدادات الموسم" without false positives', () => {
  const validConfig = {
    ...CANVAS_TEMPLATES[0],
    name: 'إعدادات الموسم',
    blocks: [
      { type: 'cover', visible: true, settings: { seasonTitle: 'إعدادات الموسم' } },
      { type: 'identity', visible: true },
    ],
  };
  const result = validateCanvasJson(validConfig);
  assert.equal(result.valid, true);
});

test('validateCanvasJson rejects hostile fixtures with Arabic error messages', () => {
  const base = structuredClone(CANVAS_TEMPLATES[0]!);

  const hostileCases: Array<[string, unknown]> = [
    ['unknown root key', { ...base, extraKey: 'hack' }],
    ['unknown nested theme key', { ...base, theme: { ...base.theme, evil: 1 } }],
    ['unknown block key', { ...base, blocks: [{ type: 'cover', visible: true, extra: true }] }],
    [
      '__proto__ pollution key',
      JSON.parse(JSON.stringify(base).replace('"schemaVersion":1', '"schemaVersion":1,"__proto__":{"polluted":true}')),
    ],
    ['null block element', { ...base, blocks: [null] }],
    ['100 blocks (>20 limit)', { ...base, blocks: Array.from({ length: 100 }, () => ({ type: 'links', visible: true })) }],
    ['1 MB oversized string (>20 KB cap)', { ...base, name: 'x'.repeat(1024 * 1024) }],
    ['NaN motion intensity', { ...base, motion: { preset: 'subtle', intensity: Number.NaN } }],
    ['HTML/script string in name', { ...base, name: '<script>alert(1)</script>' }],
    ['HTML image tag in settings', { ...base, blocks: [{ type: 'cover', visible: true, settings: { label: '<img onerror=alert(1)>' } }] }],
    ['wrong schemaVersion & types', { ...base, schemaVersion: 2, blocks: [{ type: 'cover', visible: 'yes' }] }],
    ['duplicate non-repeatable block', { ...base, blocks: [{ type: 'bio', visible: true }, { type: 'bio', visible: false }] }],
    ['too many block settings (>10)', { ...base, blocks: [{ type: 'cover', visible: true, settings: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, i])) }] }],
  ];

  for (const [label, fixture] of hostileCases) {
    const res = validateCanvasJson(fixture);
    assert.equal(res.valid, false, `Expected hostile case "${label}" to be rejected`);
    assert.ok(res.errors.length > 0, `Expected errors for "${label}"`);
    assert.ok(
      HAS_ARABIC.test(res.errors[0]!),
      `Expected Arabic error message for "${label}", got: ${res.errors[0]}`
    );
  }
});

test('validateCanvasJson never throws across 1,000 fuzzed random JSON inputs', () => {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const randomValue = (depth = 0): unknown => {
    const pick = Math.floor(rand() * 9);
    if (depth > 3 || pick === 0) return null;
    if (pick === 1) return undefined;
    if (pick === 2) return rand() > 0.5;
    if (pick === 3) return rand() > 0.8 ? Number.NaN : (rand() - 0.5) * 1000;
    if (pick === 4) {
      const samples = ['', 'abc', '<script>', '__proto__', 'إعدادات الموسم', 'x'.repeat(250)];
      return samples[Math.floor(rand() * samples.length)];
    }
    if (pick === 5 || pick === 6) {
      const len = Math.floor(rand() * 6);
      return Array.from({ length: len }, () => randomValue(depth + 1));
    }
    const obj: Record<string, unknown> = {};
    const keys = ['schemaVersion', 'name', 'theme', 'layout', 'blocks', 'motion', 'unknown', 'type', 'visible', 'settings'];
    const count = Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const k = keys[Math.floor(rand() * keys.length)]!;
      obj[k] = randomValue(depth + 1);
    }
    return obj;
  };

  for (let i = 0; i < 1000; i++) {
    const input = randomValue(0);
    assert.doesNotThrow(() => {
      const res = validateCanvasJson(input);
      assert.equal(typeof res.valid, 'boolean');
      assert.ok(Array.isArray(res.errors));
    });
  }
});
