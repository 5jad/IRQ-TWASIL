/**
 * IRQ تواصل — Color Contrast Verification Script (F13)
 * Dynamically parses CSS variables directly from src/index.css
 * Validates WCAG AA contrast for text (4.5:1 / 7:1 for high-contrast) and UI controls (3:1)
 * across all 4 themes and all 8 accent presets in light and dark mode.
 */

import fs from 'node:fs';
import path from 'node:path';

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function relativeLuminance({ r, g, b }: RGB): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Parse CSS file variables
const cssPath = path.resolve(process.cwd(), 'src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

function extractBlockVars(selectorPattern: RegExp): Record<string, string> {
  const match = cssContent.match(selectorPattern);
  if (!match || !match[1]) return {};
  const block = match[1];
  const vars: Record<string, string> = {};
  const regex = /--([\w-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[^;]+);/g;
  let m;
  while ((m = regex.exec(block)) !== null) {
    if (m[1] && m[2]) {
      const val = m[2].trim();
      if (val.startsWith('#')) {
        vars[m[1]] = val;
      }
    }
  }
  return vars;
}

const lightVars = extractBlockVars(/:root\s*\{([^}]+)\}/);
const darkVars = { ...lightVars, ...extractBlockVars(/\.dark,\s*\[data-theme="dark"\]\s*\{([^}]+)\}/) };
const calmVars = { ...lightVars, ...extractBlockVars(/\[data-theme="calm"\]\s*\{([^}]+)\}/) };
const highContrastVars = { ...lightVars, ...extractBlockVars(/\[data-theme="high-contrast"\]\s*\{([^}]+)\}/) };

const THEMES = [
  { name: 'Light (رمال بغداد)', vars: lightVars, minRatioText: 4.5 },
  { name: 'Dark (كحّلة)', vars: darkVars, minRatioText: 4.5 },
  { name: 'Calm (هادئ)', vars: calmVars, minRatioText: 4.5 },
  { name: 'High Contrast (تباين عالٍ)', vars: highContrastVars, minRatioText: 7.0 },
];

console.log('--- IRQ تواصل WCAG Dynamic Contrast Verification ---');
let allPassed = true;
let totalChecks = 0;
let passedChecks = 0;

function checkPair(
  themeName: string,
  label: string,
  fg: string | undefined,
  bg: string | undefined,
  minRatio: number
) {
  totalChecks++;
  if (!fg || !bg) {
    console.error(`  [FAIL] ${label} - Missing token! fg=${fg}, bg=${bg}`);
    allPassed = false;
    return;
  }
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= minRatio;
  if (pass) {
    passedChecks++;
    console.log(`  [PASS] ${label}: ${ratio.toFixed(2)}:1 (Req: ${minRatio}:1)`);
  } else {
    allPassed = false;
    console.error(`  [FAIL] ${label}: ${ratio.toFixed(2)}:1 (Req: ${minRatio}:1) - ${fg} on ${bg}`);
  }
}

