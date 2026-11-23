import React, { useState, useEffect, useRef } from 'react';
import {
  Link2,
  AlignRight,
  ChevronDown,
  Radio,
  SwitchCamera,
  Globe,
  Star,
  EyeOff,
  Info,
  Check,
  X,
} from 'lucide-react';
import { CAMERA_FILTERS } from '../../lib/createUtils';
import { formatNumber } from '../../lib/formatters';
import { useApp } from '../../context/AppContext';
import type { CameraFilterId } from '../../types';
import { Modal } from '../ui/Modal';

export type LiveAudienceMode = 'everyone' | 'close-friends' | 'private';

export interface LiveModeControlsProps {
  activeFilter: CameraFilterId;
  onSelectFilter: (id: CameraFilterId) => void;
  onFlipCamera: () => void;
  onStopAllTracks: () => void;
  onCloseCreate: () => void;
  onLiveActiveChange?: (active: boolean) => void;
  numeralSystem: 'arabic-indic' | 'western';
}

function formatElapsed(sec: number, numeralSystem: 'arabic-indic' | 'western'): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mStr = m < 10 ? `${formatNumber(0, numeralSystem)}${formatNumber(m, numeralSystem)}` : formatNumber(m, numeralSystem);
  const sStr = s < 10 ? `${formatNumber(0, numeralSystem)}${formatNumber(s, numeralSystem)}` : formatNumber(s, numeralSystem);
  return `${mStr}:${sStr}`;
}

