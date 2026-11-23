import React from 'react';
import { Palette } from 'lucide-react';
import { Switch, SegmentedControl } from '../ui/Input';
import { PWAInstallButton } from '../ui/PWAInstallButton';
import type { AccentPreset, Handedness, NumeralSystem, Theme } from '../../types';

const ACCENT_OPTIONS: { id: AccentPreset; label: string }[] = [
  { id: 'teal', label: 'أزرق رافديني' },
  { id: 'copper', label: 'نحاسي تراثي' },
  { id: 'indigo', label: 'نيلي بغدادي' },
  { id: 'green', label: 'أخضر النخيل' },
  { id: 'rose', label: 'وردي جوري' },
  { id: 'violet', label: 'بنفسجي ملكي' },
  { id: 'slate', label: 'رمادي حجري' },
  { id: 'gold', label: 'ذهبي بابل' },
];

interface SettingsAppearanceTabProps {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: AccentPreset;
  setAccent: (a: AccentPreset) => void;
  handedness: Handedness;
  setHandedness: (h: Handedness) => void;
  fontScale: number;
  setFontScale: (s: number) => void;
  numeralSystem: NumeralSystem;
  setNumeralSystem: (n: NumeralSystem) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  dataSaver: boolean;
  setDataSaver: (v: boolean) => void;
}

export function SettingsAppearanceTab({
  theme,
  setTheme,
  accent,
  setAccent,
  handedness,
  setHandedness,
  fontScale,
  setFontScale,
  numeralSystem,
  setNumeralSystem,
  reduceMotion,
  setReduceMotion,
  dataSaver,
  setDataSaver,
}: SettingsAppearanceTabProps) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)] border-b border-[var(--border)] pb-2.5">
        <Palette className="w-4 h-4 text-[var(--primary)]" />
        <span>المظهر والسمات ونظام الألوان العراقي</span>
      </div>

      {/* Theme Segmented */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-[var(--text)]">السمة الأساسية:</span>
        <SegmentedControl<Theme>
          options={[
            { value: 'system', label: 'تلقائي' },
            { value: 'light', label: 'رمال بغداد' },
            { value: 'dark', label: 'كحّلة' },
            { value: 'calm', label: 'هادئ' },
            { value: 'high-contrast', label: 'تباين عالٍ' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </div>

      {/* Accent Color Presets */}
      <div className="flex flex-col gap-1.5 pt-2.5 border-t border-[var(--border)]">
        <span className="text-xs font-bold text-[var(--text)]">اللون البارز (8 خيارات):</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ACCENT_OPTIONS.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => setAccent(acc.id)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                accent === acc.id
                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary)] bg-[var(--surface-2)] text-[var(--text)]'
                  : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <span
                data-accent={acc.id}
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-[var(--border)]"
                style={{ backgroundColor: 'var(--primary)' }}
              />
              <span>{acc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* BottomBar Handedness Alignment & Live Preview */}
      <div className="flex flex-col gap-3 pt-2.5 border-t border-[var(--border)]">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[var(--text)]">
            محاذاة شريط التنقل السفلي حسب اليد المهيمنة (Handedness Docking):
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            يتحرك الشريط جهة اليد المستخدمة (يمين 12px، يسار 12px، أو منتصف)، أو اسحب الشريط السفلي مباشرة يميناً أو يساراً لتغيير مكانه.
          </span>
        </div>

        <SegmentedControl<Handedness>
          options={[
            { value: 'center', label: 'منتصف' },
            { value: 'right', label: 'اليد اليمنى' },
            { value: 'left', label: 'اليد اليسرى' },
          ]}
          value={handedness}
          onChange={setHandedness}
        />

        <div className="w-full h-20 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 relative flex items-center overflow-hidden">
          <div className="absolute top-2 start-3 text-[11px] font-bold text-[var(--text-muted)]">
            معاينة حية لمحاذاة الشريط السفلي
          </div>
          <div
            className={`absolute bottom-2.5 h-10 w-48 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] shadow-md flex items-center justify-around px-2 transition-all duration-300 ${
              handedness === 'right'
                ? 'right-3'
                : handedness === 'left'
                ? 'left-3'
                : 'inset-x-0 mx-auto'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)] opacity-60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)] opacity-60" />
            <span className="w-3 h-3 rounded-full bg-[var(--primary)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)] opacity-60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)] opacity-60" />
          </div>
        </div>
      </div>

      {/* Font scale slider */}
      <div className="flex flex-col gap-2 pt-2.5 border-t border-[var(--border)]">
        <div className="flex justify-between text-xs font-bold text-[var(--text)]">
          <span>مقياس حجم الخط:</span>
          <span className="font-mono tabular-nums text-[var(--primary)]">
            {Math.round(fontScale * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.85"
          max="1.50"
          step="0.05"
          value={fontScale}
          onChange={(e) => setFontScale(parseFloat(e.target.value))}
          className="w-full h-2 rounded-lg bg-[var(--border)] accent-[var(--primary)] cursor-pointer"
        />
      </div>

      {/* Numerals system */}
      <div className="flex flex-col gap-1.5 pt-2.5 border-t border-[var(--border)]">
        <span className="text-xs font-bold text-[var(--text)]">نظام الأرقام:</span>
        <SegmentedControl<NumeralSystem>
          options={[
            { value: 'arabic-indic', label: 'أرقام مشرقية (١ ٢ ٣)' },
            { value: 'western', label: 'أرقام مغربية (1 2 3)' },
          ]}
          value={numeralSystem}
          onChange={setNumeralSystem}
        />
      </div>

      <div className="flex flex-col divide-y divide-[var(--border)] pt-2.5 border-t border-[var(--border)]">
        <Switch
          checked={reduceMotion}
          onChange={setReduceMotion}
          label="تقليل الحركة (Reduce Motion)"
          description="تعطيل الحركات التفاعلية السريعة لحماية العينين وتوفير البطارية."
        />
        <Switch
          checked={dataSaver}
          onChange={setDataSaver}
          label="توفير البيانات (Data Saver)"
          description="تقليل جودة صور المعاينة لتوفير حزم بيانات شبكات الهاتف العراقية."
        />
      </div>

      <PWAInstallButton />
    </div>
  );
}
