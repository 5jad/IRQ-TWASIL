import React, { useEffect, useState } from 'react';
import { X, Copy, Check, QrCode, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Modal } from '../ui/Modal';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

export function ShareModal({ isOpen, onClose, title, url }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (!isOpen || !showQr || !url) {
      return;
    }
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, showQr, url]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (err) {
        // cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مشاركة المحتوى"
      testId="tw-share-modal"
      className="items-end sm:items-center"
      contentClassName="max-w-md"
    >
      <div className="w-full bg-[var(--surface)] sm:rounded-3xl rounded-t-3xl border border-[var(--border)] p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="text-base font-bold text-[var(--text)]">مشاركة المحتوى</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Grid */}
        <div className="grid grid-cols-3 gap-2 py-2">
          <button
            type="button"
            onClick={handleCopy}
            className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center gap-1.5 hover:border-[var(--primary)] transition-all active:scale-95"
          >
            {copied ? (
              <Check className="w-6 h-6 text-[var(--success)]" />
            ) : (
              <Copy className="w-6 h-6 text-[var(--primary)]" />
            )}
            <span className="text-xs font-semibold text-[var(--text)]">
              {copied ? 'تم النسخ!' : 'نسخ الرابط'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center gap-1.5 hover:border-[var(--primary)] transition-all active:scale-95"
          >
            <Share2 className="w-6 h-6 text-[var(--accent)]" />
            <span className="text-xs font-semibold text-[var(--text)]">مشاركة خارجية</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center gap-1.5 hover:border-[var(--primary)] transition-all active:scale-95"
          >
            <QrCode className="w-6 h-6 text-[var(--text)]" />
            <span className="text-xs font-semibold text-[var(--text)]">رمز QR</span>
          </button>
        </div>

        {/* QR Code preview */}
        {showQr && (
          <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center justify-center gap-2">
            <div className="w-40 h-40 border-2 border-[var(--border-strong)] p-2 rounded-xl flex items-center justify-center bg-white">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="رمز الاستجابة السريعة"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <QrCode className="w-12 h-12 text-slate-800 animate-pulse" />
              )}
            </div>
            <span className="text-xs font-bold text-[var(--text)]">امسح الرمز لفتح الرابط مباشرة</span>
          </div>
        )}

        {/* URL Box */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] truncate flex-1 font-mono" dir="ltr">
            {url}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1 text-xs font-bold rounded-lg bg-[var(--primary)] text-[var(--primary-fg)] shrink-0 active:scale-95"
          >
            {copied ? 'تم' : 'نسخ'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
