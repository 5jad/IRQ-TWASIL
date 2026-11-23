import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { StoryItem, StoryOverlayItem, User } from '../../types';
import { Music, X, Send, Volume2, VolumeX, Trash2, ImageOff } from 'lucide-react';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { formatTimeSafe } from '../../lib/formatters';
import { SEED_AUDIO_TRACKS } from '../../lib/createUtils';
import {
  filterActiveStories,
  findNextUnseenUserIndex,
  resolveStartStoryIndex,
} from '../../lib/storyUtils';

const LazyHeritageSvg = lazy(() =>
  import('../create/HeritageMotifs').then((m) => ({ default: m.HeritageSvg }))
);

export interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export function StoryViewerModal({ isOpen, onClose, user }: StoryViewerModalProps) {
  const {
    currentUser,
    storiesByUser,
    storyTrayUsers,
    storySeenMap,
    storyResumeMap,
    storyMuted,
    setStoryMuted,
    markStorySeen,
    saveStoryProgress,
    clearUserStoryProgress,
    deleteStory,
    voteStoryPoll,
    replyToMoment,
    numeralSystem,
  } = useApp();

  const [sessionQueue, setSessionQueue] = useState<User[]>([]);
  const [queueUserIdx, setQueueUserIdx] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isHoldPaused, setIsHoldPaused] = useState(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden
  );
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [quickReaction, setQuickReaction] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const replyInputRef = useRef<HTMLInputElement | null>(null);
  const seenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPaused = isHoldPaused || isReplyFocused || isTabHidden || isDeleting;

  // Snapshot session queue on modal open so live ring updates do not shift indices mid-session
  useEffect(() => {
    if (!isOpen) return;
    const ownActive = filterActiveStories(storiesByUser[currentUser.id] ?? []);
    const baseQueue: User[] = [
      ...(ownActive.length > 0 ? [currentUser] : []),
      ...storyTrayUsers.filter((u) => u.id !== currentUser.id),
    ];
    if (!baseQueue.some((u) => u.id === user.id)) {
      baseQueue.unshift(user);
    }
    const startUIdx = Math.max(
      0,
      baseQueue.findIndex((u) => u.id === user.id)
    );
    const targetUser = baseQueue[startUIdx] ?? user;
    const targetStories = filterActiveStories(storiesByUser[targetUser.id] ?? []);
    const startSIdx = resolveStartStoryIndex(
      targetStories,
      storySeenMap,
      storyResumeMap[targetUser.id]
    );

    setSessionQueue(baseQueue);
    setQueueUserIdx(startUIdx);
    setStoryIndex(startSIdx);
    setProgress(0);
    setIsHoldPaused(false);
    setIsReplyFocused(false);
    setAutoplayBlocked(false);
    // Intentionally snapshot only when modal opens or entry user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user.id]);

  // Listen to tab visibility changes for audio/timer hygiene
  useEffect(() => {
    const onVis = () => setIsTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const activeUser = sessionQueue[queueUserIdx] ?? user;
  const activeStories: StoryItem[] = filterActiveStories(
    storiesByUser[activeUser.id] ?? []
  );
  const safeIndex = Math.max(0, Math.min(storyIndex, Math.max(0, activeStories.length - 1)));
  const currentStory = activeStories[safeIndex];

  const stopAllAudio = useCallback(() => {
    const a = musicAudioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
    }
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {}
    }
  }, []);

  // Cleanup audio on close / unmount
  useEffect(() => {
    if (!isOpen) stopAllAudio();
    return () => stopAllAudio();
  }, [isOpen, stopAllAudio]);

  // Handle closing cleanly and persisting mid-way progress (D5)
  const handleViewerClose = useCallback(() => {
    stopAllAudio();
    if (currentStory) {
      const isLastStory = safeIndex >= activeStories.length - 1;
      const finishedAll = isLastStory && progress >= 95;
      if (finishedAll) {
        clearUserStoryProgress(activeUser.id);
      } else {
        saveStoryProgress(
          activeUser.id,
          currentStory.id,
          Math.max(5, Math.min(99, Math.round(progress)))
        );
      }
    }
    onClose();
  }, [
    activeStories.length,
    activeUser.id,
    clearUserStoryProgress,
    currentStory,
    onClose,
    progress,
    safeIndex,
    saveStoryProgress,
    stopAllAudio,
  ]);

  // Mark story seen after 1s visible and unpaused (D2)
  useEffect(() => {
    if (seenTimerRef.current) {
      clearTimeout(seenTimerRef.current);
      seenTimerRef.current = null;
    }
    if (!isOpen || !currentStory || isPaused) return;
    if (storySeenMap[currentStory.id]) return;

    seenTimerRef.current = setTimeout(() => {
      markStorySeen(currentStory.id);
    }, 1000);

    return () => {
      if (seenTimerRef.current) {
        clearTimeout(seenTimerRef.current);
        seenTimerRef.current = null;
      }
    };
  }, [isOpen, currentStory, isPaused, markStorySeen, storySeenMap]);

  const goNext = useCallback(() => {
    if (!currentStory) {
      handleViewerClose();
      return;
    }
    markStorySeen(currentStory.id);
    const seenSnapshot = {
      ...storySeenMap,
      [currentStory.id]: storySeenMap[currentStory.id] ?? new Date().toISOString(),
    };

    if (safeIndex < activeStories.length - 1) {
      setStoryIndex(safeIndex + 1);
      setProgress(0);
      return;
    }

    clearUserStoryProgress(activeUser.id);
    const nextUserIdx = findNextUnseenUserIndex(
      sessionQueue,
      queueUserIdx,
      storiesByUser,
      seenSnapshot
    );
    if (nextUserIdx === -1) {
      stopAllAudio();
      onClose();
      return;
    }

    const nextUser = sessionQueue[nextUserIdx]!;
    const nextStories = filterActiveStories(storiesByUser[nextUser.id] ?? []);
    const nextStart = resolveStartStoryIndex(
      nextStories,
      seenSnapshot,
      storyResumeMap[nextUser.id]
    );
    setQueueUserIdx(nextUserIdx);
    setStoryIndex(nextStart);
    setProgress(0);
  }, [
    activeStories.length,
    activeUser.id,
    clearUserStoryProgress,
    currentStory,
    handleViewerClose,
    markStorySeen,
    onClose,
    queueUserIdx,
    safeIndex,
    sessionQueue,
    stopAllAudio,
    storiesByUser,
    storyResumeMap,
    storySeenMap,
  ]);

  const goPrev = useCallback(() => {
    if (safeIndex > 0) {
      setStoryIndex(safeIndex - 1);
      setProgress(0);
      return;
    }
    if (queueUserIdx > 0) {
      const prevIdx = queueUserIdx - 1;
      const prevUser = sessionQueue[prevIdx]!;
      const prevStories = filterActiveStories(storiesByUser[prevUser.id] ?? []);
      setQueueUserIdx(prevIdx);
      setStoryIndex(Math.max(0, prevStories.length - 1));
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [queueUserIdx, safeIndex, sessionQueue, storiesByUser]);

  // Resolve music track if any (by soundId or fallback title match)
  const musicTrack = currentStory
    ? SEED_AUDIO_TRACKS.find(
        (t) =>
          (currentStory.soundId && t.id === currentStory.soundId) ||
          (currentStory.soundTitle && t.title === currentStory.soundTitle)
      ) ?? null
    : null;

  const hasMusic = Boolean(musicTrack);
  const effectiveMuted = storyMuted || autoplayBlocked;

  // Sync video & music playback + audio mixing (Part C1, C2, C7)
  useEffect(() => {
    if (!isOpen || !currentStory) return;

    const v = videoRef.current;
    if (v) {
      const rawVideoVol = currentStory.videoVolume ?? (hasMusic ? 30 : 100);
      v.muted = effectiveMuted;
      v.volume = effectiveMuted ? 0 : Math.max(0, Math.min(1, rawVideoVol / 100));
      if (isPaused) {
        v.pause();
      } else {
        v.play().catch(() => {
          if (!v.muted) {
            v.muted = true;
            setAutoplayBlocked(true);
            v.play().catch(() => {});
          }
        });
      }
    }

    const a = musicAudioRef.current;
    if (a) {
      if (!musicTrack) {
        a.pause();
        a.removeAttribute('src');
        a.load();
      } else {
        if (a.getAttribute('data-track-id') !== musicTrack.id) {
          a.src = musicTrack.audioUrl;
          a.setAttribute('data-track-id', musicTrack.id);
          a.currentTime = currentStory.soundStartSec ?? 0;
        }
        const rawMusicVol = currentStory.musicVolume ?? 100;
        a.loop = true;
        a.muted = effectiveMuted;
        a.volume = effectiveMuted ? 0 : Math.max(0, Math.min(1, rawMusicVol / 100));
        if (isPaused) {
          a.pause();
        } else {
          a.play().catch(() => {
            setAutoplayBlocked(true);
          });
        }
      }
    }
  }, [
    currentStory,
    effectiveMuted,
    hasMusic,
    isOpen,
    isPaused,
    musicTrack,
  ]);

  // Reset music timestamp and media error cleanly when advancing story
  useEffect(() => {
    setMediaError(false);
    const a = musicAudioRef.current;
    if (!a || !currentStory) return;
    try {
      a.currentTime = currentStory.soundStartSec ?? 0;
    } catch {}
  }, [currentStory?.id]);

  const handleDeleteCurrentStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory || activeUser.id !== currentUser.id || isDeleting) return;
    setIsDeleting(true);
    try {
      const ok = await deleteStory(currentStory.id);
      if (ok) {
        if (activeStories.length <= 1) {
          stopAllAudio();
          onClose();
        } else if (safeIndex >= activeStories.length - 1) {
          setStoryIndex(Math.max(0, activeStories.length - 2));
          setProgress(0);
        } else {
          setProgress(0);
        }
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const durationSec = currentStory ? Math.max(3, Math.min(30, currentStory.durationSec || 5)) : 5;

  // Progress timer
  useEffect(() => {
    if (!isOpen || isPaused || !currentStory) return;
    const stepPct = 100 / (durationSec * 10);
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(100, prev + stepPct));
    }, 100);
    return () => clearInterval(interval);
  }, [isOpen, isPaused, durationSec, currentStory]);

  useEffect(() => {
    if (!isOpen || progress < 100) return;
    goNext();
  }, [isOpen, progress, goNext]);

  const handleToggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextMuted = !storyMuted;
    setStoryMuted(nextMuted);
    setAutoplayBlocked(false);
    const v = videoRef.current;
    const a = musicAudioRef.current;
    if (v) {
      v.muted = nextMuted;
      if (!nextMuted && !isPaused) void v.play().catch(() => {});
    }
    if (a && musicTrack) {
      a.muted = nextMuted;
      if (!nextMuted && !isPaused) void a.play().catch(() => {});
    }
  };

  const handleUnmuteFromPill = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStoryMuted(false);
    setAutoplayBlocked(false);
    const v = videoRef.current;
    const a = musicAudioRef.current;
    if (v) {
      v.muted = false;
      void v.play().catch(() => {});
    }
    if (a && musicTrack) {
      a.muted = false;
      void a.play().catch(() => {});
    }
  };

  // Keyboard shortcuts (D8): Left = next, Right = prev, Space = pause, Escape = close
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
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsHoldPaused((p) => !p);
    }
  };

  const handleNavClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeftSide = x < rect.width / 2;
    if (isLeftSide) {
      goNext();
    } else {
      goPrev();
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || !currentStory) return;
    replyToMoment(activeUser, currentStory.caption, trimmed);
    setQuickReaction('تم إرسال الرد!');
    setReplyText('');
    setIsReplyFocused(false);
    replyInputRef.current?.blur();
    setTimeout(() => setQuickReaction(null), 2000);
  };

  if (!isOpen || !currentStory) return null;

  const renderOverlay = (ov: StoryOverlayItem) => {
    const transform = `translate(-50%, -50%) scale(${ov.scale || 1}) rotate(${ov.rotation || 0}deg)`;
    const style: React.CSSProperties = {
      left: `${ov.xPct}%`,
      top: `${ov.yPct}%`,
      transform,
    };

    if (ov.kind === 'text') {
      return (
        <div
          key={ov.id}
          data-testid="tw-story-overlay-text"
          style={{ ...style, color: ov.colorToken || 'var(--cam-text)' }}
          className={`absolute z-10 max-w-[85%] px-3 py-1.5 rounded-xl bg-[var(--cam-scrim)] backdrop-blur-xs text-lg font-bold leading-snug pointer-events-none select-none ${
            ov.fontClass || ''
          } ${ov.align === 'start' ? 'text-start' : ov.align === 'end' ? 'text-end' : 'text-center'}`}
        >
          {ov.text}
        </div>
      );
    }

    if (ov.kind === 'sticker' && ov.stickerKind === 'heritage' && ov.motifId) {
      return (
        <div
          key={ov.id}
          style={{ ...style, color: ov.colorToken || 'var(--cam-text)' }}
          className="absolute z-10 p-2 rounded-2xl bg-[var(--cam-scrim)] backdrop-blur-xs pointer-events-none select-none"
        >
          <Suspense fallback={null}>
            <LazyHeritageSvg motifId={ov.motifId} className="w-16 h-16" />
          </Suspense>
        </div>
      );
    }

    if (ov.kind === 'sticker' && ov.stickerKind === 'poll') {
      const pollOptions = ov.pollOptions ?? [];
      const pollVotes = currentStory.pollVotes ?? pollOptions.map(() => 0);
      const totalVotes = pollVotes.reduce((sum, count) => sum + (Number(count) || 0), 0);
      const votedIndex = currentStory.userVotedOptionIndex;
      const hasVoted = typeof votedIndex === 'number';

      return (
        <div
          key={ov.id}
          style={style}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-20 w-56 p-3 rounded-2xl bg-[var(--surface)] text-[var(--text)] shadow-xl pointer-events-auto select-none border border-[var(--border)]"
        >
          <p className="text-xs font-bold text-center mb-2">{ov.text || 'تصويت'}</p>
          <div className="flex flex-col gap-1.5">
            {pollOptions.map((opt, idx) => {
              const count = Number(pollVotes[idx] ?? 0);
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isSelected = votedIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void voteStoryPoll(currentStory.id, idx)}
                  className={`relative overflow-hidden px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                      : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--primary-tint)]'
                  }`}
                >
                  <span className="truncate relative z-10">{opt}</span>
                  {hasVoted && (
                    <span className="text-[11px] font-bold relative z-10 shrink-0">{pct}%</span>
                  )}
                </button>
              );
            })}
          </div>
          {hasVoted && (
            <p className="text-[10px] text-[var(--text-muted)] text-center mt-1.5">
              إجمالي الأصوات: {totalVotes}
            </p>
          )}
        </div>
      );
    }

    return (
      <div
        key={ov.id}
        style={style}
        className="absolute z-10 px-3.5 py-2 rounded-2xl bg-[var(--surface)] text-[var(--text)] text-xs font-bold shadow-lg pointer-events-none select-none"
      >
        {ov.text}
      </div>
    );
  };

  const soundChipTitle = musicTrack?.title ?? currentStory.soundTitle;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleViewerClose}
      title={`قصة ${activeUser.displayName}`}
      testId="tw-story-modal"
      onKeyDown={handleKeyDown}
      className="bg-black !p-0"
      overlayClassName="bg-black"
      contentClassName="h-full !max-h-full flex items-center justify-center max-w-md"
    >
      <audio ref={musicAudioRef} data-testid="tw-story-music-audio" preload="auto" />

      <div
        data-testid="tw-story-viewer-box"
        data-paused={isPaused ? 'true' : 'false'}
        data-user-id={activeUser.id}
        data-story-id={currentStory.id}
        data-story-index={safeIndex}
        className="relative w-full max-w-md h-full sm:h-[840px] sm:rounded-3xl overflow-hidden flex flex-col justify-between bg-[var(--cam-bg)]"
        onMouseDown={() => setIsHoldPaused(true)}
        onMouseUp={() => setIsHoldPaused(false)}
        onMouseLeave={() => setIsHoldPaused(false)}
        onTouchStart={() => setIsHoldPaused(true)}
        onTouchEnd={() => setIsHoldPaused(false)}
        onTouchCancel={() => setIsHoldPaused(false)}
      >
        {currentStory.mediaType === 'video' ? (
          <video
            ref={videoRef}
            key={currentStory.id}
            src={currentStory.mediaUrl}
            autoPlay
            loop
            playsInline
            muted={effectiveMuted}
            data-testid="tw-story-media-video"
            className="absolute inset-0 w-full h-full object-contain bg-[var(--cam-bg)]"
          />
        ) : currentStory.mediaType === 'text' ? (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              background:
                currentStory.bgGradient ||
                'linear-gradient(155deg, var(--primary) 0%, var(--cam-surface) 100%)',
            }}
          />
        ) : (
          <div className="absolute inset-0 overflow-hidden bg-[var(--cam-bg)]">
            {currentStory.mediaUrl && !mediaError ? (
              <>
                <img
                  aria-hidden="true"
                  src={currentStory.mediaUrl}
                  alt=""
                  onError={() => setMediaError(true)}
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60 pointer-events-none"
                  draggable={false}
                />
                <img
                  src={currentStory.mediaUrl}
                  alt={currentStory.caption || 'قصة'}
                  data-testid="tw-story-media-image"
                  onError={() => setMediaError(true)}
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/75 p-6 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
                <ImageOff className="w-8 h-8 opacity-75" />
                <span className="text-xs font-semibold">تعذّر تحميل وسائط القصة</span>
              </div>
            )}
          </div>
        )}

        {/* Tap detector overlays for prev/next navigation */}
        <div className="absolute inset-0 z-0" onClick={handleNavClick} />

        {/* Story Stickers & Text Overlays */}
        {currentStory.overlays?.map(renderOverlay)}

        {/* Top Header & Progress Bars */}
        <div className="relative z-10 p-3 pt-4 flex flex-col gap-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Progress Bars (1 segment per story in active user) */}
          <div data-testid="tw-story-progress-bars" className="flex items-center gap-1.5 w-full">
            {activeStories.map((st, i) => (
              <div key={st.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  data-testid={`tw-story-seg-${i}`}
                  style={{
                    width:
                      i < safeIndex ? '100%' : i === safeIndex ? `${progress}%` : '0%',
                  }}
                  className="h-full bg-white transition-all duration-100 ease-linear"
                />
              </div>
            ))}
          </div>

          {/* User Info, Sound Mute Button & Close Button */}
          <div className="flex items-center justify-between text-white mt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar src={activeUser.avatarUrl} name={activeUser.displayName} size={36} />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold drop-shadow-md truncate">
                    {activeUser.displayName}
                  </span>
                  <VerifiedBadge kind={activeUser.verifiedKind} size={13} />
                </div>
                <span data-testid="tw-story-time" className="text-[11px] text-white/80">
                  {formatTimeSafe(currentStory.createdAt, numeralSystem)}
                </span>
              </div>
            </div>

            <div
              className="flex items-center gap-1 shrink-0"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {activeUser.id === currentUser.id && (
                <button
                  type="button"
                  data-testid="tw-story-delete-btn"
                  disabled={isDeleting}
                  onClick={(e) => void handleDeleteCurrentStory(e)}
                  aria-label="حذف القصة"
                  title="حذف القصة"
                  className="w-[44px] h-[44px] rounded-full bg-black/40 text-white hover:text-[var(--danger)] flex items-center justify-center backdrop-blur-md active:scale-95 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                data-testid="tw-story-mute-btn"
                onClick={handleToggleMute}
                aria-label={storyMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                className="w-[44px] h-[44px] rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-md active:scale-95"
              >
                {storyMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                data-testid="tw-story-close-btn"
                onClick={handleViewerClose}
                className="w-[44px] h-[44px] rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-md active:scale-95"
                aria-label="إغلاق القصة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Autoplay fallback pill */}
          {autoplayBlocked && !storyMuted && (
            <button
              type="button"
              data-testid="tw-story-unmute-pill"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={handleUnmuteFromPill}
              className="self-center px-3 py-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold shadow-lg flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>اضغط لتشغيل الصوت</span>
            </button>
          )}
        </div>

        {/* Bottom Caption, Music Chip & Reply Input */}
        <div className="relative z-10 p-3 pb-6 flex flex-col gap-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white">
          {soundChipTitle && (
            <div
              data-testid="tw-story-sound-chip"
              className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--cam-scrim)] backdrop-blur-xs text-[var(--cam-text)] text-xs font-semibold"
            >
              <Music className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>♪ {soundChipTitle}</span>
            </div>
          )}

          {currentStory.caption && (
            <p className="text-sm font-medium drop-shadow-md leading-relaxed">
              {currentStory.caption}
            </p>
          )}

          {quickReaction && (
            <div className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold text-center animate-in fade-in">
              {quickReaction}
            </div>
          )}

          <form
            onSubmit={handleSendReply}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2"
          >
            <input
              ref={replyInputRef}
              type="text"
              data-testid="tw-story-reply-input"
              value={replyText}
              onFocus={() => setIsReplyFocused(true)}
              onBlur={() => setIsReplyFocused(false)}
              onChange={(e) => {
                setReplyText(e.target.value);
                if (!isReplyFocused) setIsReplyFocused(true);
              }}
              placeholder={`أرسل رسالة إلى ${activeUser.displayName.split(' ')[0]}...`}
              className="flex-1 h-11 px-4 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white placeholder:text-white/70 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />

            <button
              type="submit"
              disabled={!replyText.trim()}
              className="w-11 h-11 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40"
              aria-label="إرسال الرد"
            >
              <Send className="w-4 h-4 -scale-x-100" />
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
