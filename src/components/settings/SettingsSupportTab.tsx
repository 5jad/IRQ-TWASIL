import React from 'react';
import { HelpCircle } from 'lucide-react';

export function SettingsSupportTab() {
  return (
    <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
      <h3 className="text-sm font-bold text-[var(--text)] border-b border-[var(--border)] pb-2.5 flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-[var(--primary)]" />
        <span>الدعم الفني وميثاق الأمان العراقي</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-1.5">
          <span className="text-xs font-bold text-[var(--text)]">البريد الإلكتروني للدعم:</span>
          <span className="text-xs text-[var(--primary)] font-mono" dir="ltr">
            support@irq-tawasul.iq
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">رد سريع خلال ٢٤ ساعة.</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-1.5">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
            خط مساندة مكافحة الابتزاز:
          </span>
          <span className="text-xs font-bold text-[var(--text)]">
            الخط الساخن: 131 (جهاز الأمن الوطني العراقي)
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">معاملة سرية وفورية للبلاغات الحساسة.</span>
        </div>
      </div>

      <div className="text-xs text-[var(--text-muted)] leading-relaxed pt-2 border-t border-[var(--border)]">
        <span>منصة IRQ تواصل · الإصدار 1.1 المعتمد · صُنع بحب في العراق 🇮🇶</span>
        <span className="block mt-1">تطوير: IRQ Digital Technologies · جميع الحقوق محفوظة ٢٠٢٦</span>
      </div>
    </div>
  );
}
