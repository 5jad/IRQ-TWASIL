import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Hash,
  Volume2,
  Mic,
  MicOff,
  Radio,
  MessageSquare,
  Plus,
  Send,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { SmartImage } from '../ui/SmartImage';
import { formatNumber, formatTimeSafe } from '../../lib/formatters';

export function CommunitiesView() {
  const {
    currentUser,
    communities,
    setIsCreateCommunityOpen,
    joinCommunity,
    leaveCommunity,
    sendCommunityMessage,
    communityMessagesById,
    numeralSystem,
    requireAuthForWrite,
    serverOnline,
    showAppToast,
  } = useApp();

  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<'general' | 'announcements' | 'voice'>('general');
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [voiceStreamActive, setVoiceStreamActive] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [togglingMembership, setTogglingMembership] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);

  const activeComm = useMemo(
    () => communities.find((c) => c.id === selectedCommunity) ?? communities[0],
    [communities, selectedCommunity]
  );

  const stopMicStream = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setVoiceStreamActive(false);
    setIsMicMuted(true);
  };

  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeChannel !== 'voice') {
      stopMicStream();
    }
  }, [activeChannel, activeComm?.id]);

  const channelMessages = useMemo(() => {
    if (!activeComm || activeChannel === 'voice') return [];
    const list = communityMessagesById[activeComm.id] ?? [];
    return list.filter((m) => m.channel === activeChannel);
  }, [activeComm, activeChannel, communityMessagesById]);

  const handleToggleMembership = async () => {
    if (!activeComm) return;
    if (serverOnline && !requireAuthForWrite()) return;
    setTogglingMembership(true);
    try {
      if (activeComm.isJoined) {
        await leaveCommunity(activeComm.id);
      } else {
        await joinCommunity(activeComm.id);
      }
    } finally {
      setTogglingMembership(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComm || activeChannel === 'voice') return;
    if (serverOnline && !requireAuthForWrite()) return;
    const text = messageInput.trim();
    if (!text) return;
    setSendingMsg(true);
    try {
      const ok = await sendCommunityMessage(activeComm.id, activeChannel, text);
      if (ok) {
        setMessageInput('');
      }
    } finally {
      setSendingMsg(false);
    }
  };

  const handleToggleMic = async () => {
    if (!isMicMuted) {
      stopMicStream();
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showAppToast('المتصفح الحالي لا يدعم الوصول للميكروفون', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setVoiceStreamActive(true);
      setIsMicMuted(false);
    } catch {
      showAppToast('تعذر تفعيل الميكروفون. تحقق من أذونات المتصفح.', 'error');
      setIsMicMuted(true);
      setVoiceStreamActive(false);
    }
  };

  return (
    <div
      className="w-full max-w-5xl mx-auto px-4 py-4 flex flex-col gap-5 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12"
      data-testid="tw-communities-view"
    >
      {/* Communities Header & Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto select-none py-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setIsCreateCommunityOpen(true)}
          className="p-2.5 px-3.5 rounded-2xl border border-dashed border-[var(--primary)] bg-[var(--primary-tint)]/40 hover:bg-[var(--primary-tint)] text-[var(--primary)] flex items-center gap-2 shrink-0 font-bold text-xs transition-colors"
          title="إنشاء مجتمع جديد"
        >
          <Plus className="w-4 h-4" />
          <span>مجتمع جديد</span>
        </button>

        {communities.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCommunity(c.id)}
            className={`p-2.5 px-3.5 rounded-2xl border flex items-center gap-2.5 shrink-0 transition-all ${
              activeComm?.id === c.id
                ? 'border-[var(--primary)] bg-[var(--primary-tint)] font-bold shadow-xs'
                : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <SmartImage src={c.icon} alt={c.name} containerClassName="w-7 h-7 rounded-lg shrink-0" />
            <div className="flex flex-col text-start">
              <span className="text-xs text-[var(--text)] truncate max-w-[160px]">{c.name}</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {formatNumber(c.membersCount, numeralSystem)} عضو
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Community Detail Card */}
      {!activeComm ? (
        <div className="p-10 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center justify-center text-center gap-3">
          <Users className="w-8 h-8 text-[var(--primary)]" />
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-[var(--text)]">لا توجد مجتمعات حالياً</h2>
            <p className="text-xs text-[var(--text-muted)]">يمكنك إنشاء مجتمعك الأول ودعوة الأعضاء إليه.</p>
          </div>
          <Button variant="primary-sm" onClick={() => setIsCreateCommunityOpen(true)}>
            إنشاء مجتمع جديد
          </Button>
        </div>
      ) : (
        <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <SmartImage
                src={activeComm.icon}
                alt={activeComm.name}
                containerClassName="w-14 h-14 rounded-2xl shadow-xs shrink-0"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-[var(--text)]">{activeComm.name}</h2>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)] text-[11px] font-semibold">
                    {activeComm.province}
                  </span>
                  {activeComm.category && (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--primary-tint)] text-[var(--primary)] text-[11px] font-semibold">
                      {activeComm.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{activeComm.description}</p>
              </div>
            </div>

            <Button
              type="button"
              variant={activeComm.isJoined ? 'outline' : 'primary-sm'}
              isLoading={togglingMembership}
              onClick={() => void handleToggleMembership()}
              className="w-fit gap-1.5"
            >
              {activeComm.isJoined ? (
                <>
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>مغادرة المجتمع</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>انضم للمجتمع</span>
                </>
              )}
            </Button>
          </div>

          {/* Channel Navigation Tabs */}
          <div className="flex items-center gap-2 select-none border-b border-[var(--border)] pb-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveChannel('general')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
                activeChannel === 'general'
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <Hash className="w-4 h-4" />
              <span>قناة النقاش العام</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel('announcements')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
                activeChannel === 'announcements'
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>الإعلانات الرسمية</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel('voice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
                activeChannel === 'voice'
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>الغرفة الصوتية</span>
            </button>
          </div>

          {/* Channel Body */}
          {activeChannel === 'voice' ? (
            <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      voiceStreamActive ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-muted)]'
                    }`}
                  />
                  <span className="text-xs font-bold text-[var(--text)]">
                    {voiceStreamActive
                      ? 'الميكروفون مفعّل في الغرفة الصوتية'
                      : 'الغرفة الصوتية — الميكروفون مكتوم'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleMic()}
                  className={`p-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                    isMicMuted
                      ? 'bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)]'
                      : 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMicMuted ? 'تفعيل الميكروفون' : 'كتم الميكروفون'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className={`p-3 rounded-2xl bg-[var(--surface)] border flex flex-col items-center gap-2 ${
                    !isMicMuted && voiceStreamActive
                      ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <div className="relative">
                    <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={48} />
                    {!isMicMuted && voiceStreamActive && (
                      <span className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-[var(--primary)] ring-2 ring-[var(--surface)] flex items-center justify-center">
                        <Volume2 className="w-2.5 h-2.5 text-[var(--primary-fg)]" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[var(--text)] text-center truncate w-full">
                    {currentUser.displayName} (أنت)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {channelMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[160px] text-center gap-1 text-[var(--text-muted)]">
                  <MessageSquare className="w-6 h-6 text-[var(--primary)]/60 mb-1" />
                  <span className="text-xs font-bold text-[var(--text)]">
                    لا توجد رسائل في هذه القناة بعد
                  </span>
                  <span className="text-[11px]">اكتب أول رسالة لبدء النقاش مع أعضاء المجتمع.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto p-2 rounded-2xl bg-[var(--surface-2)]">
                  {channelMessages.map((msg) => {
                    const senderName =
                      msg.sender?.displayName ??
                      (msg.senderId === currentUser.id ? currentUser.displayName : 'عضو المجتمع');
                    const senderAvatar =
                      msg.sender?.avatarUrl ??
                      (msg.senderId === currentUser.id ? currentUser.avatarUrl : '');
                    return (
                      <div
                        key={msg.id}
                        className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-start gap-2.5"
                      >
                        <Avatar src={senderAvatar} name={senderName} size={34} />
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[var(--text)] truncate">
                              {senderName}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                              {formatTimeSafe(msg.createdAt, numeralSystem)}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    activeComm.isJoined
                      ? `اكتب في ${activeChannel === 'general' ? 'النقاش العام' : 'الإعلانات'}...`
                      : 'انضم للمجتمع أولاً للمشاركة في القناة...'
                  }
                  disabled={!activeComm.isJoined && serverOnline}
                  className="flex-1 h-10 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] disabled:opacity-60"
                />
                <Button
                  type="submit"
                  variant="primary-sm"
                  isLoading={sendingMsg}
                  disabled={!messageInput.trim() || (!activeComm.isJoined && serverOnline)}
                  className="gap-1.5 h-10 px-4"
                >
                  <Send className="w-3.5 h-3.5 -scale-x-100" />
                  <span>إرسال</span>
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
