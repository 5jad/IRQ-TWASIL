import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Music,
  Play,
  Pause,
  Users,
  Heart,
  Trash2,
  Send,
  Check,
  Clock,
  X,
} from 'lucide-react';
import type { SocialMoment, StoryAudience, User } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import {
  NOTE_COUNTER_THRESHOLD,
  NOTE_MAX_CHARS,
} from '../../lib/storyUtils';
import { SEED_AUDIO_TRACKS, type SeedAudioTrack } from '../../lib/createUtils';
import { formatNumber, formatTimeSafe } from '../../lib/formatters';

interface ChooserSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPickNote: () => void;
  onPickInstant: () => void;
}

export function MomentChooserSheet({
  isOpen,
  onClose,
  onPickNote,
  onPickInstant,
}: ChooserSheetProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إضافة"
      testId="tw-moment-chooser-sheet"
      className="!p-0 !items-end !justify-center"
      contentClassName="max-w-md w-full rounded-t-[24px] bg-[var(--surface)] text-[var(--text)] border-t border-[var(--border)] shadow-2xl pb-[env(safe-area-inset-bottom,16px)]"
    >
      <div className="p-4 flex flex-col gap-3">
        <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
        <h2 className="text-base font-bold text-center">إضافة جديدة</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            data-testid="tw-choose-note"
            onClick={() => {
              onClose();
              onPickNote();
            }}
            className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="w-11 h-11 rounded-full bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold">ملاحظة</span>
          </button>

          <button
            type="button"
            data-testid="tw-choose-instant"
            onClick={() => {
              onClose();
              onPickInstant();
            }}
            className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="w-11 h-11 rounded-full bg-[var(--lapis-tint)] text-[var(--lapis)] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold">لحظة</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface NoteComposerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  existingNote: SocialMoment | null;
  numeralSystem: 'arabic-indic' | 'western';
  onPublish: (input: { text: string; soundId?: string; audience: StoryAudience }) => void;
  onDelete: () => void;
}

