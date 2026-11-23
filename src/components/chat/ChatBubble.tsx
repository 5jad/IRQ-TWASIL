import React, { useState, useRef } from 'react';
import { ChatMessage } from '../../types';
import { Check, CheckCheck, Play, Pause, FileText, ExternalLink } from 'lucide-react';

export function ChatBubble({
  message,
  onCallbackQuery,
}: {
  message: ChatMessage;
  onCallbackQuery?: (messageId: string, data: string) => void;
}) {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleVoicePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !message.mediaUrl) {
      setIsPlayingVoice((v) => !v);
      return;
    }
    if (isPlayingVoice) {
      audio.pause();
      setIsPlayingVoice(false);
    } else {
      void audio
        .play()
        .then(() => setIsPlayingVoice(true))
        .catch(() => setIsPlayingVoice(false));
    }
  };

  const isOwn = message.isOwn;
  const inlineKeyboard = message.replyMarkup?.inline_keyboard;

  return (
    <div
      className={`flex flex-col mb-2.5 max-w-[82%] sm:max-w-[480px] ${
        isOwn ? 'ms-auto items-end' : 'me-auto items-start'
      }`}
    >
      <div
        className={`relative px-3.5 py-2.5 text-sm shadow-xs ${
          isOwn
            ? 'bg-[var(--bubble-own)] text-[var(--text)] rounded-2xl rounded-ee-sm'
            : 'bg-[var(--bubble-other)] text-[var(--text)] border border-[var(--border)] rounded-2xl rounded-es-sm'
        }`}
      >
        {/* Image Kind */}
        {message.kind === 'image' && message.mediaUrl && (
          <div className="mb-1.5 rounded-xl overflow-hidden border border-[var(--border)] bg-black/5">
            <img
              src={message.mediaUrl}
              alt={message.text || 'صورة مرفقة'}
              className="max-h-72 w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* File Kind */}
        {message.kind === 'file' && message.mediaUrl && (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1.5 flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface)]/80 border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[var(--text)] truncate">
                {message.text || 'ملف مرفق'}
              </span>
              <span className="text-[11px] text-[var(--primary)]">فتح / تنزيل الملف</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ms-auto" />
          </a>
        )}

        {/* Voice Note Kind */}
        {message.kind === 'voice' ? (
          <div className="flex items-center gap-3 py-1 min-w-[200px]">
            {message.mediaUrl && (
              <audio
                ref={audioRef}
                src={message.mediaUrl}
                preload="metadata"
                onEnded={() => setIsPlayingVoice(false)}
              />
            )}
            <button
              type="button"
              onClick={toggleVoicePlayback}
              className="w-10 h-10 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shrink-0 active:scale-95 shadow-xs"
              aria-label={isPlayingVoice ? 'إيقاف التسجيل الصوتي' : 'تشغيل التسجيل الصوتي'}
            >
              {isPlayingVoice ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ms-0.5" />}
            </button>

            {/* Waveform (28 bars) */}
            <div className="flex items-center gap-[2px] h-7 flex-1">
              {[12, 18, 24, 16, 28, 20, 14, 22, 26, 18, 12, 16, 24, 28, 18, 14, 20, 22, 16, 12, 18, 22, 14, 16, 24, 18, 12, 8].map(
                (h, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${h}px` }}
                    className={`w-[3px] rounded-full transition-colors ${
                      isPlayingVoice && idx < 12
                        ? 'bg-[var(--primary)]'
                        : 'bg-[var(--text-muted)] opacity-40'
                    }`}
                  />
                )
              )}
            </div>

            <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0">
              {message.voiceDuration ?? '0:30'}
            </span>
          </div>
        ) : (
          message.text && message.kind !== 'file' && (
            <p className="whitespace-pre-wrap leading-relaxed select-text">{message.text}</p>
          )
        )}

        {/* Footer line: Timestamp and ticks */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-[var(--text-muted)]">
          <span>{message.timestamp}</span>
          {isOwn && (
            <span>
              {message.status === 'read' ? (
                <CheckCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
              ) : message.status === 'delivered' ? (
                <CheckCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              ) : (
                <Check className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              )}
            </span>
          )}
        </div>

        {/* Reaction Pill (if present) */}
        {message.reaction && (
          <span className="absolute -bottom-2 end-2 px-1.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs shadow-xs">
            {message.reaction}
          </span>
        )}
      </div>

      {/* Inline Bot Keyboard */}
      {inlineKeyboard && inlineKeyboard.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1.5 w-full min-w-[200px]">
          {inlineKeyboard.map((row, rIdx) => (
            <div key={rIdx} className="flex flex-wrap gap-1.5">
              {row.map((btn, bIdx) =>
                btn.url && /^https?:\/\//i.test(btn.url) ? (
                  <a
                    key={bIdx}
                    href={btn.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[90px] h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--primary)] flex items-center justify-center gap-1 hover:border-[var(--primary)] transition-colors"
                  >
                    <span className="truncate">{btn.text}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <button
                    key={bIdx}
                    type="button"
                    onClick={() => btn.callback_data && onCallbackQuery?.(message.id, btn.callback_data)}
                    className="flex-1 min-w-[90px] h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:bg-[var(--primary-tint)] hover:text-[var(--primary-text)] hover:border-[var(--primary)] transition-colors"
                  >
                    {btn.text}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DateChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3 select-none">
      <span className="h-7 px-3.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] text-xs font-semibold flex items-center justify-center shadow-2xs">
        {label}
      </span>
    </div>
  );
}
