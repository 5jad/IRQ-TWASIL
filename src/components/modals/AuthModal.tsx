import React from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { LogoMark } from '../ui/LogoMark';
import { OtpAuthFlow } from '../auth/OtpAuthFlow';

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'onboarding';
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل الدخول إلى تواصل"
      testId="tw-auth-modal"
      contentClassName="max-w-md"
    >
      <div className="w-full bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <h2 className="text-lg font-bold text-[var(--text)]">
              تسجيل الدخول أو إنشاء حساب
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <OtpAuthFlow
          redirectOnSuccess={false}
          initialPurpose={initialMode === 'register' ? 'signup' : 'login'}
          onSuccess={onClose}
        />
      </div>
    </Modal>
  );
}