export function LiveModeControls({
  activeFilter,
  onSelectFilter,
  onFlipCamera,
  onStopAllTracks,
  onCloseCreate,
  onLiveActiveChange,
  numeralSystem,
}: LiveModeControlsProps) {
  const { users } = useApp();
  const closeFriendsCount = users.filter((u) => u.isCloseFriend).length;
  const [liveTitle, setLiveTitle] = useState('');
  const [liveLink, setLiveLink] = useState('');
  const [audience, setAudience] = useState<LiveAudienceMode>('everyone');
  const [activeSubSheet, setActiveSubSheet] = useState<null | 'title' | 'link' | 'audience' | 'confirm-end' | 'how'>(null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onLiveActiveChange?.(countdown !== null || isLiveActive);
    return () => onLiveActiveChange?.(false);
  }, [countdown, isLiveActive, onLiveActiveChange]);

  useEffect(() => {
    if (!isLiveActive) return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isLiveActive]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const startCountdown = () => {
    if (countdown !== null || isLiveActive) return;
    let rem = 3;
    setCountdown(rem);
    countdownTimerRef.current = setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(null);
        setElapsedSec(0);
        setIsLiveActive(true);
      } else {
        setCountdown(rem);
      }
    }, 1000);
  };

  const audienceLabel =
    audience === 'close-friends'
      ? 'الأصدقاء المقرّبون'
      : audience === 'private'
      ? 'خاص'
      : 'الجميع';

  const previewFilters = CAMERA_FILTERS.slice(0, 3);

  return (
    <>
      {/* 1. Pre-Live Setup Controls */}
      {!isLiveActive && (
        <>
          {/* Start-side vertical icons at y = 419 and y = 463 */}
          <div className="absolute top-[397px] start-[10px] z-30 flex flex-col gap-0">
            <button
              type="button"
              data-testid="tw-live-link-btn"
              onClick={() => setActiveSubSheet('link')}
              className="h-[44px] ps-[6px] pe-3 flex items-center gap-[13px] text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)] active:scale-95"
            >
              <Link2 className="w-[28px] h-[28px]" />
              <span className="text-[15px] font-semibold">إرفاق رابط</span>
            </button>

            <button
              type="button"
              data-testid="tw-live-title-btn"
              onClick={() => setActiveSubSheet('title')}
              className="h-[44px] ps-[6px] pe-3 flex items-center gap-[13px] text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)] active:scale-95"
            >
              <AlignRight className="w-[28px] h-[28px]" />
              <span className="text-[15px] font-semibold">عنوان البث</span>
            </button>
          </div>

          {/* Selected Title/Link Badge near top */}
          {(liveTitle || liveLink) && (
            <div className="absolute top-[104px] inset-x-10 z-20 flex flex-col items-center gap-1 pointer-events-none">
              {liveTitle && (
                <span className="px-3 py-1 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-xs font-bold text-[var(--cam-text)]">
                  {liveTitle}
                </span>
              )}
              {liveLink && (
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--cam-scrim)] text-[11px] text-[var(--cam-muted)] max-w-[220px] truncate" dir="ltr">
                  {liveLink}
                </span>
              )}
            </div>
          )}

          {/* Centered Audience Pill at y = 658 (height 30, min-w 106) */}
          <button
            type="button"
            data-testid="tw-live-audience-pill"
            onClick={() => setActiveSubSheet('audience')}
            className="absolute top-[min(643px,calc(100%-201px))] left-1/2 -translate-x-1/2 z-30 min-w-[106px] h-[30px] px-3 rounded-full bg-[var(--live)]/25 backdrop-blur-md border border-white/15 text-[var(--cam-text)] flex items-center justify-center gap-1.5 text-xs font-bold"
          >
            <span>{audienceLabel}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Shutter 68x68 at y = 736 + 3 effects + flip */}
          <div className="absolute top-[min(702px,calc(100%-142px))] inset-x-0 z-30 h-[68px] flex items-center justify-center">
            <button
              type="button"
              data-testid="tw-live-shutter"
              onClick={startCountdown}
              aria-label="بدء البث المباشر"
              className="w-[68px] h-[68px] rounded-full border-4 border-[var(--cam-text)] bg-[var(--live)] text-[var(--cam-text)] flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            >
              <Radio className="w-7 h-7" />
            </button>

            {/* 3 effect circles on end side of shutter */}
            <div className="absolute start-[244px] flex items-center gap-[6px]">
              {previewFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`فلتر ${f.label}`}
                  onClick={() => onSelectFilter(f.id)}
                  className={`w-[38px] h-[38px] rounded-full border-2 ${
                    activeFilter === f.id ? 'border-[var(--primary)] scale-105' : 'border-white/75'
                  }`}
                  style={{ background: f.swatchGradient }}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onFlipCamera}
            aria-label="تبديل الكاميرا"
            className="absolute bottom-[calc(25px+env(safe-area-inset-bottom,0px))] end-[12px] z-30 w-[44px] h-[44px] flex items-center justify-center text-[var(--cam-text)] active:scale-95"
          >
            <SwitchCamera className="w-[26px] h-[26px]" />
          </button>
        </>
      )}

      {/* 2. Countdown 3-2-1 Overlay */}
      {countdown !== null && (
        <div
          data-testid="tw-live-countdown"
          className="absolute inset-0 z-40 bg-[var(--cam-scrim)] flex flex-col items-center justify-center gap-2"
        >
          <span className="text-[96px] font-bold leading-none text-[var(--cam-text)] drop-shadow-xl">
            {formatNumber(countdown, numeralSystem)}
          </span>
          <span className="text-sm font-bold text-[var(--cam-text)]">يبدأ البث خلال لحظات...</span>
        </div>
      )}

      {/* 3. Active Local Preview Live State */}
      {isLiveActive && (
        <div
          data-testid="tw-live-active-overlay"
          className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-between p-4 pt-[calc(48px+env(safe-area-inset-top,0px))] pb-[calc(32px+env(safe-area-inset-bottom,0px))]"
        >
          {/* Top Live Header */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="px-2.5 h-7 rounded-full bg-[var(--live)] text-[var(--cam-text)] text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>مباشر</span>
              </span>
              <span className="px-2.5 h-7 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-[var(--cam-text)] text-xs font-bold flex items-center">
                {formatElapsed(elapsedSec, numeralSystem)}
              </span>
              <span className="px-2.5 h-7 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-[var(--cam-text)] text-xs font-semibold flex items-center">
                {formatNumber(0, numeralSystem)} مشاهد
              </span>
            </div>

            <button
              type="button"
              data-testid="tw-live-end-btn"
              onClick={() => setActiveSubSheet('confirm-end')}
              className="px-3.5 h-9 rounded-full bg-[var(--live)] text-[var(--cam-text)] text-xs font-bold shadow-lg"
            >
              إنهاء
            </button>
          </div>

          {/* Middle Local Preview Notice + Title */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            {liveTitle && (
              <p className="px-3 py-1 rounded-xl bg-[var(--cam-scrim)] text-sm font-bold text-[var(--cam-text)]">
                {liveTitle}
              </p>
            )}
            <span className="px-3 py-1 rounded-full bg-[var(--cam-surface)]/90 border border-white/10 text-[11px] font-semibold text-[var(--cam-muted)]">
              تجربة محلية، لا يوجد بث فعلي
            </span>
          </div>

          {/* Empty Comments Area + Flip */}
          <div className="flex items-end justify-between pointer-events-auto">
            <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--cam-scrim)] backdrop-blur-md text-xs text-[var(--cam-muted)]">
              لا توجد تعليقات بعد
            </div>
            <button
              type="button"
              onClick={onFlipCamera}
              aria-label="تبديل الكاميرا"
              className="w-11 h-11 rounded-full bg-[var(--cam-scrim)] text-[var(--cam-text)] flex items-center justify-center"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Sub-sheets for Live Title, Link, Audience, End Confirm */}
      <Modal
        isOpen={Boolean(activeSubSheet)}
        onClose={() => setActiveSubSheet(null)}
        title="خيارات البث المباشر"
        testId="tw-live-sheet"
        className="!p-0 !items-end !justify-center"
        contentClassName="max-w-md w-full !max-h-[70vh] rounded-t-[24px] bg-[var(--cam-surface)] text-[var(--cam-text)] border-t border-white/10 shadow-2xl overflow-y-auto pb-[env(safe-area-inset-bottom,16px)]"
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="w-[36px] h-[4px] rounded-full bg-[var(--cam-muted)]/40 mx-auto" />

          {activeSubSheet === 'title' && (
            <>
              <h3 className="text-base font-bold text-center">عنوان البث</h3>
              <input
                type="text"
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="اكتب عنوان البث المباشر..."
                className="h-11 px-3 rounded-xl bg-[var(--cam-surface-2)] text-sm text-[var(--cam-text)] placeholder:text-[var(--cam-muted)]"
              />
              <button
                type="button"
                onClick={() => setActiveSubSheet(null)}
                className="h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-sm font-bold"
              >
                حفظ العنوان
              </button>
            </>
          )}

          {activeSubSheet === 'link' && (
            <>
              <h3 className="text-base font-bold text-center">إرفاق رابط</h3>
              <input
                type="url"
                dir="ltr"
                value={liveLink}
                onChange={(e) => setLiveLink(e.target.value)}
                placeholder="https://example.com"
                className="h-11 px-3 rounded-xl bg-[var(--cam-surface-2)] text-sm text-[var(--cam-text)] placeholder:text-[var(--cam-muted)]"
              />
              <button
                type="button"
                onClick={() => setActiveSubSheet(null)}
                className="h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-sm font-bold"
              >
                إرفاق
              </button>
            </>
          )}

          {activeSubSheet === 'audience' && (
            <div data-testid="tw-live-audience-sheet" className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="w-8" />
                <h3 className="text-base font-bold">الجمهور</h3>
                <button
                  type="button"
                  onClick={() => setActiveSubSheet(null)}
                  aria-label="إغلاق"
                  className="w-8 h-8 flex items-center justify-center text-[var(--cam-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAudience('everyone');
                  setActiveSubSheet(null);
                }}
                className={`h-12 px-4 rounded-2xl border flex items-center justify-between ${
                  audience === 'everyone'
                    ? 'border-[var(--primary)] bg-[var(--cam-surface-2)]'
                    : 'border-white/10 bg-[var(--cam-surface-2)]/50'
                }`}
              >
                <span className="flex items-center gap-3 text-sm font-bold">
                  <Globe className="w-5 h-5 text-[var(--primary)]" />
                  <span>الجميع</span>
                </span>
                {audience === 'everyone' && <Check className="w-5 h-5 text-[var(--primary)]" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAudience('close-friends');
                  setActiveSubSheet(null);
                }}
                className={`h-14 px-4 rounded-2xl border flex items-center justify-between ${
                  audience === 'close-friends'
                    ? 'border-[var(--primary)] bg-[var(--cam-surface-2)]'
                    : 'border-white/10 bg-[var(--cam-surface-2)]/50'
                }`}
              >
                <span className="flex items-center gap-3 text-start">
                  <Star className="w-5 h-5 text-[var(--success)] fill-current" />
                  <span className="flex flex-col">
                    <span className="text-sm font-bold">الأصدقاء المقرّبون</span>
                    <span className="text-xs text-[var(--cam-muted)]">
                      {formatNumber(closeFriendsCount, numeralSystem)} شخصاً
                    </span>
                  </span>
                </span>
                {audience === 'close-friends' && (
                  <Check className="w-5 h-5 text-[var(--primary)]" />
                )}
              </button>

              {/* Info Box (--cam-surface-2, radius 12, pad 12) */}
              <div className="rounded-[12px] bg-[var(--cam-surface-2)] p-[12px] flex items-start gap-2.5 text-xs text-[var(--cam-muted)] leading-relaxed">
                <Info className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                <div>
                  <p>
                    عند اختيار الأصدقاء المقرّبين أو الخاص، يظهر البث للمدعوين فقط داخل التجربة المحلية.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSubSheet('how')}
                    className="mt-1 text-[var(--primary)] font-bold underline"
                  >
                    كيف يعمل
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAudience('private');
                  setActiveSubSheet(null);
                }}
                className={`h-12 px-4 rounded-2xl border flex items-center justify-between ${
                  audience === 'private'
                    ? 'border-[var(--primary)] bg-[var(--cam-surface-2)]'
                    : 'border-white/10 bg-[var(--cam-surface-2)]/50'
                }`}
              >
                <span className="flex items-center gap-3 text-sm font-bold">
                  <EyeOff className="w-5 h-5 text-[var(--cam-muted)]" />
                  <span>خاص</span>
                </span>
                {audience === 'private' && <Check className="w-5 h-5 text-[var(--primary)]" />}
              </button>
            </div>
          )}

          {activeSubSheet === 'how' && (
            <div className="flex flex-col gap-3 text-center py-2">
              <h3 className="text-base font-bold">كيف يعمل البث التجريبي</h3>
              <p className="text-xs text-[var(--cam-muted)] leading-relaxed">
                يعرض هذا الوضع معاينة محلية كاملة لواجهة البث المباشر على جهازك فقط، دون إرسال صوت أو صورة عبر الشبكة.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubSheet('audience')}
                className="h-10 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
              >
                رجوع
              </button>
            </div>
          )}

          {activeSubSheet === 'confirm-end' && (
            <div data-testid="tw-live-confirm-end" className="flex flex-col gap-3 text-center py-1">
              <h3 className="text-base font-bold">إنهاء البث المباشر؟</h3>
              <p className="text-xs text-[var(--cam-muted)]">
                سيتم إيقاف المعاينة المحلية وإغلاق الكاميرا.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubSheet(null)}
                  className="flex-1 h-11 rounded-xl bg-[var(--cam-surface-2)] text-sm font-bold"
                >
                  متابعة البث
                </button>
                <button
                  type="button"
                  data-testid="tw-live-confirm-end-btn"
                  onClick={() => {
                    setActiveSubSheet(null);
                    setIsLiveActive(false);
                    onStopAllTracks();
                    onCloseCreate();
                  }}
                  className="flex-1 h-11 rounded-xl bg-[var(--live)] text-[var(--cam-text)] text-sm font-bold"
                >
                  إنهاء الآن
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
