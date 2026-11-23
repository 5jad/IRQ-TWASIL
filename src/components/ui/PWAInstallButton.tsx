import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Modal } from './Modal';
import { Button } from './Button';

export interface PWAInstallButtonProps {
  className?: string;
  compact?: boolean;
}

export function PWAInstallButton({ className = '', compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        data-testid="tw-pwa-install-btn"
        onClick={() => void install()}
        className={`w-full rounded-xl bg-[var(--accent-tint)] text-[var(--accent-text)] border border-[var(--accent)]/30 font-bold flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 transition-all ${
          compact ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-xs'
        } ${className}`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>تثبيت تطبيق تواصل على الجهاز</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          data-testid="tw-pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          className={`w-full rounded-xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] font-semibold flex items-center justify-center gap-2 hover:bg-[var(--surface)] transition-colors ${
            compact ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-xs'
          } ${className}`}
        >
          <Smartphone className="w-4 h-4 shrink-0 text-[var(--primary)]" />
          <span>تثبيت التطبيق على iPhone / iPad</span>
        </button>

        <Modal
          isOpen={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="تثبيت تطبيق تواصل"
          contentClassName="max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5"
        >
          <div className="flex flex-col gap-3 text-sm text-[var(--text)]">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              لتثبيت منصة تواصل كتطبيق مستقل على جهازك:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs font-medium">
              <li>اضغط على زر المشاركة (Share) في شريط Safari بالأسفل.</li>
              <li>مرّر للأسفل واختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).</li>
              <li>اضغط «إضافة» ليظهر التطبيق بجانب تطبيقاتك.</li>
            </ol>
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowIOSGuide(false)}
              className="mt-2 h-10 text-xs"
            >
              فهمت
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  return null;
}
