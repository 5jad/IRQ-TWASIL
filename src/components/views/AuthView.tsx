import React from 'react';
import { useApp } from '../../context/AppContext';
import { Compass } from 'lucide-react';
import { LogoMark } from '../ui/LogoMark';
import { OtpAuthFlow } from '../auth/OtpAuthFlow';

export function AuthView() {
  const { setCurrentRoute } = useApp();

  return (
    <div
      data-testid="tw-auth-view"
      className="w-full min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-8 bg-[var(--bg)]"
    >
      <div className="w-full max-w-md flex flex-col items-center text-center mb-6 select-none">
        <div className="w-16 h-16 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-lg mb-3">
          <LogoMark size={40} />
        </div>
        <h1 className="font-display font-bold text-3xl text-[var(--text)] tracking-tight">
          تواصل
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 font-medium">
          كل العراق بمكان واحد · المنصة الاجتماعية والمراسلة الوطنية
        </p>
      </div>

      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <OtpAuthFlow redirectOnSuccess={true} />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          data-testid="tw-auth-guest-btn"
          onClick={() => setCurrentRoute('home')}
          className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1.5 transition-colors"
        >
          <Compass className="w-4 h-4" />
          <span>تصفح المنصة كزائر بدون حساب</span>
        </button>
      </div>

      <div className="mt-8 text-center text-[11px] text-[var(--text-muted)] flex flex-col items-center gap-1">
        <span>مبني وفق ميثاق حماية البيانات ومكافحة الابتزاز الإلكتروني في العراق 🇮🇶</span>
        <span>© ٢٠٢٦ IRQ Digital Technologies · جميع الحقوق محفوظة</span>
      </div>
    </div>
  );
}
