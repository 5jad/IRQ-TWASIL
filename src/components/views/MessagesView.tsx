import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ChatRow } from '../chat/ChatRow';
import { ChatBubble, DateChip } from '../chat/ChatBubble';
import { SearchField } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Send, Mic, Square, Paperclip, Smile, Plus, Sparkles, Music, Bot, Ban, X, ArrowRight, MoreVertical, User as UserIcon } from 'lucide-react';
import type { SocialMoment, StoryItem, User } from '../../types';
import { SEED_AUDIO_TRACKS } from '../../lib/createUtils';
import { filterActiveMoments } from '../../lib/storyUtils';
import { resolveConversationPeer } from '../../lib/remediation';
import { formatDuration } from '../../lib/formatters';
import { apiFetch, ApiClientError, type PublicBotDto } from '../../lib/api';

const InstantsViewerModal = lazy(() =>
  import('../modals/InstantsViewerModal').then((m) => ({ default: m.InstantsViewerModal }))
);
const MomentChooserSheet = lazy(() =>
  import('../modals/NotesModals').then((m) => ({ default: m.MomentChooserSheet }))
);
const NoteComposerSheet = lazy(() =>
  import('../modals/NotesModals').then((m) => ({ default: m.NoteComposerSheet }))
);
const NoteViewerSheet = lazy(() =>
  import('../modals/NotesModals').then((m) => ({ default: m.NoteViewerSheet }))
);

interface InstantGroup {
  user: User;
  items: StoryItem[];
}

function momentToStoryItem(m: SocialMoment): StoryItem {
  return {
    id: m.id,
    authorId: m.authorId,
    kind: 'instant',
    mediaUrl: m.mediaUrl || '',
    mediaType: m.mediaType === 'video' ? 'video' : 'image',
    caption: m.text,
    durationSec: 5,
    audience: m.audience,
    mode: 'instants',
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    expiresHint: 'تنتهي بعد ٢٤ ساعة',
  };
}

