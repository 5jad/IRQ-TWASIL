import React from 'react';
import { ChatConversation, type User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Pin, VolumeX, CheckCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNumber, formatTimeSafe } from '../../lib/formatters';
import { resolveConversationPeer } from '../../lib/remediation';

export function ChatRow({
  conversation,
  onClick,
  isActive = false,
}: {
  conversation: ChatConversation;
  onClick: () => void;
  isActive?: boolean;
}) {
  const { numeralSystem, users, currentUser } = useApp();
  const isOwnMessage = conversation.lastMessage.startsWith('أنت:');
  const memberIds = conversation.memberIds ?? (conversation.peerId ? [currentUser.id, conversation.peerId] : []);
  const members = memberIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));
  const peer = resolveConversationPeer({
    viewerId: currentUser.id,
    isGroup: Boolean(conversation.isGroup),
    memberUsers: members,
    storedTitle: conversation.title,
    storedAvatarUrl: conversation.avatarUrl ?? '',
    storedIsOnline: Boolean(conversation.isOnline),
  });

  return (
    <button
      type="button"
      data-testid={`tw-chat-row-${conversation.id}`}
      onClick={onClick}
      className={`w-full text-start h-[72px] px-4 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors border-b border-[var(--border)] ${
        isActive
          ? 'bg-[var(--primary-tint)]'
          : conversation.unreadCount > 0
          ? 'bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)]'
          : 'hover:bg-[var(--surface-2)]'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Avatar
          src={peer.avatarUrl}
          name={peer.title}
          size={50}
          isOnline={peer.isOnline}
        />

        <div className="flex flex-col truncate">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-[var(--text)] truncate">
              {peer.title}
            </span>
            {conversation.isMuted && (
              <VolumeX className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            )}
          </div>

          <div className="flex items-center gap-1 text-sm text-[var(--text-muted)] truncate">
            {isOwnMessage && (
              <CheckCheck className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
            )}
            <span className="truncate">{conversation.lastMessage}</span>
          </div>

          {conversation.orderNumber && (
            <span className="mt-0.5 inline-block text-[11px] font-bold text-[var(--accent-text)] bg-[var(--accent-tint)] px-1.5 py-0.5 rounded-md w-fit">
              طلب #{conversation.orderNumber} — قيد التجهيز
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-1">
          {conversation.isPinned && (
            <Pin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {formatTimeSafe(conversation.lastMessageTime, numeralSystem)}
          </span>
        </div>

        {conversation.unreadCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-[11px] font-bold flex items-center justify-center">
            {conversation.unreadCount > 99
              ? `${formatNumber(99, numeralSystem)}+`
              : formatNumber(conversation.unreadCount, numeralSystem)}
          </span>
        )}
      </div>
    </button>
  );
}
