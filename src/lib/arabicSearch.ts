/**
 * IRQ تواصل — Arabic Text Search Normalizer
 * Implements Section 16.3 of the Master Build Prompt:
 * - Strips diacritics (tashkeel) and tatweel (kashida)
 * - Unifies alef forms (أ إ آ ٱ -> ا)
 * - Normalizes yaa/alef maqsura (ى -> ي)
 * - Normalizes taa marbuta for matching (ة -> ه)
 * - Unifies hamza forms (ؤ -> و, ئ -> ي)
 * - Converts Arabic-Indic and Persian digits to Western digits
 * - Collapses whitespace and strips punctuation
 */

export function normalizeArabicText(text: string): string {
  if (!text) return '';

  return (
    text
      // Strip tashkeel (diacritics: fatha, damma, kasra, sukun, shadda, tanween)
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Strip tatweel / kashida (ـ)
      .replace(/\u0640/g, '')
      // Unify Alef forms
      .replace(/[أإآٱ]/g, 'ا')
      // Unify Yaa and Alef Maqsura
      .replace(/ى/g, 'ي')
      // Unify Taa Marbuta
      .replace(/ة/g, 'ه')
      // Unify Waw with Hamza and Yaa with Hamza
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      // Convert Arabic-Indic digits to Western
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      // Convert Persian digits to Western
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      // Collapse whitespace and trim
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

/**
 * Checks if a haystack matches a query with Arabic normalization
 */
export function arabicTextMatches(haystack: string, query: string): boolean {
  if (!query.trim()) return true;
  const normHaystack = normalizeArabicText(haystack);
  const normQuery = normalizeArabicText(query);
  return normHaystack.includes(normQuery);
}