for (const theme of THEMES) {
  console.log(`\nEvaluating theme: ${theme.name}`);
  const v = theme.vars;
  const tMin = theme.minRatioText;

  // Text on backgrounds
  checkPair(theme.name, 'Text on BG', v['text'], v['bg'], tMin);
  checkPair(theme.name, 'Text on Surface', v['text'], v['surface'], tMin);
  checkPair(theme.name, 'Text on Surface-2', v['text'], v['surface-2'], tMin);

  // Muted text
  checkPair(theme.name, 'Muted Text on BG', v['text-muted'], v['bg'], tMin);
  checkPair(theme.name, 'Muted Text on Surface', v['text-muted'], v['surface'], tMin);
  checkPair(theme.name, 'Muted Text on Surface-2', v['text-muted'], v['surface-2'], tMin);

  // Primary & Accent Buttons & Text
  checkPair(theme.name, 'Primary-FG on Primary (Button/Badge)', v['primary-fg'], v['primary'], 4.5);
  checkPair(theme.name, 'Primary-Text on BG', v['primary-text'], v['bg'], tMin);
  checkPair(theme.name, 'Primary-Text on Surface', v['primary-text'], v['surface'], tMin);
  checkPair(theme.name, 'Primary-Text on Surface-2', v['primary-text'], v['surface-2'], tMin);

  checkPair(theme.name, 'Accent-FG on Accent', v['accent-fg'], v['accent'], 4.5);
  checkPair(theme.name, 'Accent-Text on BG', v['accent-text'], v['bg'], tMin);
  checkPair(theme.name, 'Accent-Text on Surface', v['accent-text'], v['surface'], tMin);

  // Status colors on surface & danger button
  checkPair(theme.name, 'Danger-FG on Danger', v['danger-fg'], v['danger'], 4.5);
  checkPair(theme.name, 'Success on Surface', v['success'], v['surface'], tMin);
  checkPair(theme.name, 'Warning on Surface', v['warning'], v['surface'], tMin);
  checkPair(theme.name, 'Danger on Surface', v['danger'], v['surface'], tMin);
  checkPair(theme.name, 'Info on Surface', v['info'], v['surface'], tMin);

  // Each tint with its text color
  checkPair(theme.name, 'Primary-Text on Primary-Tint', v['primary-text'], v['primary-tint'], tMin);
  checkPair(theme.name, 'Accent-Text on Accent-Tint', v['accent-text'], v['accent-tint'], tMin);
  checkPair(theme.name, 'Success on Success-Tint', v['success'], v['success-tint'], tMin);
  checkPair(theme.name, 'Danger on Danger-Tint', v['danger'], v['danger-tint'], tMin);
  checkPair(theme.name, 'Warning on Warning-Tint', v['warning'], v['warning-tint'], tMin);

  // Lapis & Gold (F13)
  checkPair(theme.name, 'Lapis-FG on Lapis', v['lapis-fg'], v['lapis'], 4.5);
  checkPair(theme.name, 'Gold-FG on Gold', v['gold-fg'], v['gold'], 4.5);

  // Focus ring & Border-strong & Notification Dot (3:1 for UI controls)
  checkPair(theme.name, 'Ring on BG', v['ring'], v['bg'], 3.0);
  checkPair(theme.name, 'Notification Dot (Accent) on BG', v['accent'], v['bg'], 3.0);
  checkPair(theme.name, 'Border-Strong on BG', v['border-strong'], v['bg'], 3.0);
  checkPair(theme.name, 'Border-Strong on Surface', v['border-strong'], v['surface'], 3.0);

  // Bubbles
  checkPair(theme.name, 'Text on Bubble Own', v['text'], v['bubble-own'], tMin);
  checkPair(theme.name, 'Text on Bubble Other', v['text'], v['bubble-other'], tMin);
}

// Validate all 8 Accent Presets in Light and Dark
console.log('\n--- Checking 8 Accent Presets in Light and Dark ---');
const ACCENT_KEYS = ['teal', 'copper', 'indigo', 'green', 'rose', 'violet', 'slate', 'gold'];

for (const acc of ACCENT_KEYS) {
  const lightMatch = cssContent.match(new RegExp(`\\[data-accent="${acc}"\\]\\s*\\{([^}]+)\\}`));
  if (lightMatch && lightMatch[1]) {
    const lPrimary = lightMatch[1].match(/--primary:\s*(#[0-9a-fA-F]+);/)?.[1];
    const lFg = lightMatch[1].match(/--primary-fg:\s*(#[0-9a-fA-F]+);/)?.[1] || lightVars['primary-fg'];
    const lText = lightMatch[1].match(/--primary-text:\s*(#[0-9a-fA-F]+);/)?.[1];
    checkPair('Light Accent', `${acc} Primary-FG on Primary (Light)`, lFg, lPrimary, 4.5);
    checkPair('Light Accent', `${acc} Primary-Text on BG (Light)`, lText, lightVars['bg'], 4.5);
  }

  const darkMatch = cssContent.match(new RegExp(`\\.dark\\[data-accent="${acc}"\\],[^\\{]*\\{([^}]+)\\}`));
  if (darkMatch && darkMatch[1]) {
    const dPrimary = darkMatch[1].match(/--primary:\s*(#[0-9a-fA-F]+);/)?.[1];
    const dFg = darkMatch[1].match(/--primary-fg:\s*(#[0-9a-fA-F]+);/)?.[1];
    const dText = darkMatch[1].match(/--primary-text:\s*(#[0-9a-fA-F]+);/)?.[1];
    checkPair('Dark Accent', `${acc} Primary-FG on Primary (Dark)`, dFg, dPrimary, 4.5);
    checkPair('Dark Accent', `${acc} Primary-Text on BG (Dark)`, dText, darkVars['bg'], 4.5);
  }
}

console.log('\n--- Checking Create Camera Tokens ---');
checkPair('Camera', 'Cam-Text on Cam-BG', lightVars['cam-text'], lightVars['cam-bg'], 4.5);
checkPair('Camera', 'Cam-Text on Cam-Surface', lightVars['cam-text'], lightVars['cam-surface'], 4.5);
checkPair('Camera', 'Cam-Muted on Cam-Surface', lightVars['cam-muted'], lightVars['cam-surface'], 4.5);

console.log(`\nVerification Summary: ${passedChecks}/${totalChecks} checks passed.`);
if (!allPassed) {
  console.error('\nContrast verification FAILED. Please review token values in src/index.css.');
  process.exit(1);
} else {
  console.log('All WCAG AA tokens and pairs passed successfully!\n');
}
