import React, { useState, useEffect, useRef } from 'react';
import { X, Send, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import type { StoryItem, User } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { useApp } from '../../context/AppContext';
import { formatTimeSafe } from '../../lib/formatters';
import { SQUIRCLE_CLIP_PATH_D } from '../../lib/createUtils';

export interface InstantEntry {
  user: User;
  items: StoryItem[];
}

export interface InstantsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: InstantEntry[];
  initialUserId: string;
}

export function InstantsViewerModal({
  isOpen,
  onClose,
  entries,
  initialUserId,
}: InstantsViewerModalProps) {
  const { numeralSystem, markInstantSeen, replyToMoment } = useApp();

  const initialIdx = Math.max(
    0,
    entries.findIndex((e) => e.user.id === initialUserId)
  );
  const [entryIdx, setEntryIdx] = useState(initialIdx);
  const [itemIdx, setItemIdx] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [replyNotice, setReplyNotice] = useState<string | null>(null);
  const swipeXRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      const idx = Math.max(
        0,
        entries.findIndex((e) => e.user.id === initialUserId)
      );
      setEntryIdx(idx);
      setItemIdx(0);
      setReplyNotice(null);
    }
  }, [isOpen, initialUserId, entries]);

  const safeEntry = entries[entryIdx] ?? entries[0];
  const safeItem = safeEntry?.items[itemIdx] ?? safeEntry?.items[0];

  useEffect(() => {
    if (isOpen && safeItem) {
      markInstantSeen(safeItem.id);
    }
  }, [isOpen, safeItem, markInstantSeen]);

  if (!safeEntry || !safeItem) return null;

  const goNext = () => {
    if (itemIdx < safeEntry.items.length - 1) {
      setItemIdx((i) => i + 1);
    } else if (entryIdx < entries.length - 1) {
      setEntryIdx((i) => i + 1);
      setItemIdx(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (itemIdx > 0) {
      setItemIdx((i) => i - 1);
    } else if (entryIdx > 0) {
      const prevEntry = entries[entryIdx - 1];
      setEntryIdx((i) => i - 1);
      setItemIdx(Math.max(0, (prevEntry?.items.length ?? 1) - 1));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goPrev();
    }
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    replyToMoment(safeEntry.user, safeItem.caption, replyText);
    setReplyNotice(`تم إرسال ردك إلى ${safeEntry.user.displayName.split(' ')[0]}`);
    setReplyText('');
    setTimeout(() => setReplyNotice(null), 2200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`لحظة ${safeEntry.user.displayName}`}
      testId="tw-instants-viewer"
      onKeyDown={handleKeyDown}
      className="bg-black !p-0"
      overlayClassName="bg-black"
      contentClassName="h-full !max-h-full flex items-center justify-center max-w-md"
    >
      <svg width="0" height="0" aria-hidden="true" className="absolute pointer-events-none">
        <defs>
          <clipPath id="tw-instants-viewer-squircle" clipPathUnits="objectBoundingBox">
            <path d={SQUIRCLE_CLIP_PATH_D} />
          </clipPath>
        </defs>
      </svg>

      <div
        className="relative w-full max-w-md h-full sm:h-[840px] sm:rounded-3xl overflow-hidden flex flex-col justify-between bg-[var(--cam-bg)] text-[var(--cam-text)] p-4 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-[calc(20px+env(safe-area-inset-bottom,0px))] select-none"
        onPointerDown={(e) => {
          swipeXRef.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipeXRef.current === null) return;
          const dx = e.clientX - swipeXRef.current;
          swipeXRef.current = null;
          if (dx < -45) goNext();
          else if (dx > 45) goPrev();
        }}
      >
        {/* Top User & Expiry Header */}
        <div className="flex flex-col gap-2.5 z-20">
          {entries.length > 1 && (
            <div className="flex items-center gap-1.5">
              {entries.map((entry, idx) => (
                <div
                  key={entry.user.id}
                  className={`h-1 flex-1 rounded-full ${
                    idx < entryIdx
                      ? 'bg-white'
                      : idx === entryIdx
                      ? 'bg-[var(--primary)]'
                      : 'bg-white/25'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar src={safeEntry.user.avatarUrl} name={safeEntry.user.displayName} size={38} />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold truncate">{safeEntry.user.displayName}</span>
                  <VerifiedBadge kind={safeEntry.user.verifiedKind} size={13} />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--cam-muted)]">
                  <span data-testid="tw-instant-time">
                    {formatTimeSafe(safeItem.createdAt, numeralSystem)}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{safeItem.expiresHint || 'تنتهي بعد ٢٤ ساعة'}</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="tw-instants-viewer-close"
              onClick={onClose}
              aria-label="إغلاق اللحظات"
              className="w-10 h-10 rounded-full bg-[var(--cam-surface)] text-[var(--cam-text)] flex items-center justify-center shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Squircle Media + Friend Prev/Next Controls */}
        <div className="relative flex-1 flex flex-col items-center justify-center gap-3 my-2">
          <div className="relative flex items-center justify-center w-full">
            {entryIdx > 0 && (
              <button
                type="button"
                onClick={goPrev}
                aria-label="اللحظة السابقة"
                className="absolute start-0 z-20 w-9 h-9 rounded-full bg-[var(--cam-scrim)] text-white flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            <div
              style={{ clipPath: 'url(#tw-instants-viewer-squircle)' }}
              className="w-[min(340px,calc(100%-24px))] aspect-square rounded-[34%] overflow-hidden bg-[var(--cam-surface)] border border-white/10 shadow-2xl flex items-center justify-center"
            >
              {safeItem.mediaType === 'video' ? (
                <video
                  key={safeItem.id}
                  src={safeItem.mediaUrl}
                  autoPlay
                  loop
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-[var(--cam-bg)]"
                />
              ) : (
                <img
                  src={safeItem.mediaUrl}
                  alt={safeItem.caption || 'لحظة'}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>

            {entryIdx < entries.length - 1 && (
              <button
                type="button"
                onClick={goNext}
                aria-label="اللحظة التالية"
                className="absolute end-0 z-20 w-9 h-9 rounded-full bg-[var(--cam-scrim)] text-white flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {safeItem.caption && (
            <p className="text-sm font-semibold text-center text-[var(--cam-text)] px-4">
              {safeItem.caption}
            </p>
          )}
        </div>

        {/* Bottom Reply Bar */}
        <div className="flex flex-col gap-2 z-20">
          {replyNotice && (
            <div className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold text-center">
              {replyNotice}
            </div>
          )}

          <form onSubmit={handleReplySubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`رد على لحظة ${safeEntry.user.displayName.split(' ')[0]}...`}
              className="flex-1 h-11 px-4 rounded-full bg-[var(--cam-surface-2)] border border-white/15 text-sm text-[var(--cam-text)] placeholder:text-[var(--cam-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              aria-label="إرسال رد"
              className="w-11 h-11 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shrink-0 disabled:opacity-40"
            >
              <Send className="w-4 h-4 -scale-x-100" />
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
