import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toArabicIndicDigits,
  formatNumber,
  formatPriceIQD,
  formatCompactCount,
  formatRelativeTime,
  formatDuration,
  IRAQI_MONTHS,
} from './formatters';

test('toArabicIndicDigits converts western numerals to eastern digits', () => {
  assert.equal(toArabicIndicDigits('12345'), '١٢٣٤٥');
  assert.equal(toArabicIndicDigits(2026), '٢٠٢٦');
});

test('formatPriceIQD outputs Iraqi Dinar format with separator', () => {
  const result = formatPriceIQD(125000, 'arabic-indic');
  assert.equal(result, '١٢٥٬٠٠٠ د.ع');

  const westernResult = formatPriceIQD(125000, 'western');
  assert.equal(westernResult, '125,000 د.ع');
});

test('formatCompactCount formats counts compactly', () => {
  assert.equal(formatCompactCount(450, 'arabic-indic'), '٤٥٠');
  assert.equal(formatCompactCount(1200, 'arabic-indic'), '١٫٢ ألف');
  assert.equal(formatCompactCount(3400000, 'arabic-indic'), '٣٫٤ مليون');
});

test('formatRelativeTime applies correct Arabic plural rules', () => {
  const now = new Date('2026-11-10T12:00:00Z');

  // 10 seconds ago
  const t1 = new Date(now.getTime() - 10 * 1000);
  assert.equal(formatRelativeTime(t1, now, 'arabic-indic'), 'الآن');

  // 1 minute ago
  const t2 = new Date(now.getTime() - 60 * 1000);
  assert.equal(formatRelativeTime(t2, now, 'arabic-indic'), 'قبل دقيقة');

  // 2 minutes ago
  const t3 = new Date(now.getTime() - 120 * 1000);
  assert.equal(formatRelativeTime(t3, now, 'arabic-indic'), 'قبل دقيقتين');

  // 5 minutes ago
  const t4 = new Date(now.getTime() - 5 * 60 * 1000);
  assert.equal(formatRelativeTime(t4, now, 'arabic-indic'), 'قبل ٥ دقائق');

  // 20 minutes ago
  const t5 = new Date(now.getTime() - 20 * 60 * 1000);
  assert.equal(formatRelativeTime(t5, now, 'arabic-indic'), 'قبل ٢٠ دقيقة');

  // 2 hours ago
  const t6 = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  assert.equal(formatRelativeTime(t6, now, 'arabic-indic'), 'قبل ساعتين');

  // 3 days ago
  const t7 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  assert.equal(formatRelativeTime(t7, now, 'arabic-indic'), 'قبل ٣ أيام');
});

test('formatDuration formats m:ss and h:mm:ss properly', () => {
  assert.equal(formatDuration(45), '0:45');
  assert.equal(formatDuration(135), '2:15');
  assert.equal(formatDuration(3670), '1:01:10');
});

test('Iraqi months contains all 12 Iraqi names', () => {
  assert.equal(IRAQI_MONTHS.length, 12);
  assert.equal(IRAQI_MONTHS[0], 'كانون الثاني');
  assert.equal(IRAQI_MONTHS[10], 'تشرين الثاني');
});