export function MessagesView() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    activeMessages,
    sendChatMessage,
    sendBotCallbackQuery,
    startBotChat,
    blockBot,
    currentUser,
    users,
    socialMoments,
    publishNote,
    deleteOwnNote,
    replyToMoment,
    seenInstantIds,
    markInstantSeen,
    numeralSystem,
    openCreate,
    isAuthenticated,
    serverOnline,
    setCurrentRoute,
    setViewingUser,
    blockUser,
    showAppToast,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<'الكل' | 'شخصية' | 'مجموعات' | 'قنوات' | 'تجار' | 'غير مقروء'>('الكل');
  const [botsModalOpen, setBotsModalOpen] = useState(false);
  const [botsList, setBotsList] = useState<PublicBotDto[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsError, setBotsError] = useState('');
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [viewingNoteTarget, setViewingNoteTarget] = useState<{
    note: SocialMoment;
    author: User;
  } | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSoftKeyboardOpen, setIsSoftKeyboardOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const peekDragXRef = useRef<number | null>(null);
  const peekSwipeHandledRef = useRef(false);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeMoments = filterActiveMoments(socialMoments);
  const getNoteForUser = (uid: string) =>
    activeMoments.find((m) => m.kind === 'note' && m.authorId === uid) ?? null;
  const getInstantsForUser = (uid: string) =>
    activeMoments
      .filter((m) => m.kind === 'instant' && m.authorId === uid)
      .map(momentToStoryItem);

  const ownNote = getNoteForUser(currentUser.id);
  const ownInstants = getInstantsForUser(currentUser.id);
  const otherHumanUsers = users.filter(
    (u) => u.id !== currentUser.id && u.id !== 'guest' && u.kind !== 'bot'
  );

  // Build Instants entries (own instants + friends' instants)
  const friendInstantGroups: InstantGroup[] = otherHumanUsers
    .map((u) => ({
      user: u,
      items: getInstantsForUser(u.id),
    }))
    .filter((g) => g.items.length > 0);

  const allInstantEntries: InstantGroup[] = [
    ...(ownInstants.length > 0 ? [{ user: currentUser, items: ownInstants }] : []),
    ...friendInstantGroups,
  ];

  // Friends shown in the top Notes + Instants strip (anyone with a note or an instant)
  const stripFriends = otherHumanUsers.filter((u) => {
    return Boolean(getNoteForUser(u.id)) || getInstantsForUser(u.id).length > 0;
  });

  // Auto-open viewer when returning from /create?mode=instants with ?openInstant=<userId>
  useEffect(() => {
    const targetId = searchParams.get('openInstant');
    if (targetId && allInstantEntries.some((e) => e.user.id === targetId)) {
      setViewerUserId(targetId);
      const next = new URLSearchParams(searchParams);
      next.delete('openInstant');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, allInstantEntries]);

  // Hide edge peek tab when mobile virtual keyboard shrinks viewport
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      setIsSoftKeyboardOpen(vv.height < window.innerHeight * 0.78);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const stopVoiceRecording = (shouldSend: boolean) => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      if (!shouldSend) {
        recorder.onstop = null;
      }
      recorder.stop();
    } else if (!shouldSend) {
      voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
    }
    setIsRecordingVoice(false);
  };

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationId, activeMessages.length]);

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showAppToast('تسجيل الصوت غير مدعوم في هذا المتصفح', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const startedAt = Date.now();
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const chunks = voiceChunksRef.current;
        stream.getTracks().forEach((t) => t.stop());
        voiceStreamRef.current = null;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          void sendChatMessage('', {
            mediaFile: blob,
            kind: 'voice',
            voiceDuration: formatDuration(elapsedSec),
          });
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingSec(0);
      setIsRecordingVoice(true);
      voiceTimerRef.current = setInterval(() => {
        setRecordingSec((s) => s + 1);
      }, 1000);
    } catch {
      showAppToast('يرجى السماح بالوصول إلى الميكروفون لتسجيل رسالة صوتية', 'error');
    }
  };

  const openBotsDirectory = async () => {
    setBotsModalOpen(true);
    if (!serverOnline) return;
    setBotsLoading(true);
    setBotsError('');
    try {
      const res = await apiFetch<{ bots: PublicBotDto[] }>('/api/bots');
      setBotsList(res.bots);
    } catch (err) {
      setBotsError(err instanceof ApiClientError ? err.message : 'تعذر تحميل قائمة البوتات');
    } finally {
      setBotsLoading(false);
    }
  };

  const handleSend = () => {
    if (isRecordingVoice) {
      stopVoiceRecording(true);
      return;
    }
    if (!messageInput.trim()) {
      void startVoiceRecording();
      return;
    }
    void sendChatMessage(messageInput);
    setMessageInput('');
    setEmojiPickerOpen(false);
  };

  const handleChatFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void sendChatMessage(messageInput, { mediaFile: file });
    setMessageInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const resolveConvMetadata = (conv: typeof conversations[number]) => {
    const memberIds = conv.memberIds ?? (conv.peerId ? [currentUser.id, conv.peerId] : []);
    const members = memberIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => Boolean(u));
    return resolveConversationPeer({
      viewerId: currentUser.id,
      isGroup: Boolean(conv.isGroup),
      memberUsers: members,
      storedTitle: conv.title,
      storedAvatarUrl: conv.avatarUrl ?? '',
      storedIsOnline: Boolean(conv.isOnline),
    });
  };

  // Active conversation thread
  if (activeConversationId && activeConv) {
    const peerInfo = resolveConvMetadata(activeConv);
    const peerUser = peerInfo.peerId ? users.find((u) => u.id === peerInfo.peerId) : undefined;
    const isBotThread = Boolean(activeConv.isBot || activeConv.botId || peerInfo.isBot);
    const resolvedBotId = activeConv.botId || peerInfo.botId;
    const latestReplyKeyboard = [...activeMessages]
      .reverse()
      .find((m) => m.replyMarkup?.keyboard && m.replyMarkup.keyboard.length > 0)?.replyMarkup?.keyboard;

    return (
      <div className="flex flex-col h-[calc(100dvh-var(--header-h))] max-w-3xl mx-auto bg-[var(--surface)] border-x border-[var(--border)] pb-[calc(var(--bar-h)+24px+env(safe-area-inset-bottom,0px))] md:pb-0">
        {/* Desktop Thread Header (hidden on mobile where TopBar already renders chat header) */}
        <div className="hidden md:flex px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveConversationId(null)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              aria-label="العودة للمحادثات"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <Avatar
              src={peerInfo.avatarUrl}
              name={peerInfo.title}
              size={36}
              isOnline={peerInfo.isOnline}
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[var(--text)] truncate">{peerInfo.title}</span>
                {isBotThread && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] text-[10px] font-bold">
                    بوت
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                {isBotThread ? 'بوت تفاعلي' : peerInfo.isOnline ? 'متصل الآن' : 'محادثة خاصة'}
              </span>
            </div>
          </div>

          <div className="relative flex items-center gap-1.5">
            {isBotThread && resolvedBotId && (
              <button
                type="button"
                onClick={() => void blockBot(resolvedBotId)}
                className="h-8 px-2.5 rounded-xl border border-[var(--border)] text-[11px] font-bold text-[var(--danger)] hover:bg-[var(--danger-tint)] flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>حظر البوت</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setThreadMenuOpen((v) => !v)}
              aria-label="خيارات المحادثة"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {threadMenuOpen && (
              <div className="absolute end-0 top-10 w-44 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl py-1.5 z-30">
                {peerUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setThreadMenuOpen(false);
                      setViewingUser(peerUser);
                      setCurrentRoute('profile');
                    }}
                    className="w-full px-3.5 py-2 text-start text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>عرض الملف الشخصي</span>
                  </button>
                )}
                {peerUser && !isBotThread && (
                  <button
                    type="button"
                    onClick={() => {
                      setThreadMenuOpen(false);
                      void blockUser(peerUser.id);
                    }}
                    className="w-full px-3.5 py-2 text-start text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-tint)] flex items-center gap-2"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>حظر المستخدم</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
          <DateChip label="اليوم" />

          {activeMessages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onCallbackQuery={(messageId, data) => void sendBotCallbackQuery(activeConv.id, messageId, data)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Persistent Reply Keyboard if bot supplied one */}
        {latestReplyKeyboard && latestReplyKeyboard.length > 0 && (
          <div className="px-3 py-2 bg-[var(--surface-2)] border-t border-[var(--border)] flex flex-col gap-1.5 shrink-0">
            {latestReplyKeyboard.map((row, rIdx) => (
              <div key={rIdx} className="flex flex-wrap gap-1.5">
                {row.map((cell, cIdx) => {
                  const label = typeof cell === 'string' ? cell : cell.text;
                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => void sendChatMessage(label)}
                      className="flex-1 min-w-[90px] h-9 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--primary)]"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="relative sticky bottom-0 bg-[var(--bg)] border-t border-[var(--border)] p-2.5 flex items-center gap-2 select-none">
          {emojiPickerOpen && (
            <div className="absolute bottom-16 start-3 z-30 p-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl flex flex-wrap gap-1.5 max-w-[260px]">
              {['😀', '❤️', '🔥', '😂', '👍', '🇮🇶', '✨', '🌹', '🎉', '🙏', '👏', '🥳'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setMessageInput((prev) => `${prev}${em}`);
                    setEmojiPickerOpen(false);
                  }}
                  className="w-9 h-9 rounded-xl hover:bg-[var(--surface-2)] text-lg flex items-center justify-center"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          <input
            ref={chatFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.zip"
            className="hidden"
            onChange={handleChatFilePick}
          />

          <button
            type="button"
            onClick={() => setEmojiPickerOpen((v) => !v)}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              emojiPickerOpen ? 'text-[var(--primary)] bg-[var(--primary-tint)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
            aria-label="رموز تعبيرية"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => chatFileInputRef.current?.click()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="إرفاق ملف"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {isRecordingVoice ? (
            <div className="flex-1 h-11 px-4 rounded-full bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--danger)] animate-pulse" />
                <span>جارٍ تسجيل رسالة صوتية · {formatDuration(recordingSec)}</span>
              </span>
              <button
                type="button"
                onClick={() => stopVoiceRecording(false)}
                className="text-[11px] underline"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك هنا..."
              className="flex-1 h-11 px-4 rounded-full bg-[var(--surface-2)] text-[var(--text)] text-sm border-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:text-[var(--text-muted)]"
            />
          )}

          <button
            type="button"
            onClick={handleSend}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xs active:scale-95 transition-transform shrink-0 ${
              isRecordingVoice
                ? 'bg-[var(--danger)] text-white'
                : 'bg-[var(--primary)] text-[var(--primary-fg)]'
            }`}
            aria-label={
              isRecordingVoice
                ? 'إيقاف وإرسال التسجيل الصوتي'
                : messageInput.trim()
                ? 'إرسال الرسالة'
                : 'تسجيل رسالة صوتية'
            }
          >
            {isRecordingVoice ? (
              <Square className="w-4 h-4 fill-current" />
            ) : messageInput.trim() ? (
              <Send className="w-5 h-5 -scale-x-100" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // Latest unseen friend moment of either kind (note OR instant) for Edge Peek tab
  const friendMoments = activeMoments.filter((m) => m.authorId !== currentUser.id);
  const peekMoment =
    friendMoments.find((m) => !seenInstantIds.includes(m.id)) ?? friendMoments[0] ?? null;
  const peekAuthor = peekMoment
    ? users.find((u) => u.id === peekMoment.authorId) ?? null
    : null;

  const openPeekMoment = () => {
    if (!peekMoment || !peekAuthor) return;
    if (peekMoment.kind === 'note') {
      markInstantSeen(peekMoment.id);
      setViewingNoteTarget({ note: peekMoment, author: peekAuthor });
    } else {
      setViewerUserId(peekAuthor.id);
    }
  };

  const showEdgePeek =
    !isSearchFocused &&
    !isSoftKeyboardOpen &&
    Boolean(peekMoment && peekAuthor) &&
    !viewerUserId &&
    !viewingNoteTarget &&
    !chooserOpen &&
    !noteComposerOpen;

  const openNoteViewer = (note: SocialMoment, author: User) => {
    markInstantSeen(note.id);
    setViewingNoteTarget({ note, author });
  };

  // Conversation List View
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12 bg-[var(--surface)] min-h-[calc(100dvh-var(--header-h))] border-x border-[var(--border)]">
      {/* Search Bar & Folders */}
      <div
        className="p-3 border-b border-[var(--border)] flex flex-col gap-2.5"
        onFocusCapture={() => setIsSearchFocused(true)}
        onBlurCapture={() => setIsSearchFocused(false)}
      >
        <div className="flex items-center gap-2">
          <SearchField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في المحادثات والأشخاص..."
            className="flex-1"
          />
          <button
            type="button"
            data-testid="tw-bots-directory-btn"
            onClick={() => void openBotsDirectory()}
            className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] flex items-center gap-1.5 shrink-0"
          >
            <Bot className="w-4 h-4 text-[var(--primary)]" />
            <span>البوتات</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none">
          {(['الكل', 'شخصية', 'مجموعات', 'قنوات', 'تجار', 'غير مقروء'] as const).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveFolder(chip)}
              className={`h-7 px-3 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                activeFolder === chip
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {serverOnline && !isAuthenticated && (
          <div className="p-2.5 rounded-xl bg-[var(--primary-tint)] border border-[var(--primary)]/30 flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--text)] font-semibold">سجّل دخولك لبدء المحادثات وإرسال الرسائل.</span>
            <Button type="button" onClick={() => setCurrentRoute('auth')} className="h-8 px-3 text-xs">
              تسجيل الدخول
            </Button>
          </div>
        )}
      </div>

      {/* Unified Notes + Instants Strip above inbox list */}
      <div
        data-testid="tw-instants-strip"
        className="min-h-[108px] pt-3 pb-1.5 px-3 flex items-end gap-3.5 overflow-x-auto overflow-y-hidden border-b border-[var(--border)] bg-[var(--surface)] scrollbar-none select-none shrink-0"
      >
        {/* Own "أنت" Tile with Note Bubble + Plus Chooser */}
        <div
          data-testid="tw-strip-own"
          className="relative flex flex-col items-center shrink-0 min-w-[66px]"
        >
          <button
            type="button"
            data-testid="tw-own-note-bubble"
            onClick={() =>
              ownNote ? openNoteViewer(ownNote, currentUser) : setNoteComposerOpen(true)
            }
            className="relative z-10 -mb-2 max-w-[96px] px-2 py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs text-[10.5px] leading-[1.15] text-center cursor-pointer"
          >
            {ownNote ? (
              <span className="flex flex-col items-center">
                <span className="line-clamp-2 text-[var(--text)] font-medium">{ownNote.text}</span>
                {ownNote.soundId && (
                  <span className="inline-flex items-center gap-0.5 text-[9.5px] text-[var(--primary)] font-bold max-w-[84px] truncate">
                    <Music className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {SEED_AUDIO_TRACKS.find((t) => t.id === ownNote.soundId)?.title}
                    </span>
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[var(--text-muted)] font-medium whitespace-nowrap">
                أضف ملاحظة
              </span>
            )}
            <span
              aria-hidden="true"
              className="absolute -bottom-1 start-1/2 translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--surface)] border-e border-b border-[var(--border)]"
            />
          </button>

          <button
            type="button"
            data-testid="tw-instants-own-tile"
            onClick={() =>
              ownInstants.length > 0 ? setViewerUserId(currentUser.id) : setChooserOpen(true)
            }
            className="flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 cursor-pointer active:scale-95 transition-transform"
          >
            <span
              className={`w-[38px] h-[38px] overflow-hidden bg-[var(--surface-2)] flex items-center justify-center ${
                ownInstants.length > 0
                  ? 'rounded-[13px] ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--surface)]'
                  : 'rounded-full border border-[var(--border)]'
              }`}
            >
              {ownInstants[0]?.mediaUrl || currentUser.avatarUrl ? (
                <img
                  src={ownInstants[0]?.mediaUrl || currentUser.avatarUrl}
                  alt="أنت"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-[var(--text)]">
                  {currentUser.displayName.charAt(0)}
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold text-[var(--text)] leading-tight">أنت</span>
          </button>

          <button
            type="button"
            data-testid="tw-own-plus-btn"
            onClick={() => setChooserOpen(true)}
            aria-label="إضافة ملاحظة أو لحظة"
            className="absolute bottom-[13px] end-1.5 z-20 w-[18px] h-[18px] rounded-full bg-[var(--primary)] text-[var(--primary-fg)] ring-2 ring-[var(--surface)] flex items-center justify-center shadow-xs"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
          </button>
        </div>

        {/* Friends' Notes & Instants */}
        {stripFriends.map((user) => {
          const note = getNoteForUser(user.id);
          const instants = getInstantsForUser(user.id);
          const latestInstant = instants[0];
          const isInstantUnseen = latestInstant ? !seenInstantIds.includes(latestInstant.id) : false;
          const noteTrack = note?.soundId
            ? SEED_AUDIO_TRACKS.find((t) => t.id === note.soundId)
            : null;

          return (
            <div
              key={user.id}
              data-testid={`tw-strip-friend-${user.id}`}
              className="relative flex flex-col items-center shrink-0 min-w-[66px]"
            >
              {note && (
                <button
                  type="button"
                  data-testid={`tw-note-bubble-${user.id}`}
                  onClick={() => openNoteViewer(note, user)}
                  className="relative z-10 -mb-2 max-w-[100px] px-2 py-0.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs text-[10.5px] leading-[1.15] text-center cursor-pointer"
                >
                  <span className="line-clamp-2 text-[var(--text)] font-medium">{note.text}</span>
                  {noteTrack && (
                    <span className="flex items-center justify-center gap-0.5 text-[9.5px] text-[var(--primary)] font-bold max-w-[88px] overflow-hidden">
                      <Music className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{noteTrack.title}</span>
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 start-1/2 translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--surface)] border-e border-b border-[var(--border)]"
                  />
                </button>
              )}

              <button
                type="button"
                data-testid={`tw-instants-friend-${user.id}`}
                onClick={() => {
                  if (latestInstant) {
                    setViewerUserId(user.id);
                  } else if (note) {
                    openNoteViewer(note, user);
                  }
                }}
                className="flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 cursor-pointer active:scale-95 transition-transform"
              >
                <span
                  className={`w-[38px] h-[38px] overflow-hidden bg-[var(--surface-2)] flex items-center justify-center ${
                    latestInstant
                      ? `rounded-[13px] ${
                          isInstantUnseen
                            ? 'ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--surface)]'
                            : 'ring-1 ring-[var(--border)]'
                        }`
                      : 'rounded-full ring-1 ring-[var(--border)]'
                  }`}
                >
                  {latestInstant?.mediaUrl || user.avatarUrl ? (
                    <img
                      src={latestInstant?.mediaUrl || user.avatarUrl}
                      alt={user.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-[var(--text)]">
                      {user.displayName.charAt(0)}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium text-[var(--text)] max-w-[68px] truncate leading-tight">
                  {user.displayName.split(' ')[0]}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Conversations List */}
      <div className="flex flex-col">
        {conversations
          .filter((conv) => {
            const peerInfo = resolveConvMetadata(conv);
            const peerUser = peerInfo.peerId
              ? users.find((u) => u.id === peerInfo.peerId)
              : undefined;
            const q = searchQuery.trim().toLowerCase();
            if (
              q &&
              !peerInfo.title.toLowerCase().includes(q) &&
              !conv.lastMessage.toLowerCase().includes(q)
            ) {
              return false;
            }
            if (activeFolder === 'غير مقروء') return conv.unreadCount > 0;
            if (activeFolder === 'مجموعات') return Boolean(conv.isGroup);
            if (activeFolder === 'قنوات') return Boolean(conv.isGroup || peerInfo.isBot);
            if (activeFolder === 'تجار') {
              return Boolean(conv.orderNumber || peerUser?.accountType === 'merchant');
            }
            if (activeFolder === 'شخصية') return !conv.isGroup && !peerInfo.isBot;
            return true;
          })
          .map((conv) => (
            <ChatRow
              key={conv.id}
              conversation={conv}
              onClick={() => setActiveConversationId(conv.id)}
            />
          ))}
      </div>

      {/* Bots Directory Modal */}
      {botsModalOpen && (
        <Modal
          isOpen={botsModalOpen}
          onClose={() => setBotsModalOpen(false)}
          title="دليل البوتات التفاعلية"
          testId="tw-bots-directory-modal"
          contentClassName="max-w-lg"
        >
          <div className="w-full bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-5 shadow-2xl flex flex-col gap-4 max-h-[82vh]">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--primary)]">
                <Bot className="w-5 h-5" />
                <h2 className="text-base font-bold text-[var(--text)]">دليل البوتات التفاعلية</h2>
              </div>
              <button
                type="button"
                onClick={() => setBotsModalOpen(false)}
                className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {botsError && (
              <div className="p-3 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-semibold">
                {botsError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
              {botsLoading ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">جاري تحميل البوتات...</div>
              ) : botsList.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                  لا توجد بوتات متاحة حالياً.
                </div>
              ) : (
                botsList.map((bot) => (
                  <div
                    key={bot.id}
                    className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={bot.avatarUrl} name={bot.displayName} size={42} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-[var(--text)] truncate">{bot.displayName}</span>
                          <VerifiedBadge kind={bot.isVerified ? 'official' : 'none'} size={14} />
                        </div>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]" dir="ltr">
                          @{bot.handle}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                          {bot.description}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        setBotsModalOpen(false);
                        void startBotChat({
                          id: bot.id,
                          displayName: bot.displayName,
                          avatarUrl: bot.avatarUrl,
                          handle: bot.handle,
                        });
                      }}
                      className="h-8 px-3 text-xs shrink-0"
                    >
                      بدء المحادثة
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* End-edge Peek Tab (56x64, physical left in RTL, surfaces latest unseen note or instant) */}
      {showEdgePeek && peekMoment && peekAuthor && (
        <button
          type="button"
          data-testid="tw-instants-edge-peek"
          data-peek-kind={peekMoment.kind}
          aria-label={peekMoment.kind === 'note' ? 'ملاحظات الأصدقاء' : 'لحظات الأصدقاء'}
          onPointerDown={(e) => {
            peekSwipeHandledRef.current = false;
            peekDragXRef.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (peekDragXRef.current !== null) {
              const dx = e.clientX - peekDragXRef.current;
              peekDragXRef.current = null;
              if (dx > 14) {
                peekSwipeHandledRef.current = true;
                openPeekMoment();
              }
            }
          }}
          onClick={() => {
            if (peekSwipeHandledRef.current) {
              peekSwipeHandledRef.current = false;
              return;
            }
            openPeekMoment();
          }}
          className="tw-edge-peek-idle fixed end-0 top-[36%] z-30 w-[56px] h-[64px] rounded-s-2xl bg-[var(--surface)] border border-[var(--border)] shadow-lg flex items-center justify-end pe-1.5 cursor-pointer"
        >
          <span className="w-9 h-11 rounded-xl overflow-hidden border border-[var(--primary)] bg-[var(--primary-tint)] flex items-center justify-center relative">
            {peekMoment.mediaUrl || peekAuthor.avatarUrl ? (
              <img
                src={peekMoment.mediaUrl || peekAuthor.avatarUrl}
                alt=""
                className="w-full h-full object-cover opacity-85"
              />
            ) : (
              <span className="text-xs font-bold text-[var(--primary-text)]">
                {peekAuthor.displayName.charAt(0)}
              </span>
            )}
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary-fg)] absolute drop-shadow" />
          </span>
        </button>
      )}

      {/* Lazy-loaded Modals: Chooser, Note Composer, Note Viewer, Instants Viewer */}
      {chooserOpen && (
        <Suspense fallback={null}>
          <MomentChooserSheet
            isOpen={chooserOpen}
            onClose={() => setChooserOpen(false)}
            onPickNote={() => setNoteComposerOpen(true)}
            onPickInstant={() => openCreate('instants')}
          />
        </Suspense>
      )}

      {noteComposerOpen && (
        <Suspense fallback={null}>
          <NoteComposerSheet
            isOpen={noteComposerOpen}
            onClose={() => setNoteComposerOpen(false)}
            currentUser={currentUser}
            existingNote={ownNote}
            numeralSystem={numeralSystem}
            onPublish={publishNote}
            onDelete={deleteOwnNote}
          />
        </Suspense>
      )}

      {viewingNoteTarget && (
        <Suspense fallback={null}>
          <NoteViewerSheet
            isOpen={Boolean(viewingNoteTarget)}
            onClose={() => setViewingNoteTarget(null)}
            note={viewingNoteTarget.note}
            author={viewingNoteTarget.author}
            isOwn={viewingNoteTarget.author.id === currentUser.id}
            numeralSystem={numeralSystem}
            onEditOwn={() => setNoteComposerOpen(true)}
            onDeleteOwn={deleteOwnNote}
            onReply={replyToMoment}
          />
        </Suspense>
      )}

      {viewerUserId && (
        <Suspense fallback={null}>
          <InstantsViewerModal
            isOpen={Boolean(viewerUserId)}
            onClose={() => setViewerUserId(null)}
            entries={allInstantEntries}
            initialUserId={viewerUserId}
          />
        </Suspense>
      )}
    </div>
  );
}