export function NoteComposerSheet({
  isOpen,
  onClose,
  currentUser,
  existingNote,
  numeralSystem,
  onPublish,
  onDelete,
}: NoteComposerSheetProps) {
  const [text, setText] = useState('');
  const [soundId, setSoundId] = useState<string | undefined>(undefined);
  const [audience, setAudience] = useState<StoryAudience>('everyone');
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setText(existingNote?.text ?? '');
      setSoundId(existingNote?.soundId);
      setAudience(existingNote?.audience ?? 'everyone');
      setSoundPickerOpen(false);
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingTrackId(null);
    }
  }, [isOpen, existingNote]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const selectedTrack = SEED_AUDIO_TRACKS.find((t) => t.id === soundId) ?? null;

  const togglePreview = (track: SeedAudioTrack) => {
    const a = audioRef.current;
    if (!a) return;
    if (playingTrackId === track.id) {
      a.pause();
      a.currentTime = 0;
      setPlayingTrackId(null);
      return;
    }
    a.src = track.audioUrl;
    a.currentTime = 0;
    a.volume = 0.8;
    void a.play().catch(() => {});
    setPlayingTrackId(track.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    audioRef.current?.pause();
    onPublish({ text: trimmed.slice(0, NOTE_MAX_CHARS), soundId, audience });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ملاحظة جديدة"
      testId="tw-note-composer-sheet"
      className="!p-0 !items-end !justify-center"
      contentClassName="max-w-md w-full !max-h-[82vh] rounded-t-[24px] bg-[var(--surface)] text-[var(--text)] border-t border-[var(--border)] shadow-2xl overflow-y-auto pb-[env(safe-area-inset-bottom,16px)]"
    >
      <audio ref={audioRef} preload="none" onEnded={() => setPlayingTrackId(null)} />
      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
        <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[var(--text-muted)] px-2 py-1"
          >
            إلغاء
          </button>
          <h2 className="text-base font-bold">ملاحظة جديدة</h2>
          <button
            type="submit"
            data-testid="tw-note-submit-btn"
            disabled={!text.trim()}
            className="px-4 h-9 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold disabled:opacity-40"
          >
            مشاركة
          </button>
        </div>

        {/* User Avatar + Speech Bubble Input */}
        <div className="flex flex-col items-center gap-2.5 pt-2">
          <div className="relative w-full rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-3">
            <textarea
              rows={2}
              maxLength={NOTE_MAX_CHARS}
              data-testid="tw-note-input"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX_CHARS))}
              placeholder="شنو يدور براسك؟"
              className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none leading-relaxed"
              autoFocus
            />
            {text.length >= NOTE_COUNTER_THRESHOLD && (
              <div
                data-testid="tw-note-counter"
                className={`text-[11px] font-bold text-end mt-1 ${
                  text.length >= NOTE_MAX_CHARS ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {formatNumber(text.length, numeralSystem)}/{formatNumber(NOTE_MAX_CHARS, numeralSystem)}
              </div>
            )}
          </div>

          <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={52} />
        </div>

        {/* Music & Audience Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            data-testid="tw-note-music-btn"
            onClick={() => setSoundPickerOpen((v) => !v)}
            className={`h-10 px-3 rounded-full border flex items-center gap-1.5 text-xs font-bold ${
              selectedTrack
                ? 'bg-[var(--primary-tint)] border-[var(--primary)] text-[var(--primary-text)]'
                : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>{selectedTrack ? selectedTrack.title : 'إضافة مقطع موسيقي'}</span>
          </button>

          {selectedTrack && (
            <button
              type="button"
              onClick={() => setSoundId(undefined)}
              aria-label="إزالة المقطع الموسيقي"
              className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            data-testid="tw-note-audience-btn"
            onClick={() =>
              setAudience((a) => (a === 'everyone' ? 'close-friends' : 'everyone'))
            }
            className="h-10 px-3 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold flex items-center gap-1.5"
          >
            {audience === 'close-friends' ? (
              <>
                <Heart className="w-3.5 h-3.5 text-[var(--success)]" />
                <span>الأصدقاء المقرّبون</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-[var(--lapis)]" />
                <span>الأصدقاء</span>
              </>
            )}
          </button>
        </div>

        {soundPickerOpen && (
          <div
            data-testid="tw-note-sound-list"
            className="flex flex-col gap-1.5 max-h-48 overflow-y-auto p-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]"
          >
            {SEED_AUDIO_TRACKS.map((track) => {
              const isPlaying = playingTrackId === track.id;
              const chosen = soundId === track.id;
              return (
                <div
                  key={track.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                >
                  <button
                    type="button"
                    onClick={() => togglePreview(track)}
                    aria-label={isPlaying ? `إيقاف ${track.title}` : `تشغيل ${track.title}`}
                    className="w-9 h-9 rounded-lg bg-[var(--surface-2)] flex items-center justify-center shrink-0"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    data-testid={`tw-note-pick-sound-${track.id}`}
                    onClick={() => {
                      setSoundId(chosen ? undefined : track.id);
                      setSoundPickerOpen(false);
                      audioRef.current?.pause();
                      setPlayingTrackId(null);
                    }}
                    className="flex-1 text-start min-w-0"
                  >
                    <p className="text-xs font-bold truncate">{track.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{track.artist}</p>
                  </button>
                  {chosen && <Check className="w-4 h-4 text-[var(--primary)] shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {existingNote && (
          <button
            type="button"
            data-testid="tw-note-delete-btn"
            onClick={() => {
              audioRef.current?.pause();
              onDelete();
              onClose();
            }}
            className="h-10 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف الملاحظة</span>
          </button>
        )}
      </form>
    </Modal>
  );
}

interface NoteViewerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  note: SocialMoment | null;
  author: User | null;
  isOwn: boolean;
  numeralSystem: 'arabic-indic' | 'western';
  onEditOwn: () => void;
  onDeleteOwn: () => void;
  onReply: (author: User, noteText: string | undefined, replyText: string) => void;
}

export function NoteViewerSheet({
  isOpen,
  onClose,
  note,
  author,
  isOwn,
  numeralSystem,
  onEditOwn,
  onDeleteOwn,
  onReply,
}: NoteViewerSheetProps) {
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = note?.soundId
    ? SEED_AUDIO_TRACKS.find((t) => t.id === note.soundId) ?? null
    : null;

  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlayingAudio(false);
      setReplySent(false);
      setReplyText('');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (!isOpen || !note || !author) return null;

  const msLeft = Math.max(0, Date.parse(note.expiresAt) - Date.now());
  const hoursLeft = Math.max(1, Math.ceil(msLeft / (3600 * 1000)));

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !track) return;
    if (isPlayingAudio) {
      a.pause();
      setIsPlayingAudio(false);
    } else {
      a.src = track.audioUrl;
      a.loop = true;
      a.volume = 0.85;
      void a.play().catch(() => {});
      setIsPlayingAudio(true);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onReply(author, note.text, replyText);
    setReplyText('');
    setReplySent(true);
    setTimeout(() => {
      onClose();
    }, 650);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`ملاحظة ${author.displayName}`}
      testId="tw-note-viewer-sheet"
      className="!p-0 !items-end !justify-center"
      contentClassName="max-w-md w-full rounded-t-[24px] bg-[var(--surface)] text-[var(--text)] border-t border-[var(--border)] shadow-2xl pb-[env(safe-area-inset-bottom,16px)]"
    >
      <audio ref={audioRef} preload="none" />
      <div className="p-4 flex flex-col gap-4">
        <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar src={author.avatarUrl} name={author.displayName} size={42} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold truncate">{author.displayName}</span>
                <VerifiedBadge kind={author.verifiedKind} size={13} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <span>{formatTimeSafe(note.createdAt, numeralSystem)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>متبقي {formatNumber(hoursLeft, numeralSystem)} ساعة</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-center">
          <p data-testid="tw-note-viewer-text" className="text-base font-bold leading-relaxed">
            {note.text}
          </p>
        </div>

        {track && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
                <Music className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{track.title}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{track.artist}</p>
              </div>
            </div>

            <button
              type="button"
              data-testid="tw-note-audio-toggle"
              onClick={togglePlay}
              aria-label={isPlayingAudio ? 'إيقاف الصوت' : 'تشغيل الصوت'}
              className="w-10 h-10 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shrink-0"
            >
              {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        )}

        {isOwn ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditOwn();
              }}
              className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
            >
              تحديث الملاحظة
            </button>
            <button
              type="button"
              data-testid="tw-note-viewer-delete"
              onClick={() => {
                onDeleteOwn();
                onClose();
              }}
              className="h-11 px-4 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف الملاحظة</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendReply} className="flex flex-col gap-2">
            {replySent && (
              <div className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold text-center">
                تم إرسال ردك في المحادثة
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                data-testid="tw-note-reply-input"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="أرسل رد..."
                className="flex-1 h-11 px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <button
                type="submit"
                data-testid="tw-note-reply-send"
                disabled={!replyText.trim()}
                aria-label="إرسال رد"
                className="w-11 h-11 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <Send className="w-4 h-4 -scale-x-100" />
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
