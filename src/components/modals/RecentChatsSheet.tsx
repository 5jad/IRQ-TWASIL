import React from 'react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { X, MessageSquarePlus } from 'lucide-react';
import { Modal } from '../ui/Modal';

export function RecentChatsSheet() {
  const {
    isRecentChatsOpen,
    setIsRecentChatsOpen,
    conversations,
    setCurrentRoute,
    setActiveConversationId,
  } = useApp();

  return (
    <Modal
      isOpen={isRecentChatsOpen}
      onClose={() => setIsRecentChatsOpen(false)}
      title="المحادثات الأخيرة"
      testId="tw-recent-chats-sheet"
      className="items-end p-0"
      contentClassName="max-w-md"
    >
      <div className="w-full bg-[var(--surface)] rounded-t-3xl border-t border-[var(--border)] p-4 flex flex-col gap-3 max-h-[80vh] shadow-2xl">
        {/* Grab Handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="text-base font-bold text-[var(--text)]">
            المحادثات الأخيرة
          </h2>
          <button
            type="button"
            onClick={() => setIsRecentChatsOpen(false)}
            className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of recent chats */}
        <div className="flex flex-col divide-y divide-[var(--border)] overflow-y-auto">
          {conversations.slice(0, 6).map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => {
                setActiveConversationId(conv.id);
                setCurrentRoute('messages');
                setIsRecentChatsOpen(false);
              }}
              className="w-full text-start py-2.5 px-2 flex items-center justify-between rounded-xl hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar src={conv.avatarUrl} name={conv.title} size={44} isOnline={conv.isOnline} />
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-[var(--text)] truncate">
                    {conv.title}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] truncate">
                    {conv.lastMessage}
                  </span>
                </div>
              </div>

              {conv.unreadCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
              )}
            </button>
          ))}
        </div>

        {/* New chat shortcut */}
        <button
          type="button"
          onClick={() => {
            setCurrentRoute('messages');
            setIsRecentChatsOpen(false);
          }}
          className="w-full h-11 rounded-xl bg-[var(--surface-2)] text-[var(--primary-text)] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[var(--primary-tint)] transition-colors mt-2"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>فتح كل المحادثات</span>
        </button>
      </div>
    </Modal>
  );
}
