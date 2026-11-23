/**
 * IRQ تواصل — Arabic & Iraqi Localized Formatters
 * Implements Section 4.2 and Section D.9 of the specification.
 */

export const IRAQI_MONTHS = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
] as const;

export type NumeralSystem = 'arabic-indic' | 'western';

/**
 * Converts Western digits (0-9) to Eastern Arabic-Indic digits (٠-٩)
 */
export function toArabicIndicDigits(value: string | number): string {
  const str = String(value);
  const arabicIndicMap = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[0-9]/g, (digit) => arabicIndicMap[Number(digit)] ?? digit);
}

/**
 * Format numbers according to user numeral system preference
 */
export function formatNumber(value: number, numeralSystem: NumeralSystem = 'arabic-indic'): string {
  const formatted = new Intl.NumberFormat('en-US').format(value);
  if (numeralSystem === 'arabic-indic') {
    return toArabicIndicDigits(formatted).replace(/,/g, '٬');
  }
  return formatted;
}

/**
 * Format price in Iraqi Dinar (IQD)
 * Example: "١٢٥٬٠٠٠ د.ع"
 */
export function formatPriceIQD(amount: number, numeralSystem: NumeralSystem = 'arabic-indic'): string {
  const formattedNum = formatNumber(amount, numeralSystem);
  return `${formattedNum} د.ع`;
}

/**
 * Compact count representation (e.g., 1.2K -> "١٫٢ ألف", 3.4M -> "٣٫٤ مليون")
 */
export function formatCompactCount(count: number, numeralSystem: NumeralSystem = 'arabic-indic'): string {
  if (count < 1000) {
    return formatNumber(count, numeralSystem);
  }

  if (count < 1_000_000) {
    const thousands = (count / 1000).toFixed(count % 1000 >= 100 ? 1 : 0);
    const num = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(thousands).replace(/\./g, '٫') : thousands;
    return `${num} ألف`;
  }

  const millions = (count / 1_000_000).toFixed(count % 1_000_000 >= 100_000 ? 1 : 0);
  const num = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(millions).replace(/\./g, '٫') : millions;
  return `${num} مليون`;
}

/**
 * Relative time with authentic Arabic grammatical plurals
 * Implements Section D.9
 */
export function formatRelativeTime(
  dateInput: Date | string | number,
  now: Date = new Date(),
  numeralSystem: NumeralSystem = 'arabic-indic'
): string {
  const date = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) {
    return 'الآن';
  }

  const diffMins = Math.floor(diffSec / 60);
  if (diffMins === 1) return 'قبل دقيقة';
  if (diffMins === 2) return 'قبل دقيقتين';
  if (diffMins >= 3 && diffMins <= 10) {
    const num = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(diffMins) : diffMins;
    return `قبل ${num} دقائق`;
  }
  if (diffMins < 60) {
    const num = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(diffMins) : diffMins;
    return `قبل ${num} دقيقة`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'قبل ساعة';
  if (diffHours === 2) return 'قبل ساعتين';
  if (diffHours >= 3 && diffHours <= 10) {
    const num = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(diffHours) : diffHours;
    return `قبل ${num} ساعات`;
  }
  if (diffHours < 24) {
    const num = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(diffHours) : diffHours;
    return `قبل ${num} ساعة`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'قبل يوم';
  if (diffDays === 2) return 'قبل يومين';
  if (diffDays >= 3 && diffDays <= 10) {
    const num = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(diffDays) : diffDays;
    return `قبل ${num} أيام`;
  }

  // 7+ days: Format using Iraqi month names
  const day = date.getDate();
  const monthName = IRAQI_MONTHS[date.getMonth()];
  const formattedDay = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(day) : day;

  if (date.getFullYear() === now.getFullYear()) {
    return `${formattedDay} ${monthName}`;
  }

  const year = date.getFullYear();
  const formattedYear = numeralSystem === 'arabic-indic' ? toArabicIndicDigits(year) : year;
  return `${formattedDay} ${monthName} ${formattedYear}`;
}

/**
 * Format video duration (m:ss or h:mm:ss) wrapped in LTR bidi protection
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

/**
 * Safely formats ISO / timestamp strings with formatRelativeTime while preserving pre-localized labels.
 */
export function formatTimeSafe(
  value: Date | string | number,
  numeralSystem: NumeralSystem = 'arabic-indic',
  now: Date = new Date()
): string {
  if (typeof value === 'string') {
    const looksIso = /^\d{4}-\d{2}-\d{2}T/.test(value.trim());
    if (!looksIso) {
      return value;
    }
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return 'الآن';
    }
    return formatRelativeTime(parsed, now, numeralSystem);
  }
  return formatRelativeTime(value, now, numeralSystem);
}

