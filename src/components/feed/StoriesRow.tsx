import React from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';

export function StoriesRow() {
  const {
    currentUser,
    storiesByUser,
    storyTrayUsers,
    hasUserUnseenStory,
    openCreate,
    openStoryViewer,
  } = useApp();
  const ownStories = storiesByUser[currentUser.id] ?? [];
  const hasOwnStories = ownStories.length > 0;
  const hasOwnUnseen = hasOwnStories && hasUserUnseenStory(currentUser.id);

  return (
    <div
      data-testid="tw-stories-row"
      className="flex items-center gap-3 overflow-x-auto px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)] scrollbar-none select-none"
    >
      {/* 1. Own story item */}
      <div className="relative flex flex-col items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-testid="tw-story-trigger-own"
          onClick={() => (hasOwnStories ? openStoryViewer(currentUser) : openCreate('story'))}
          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform bg-transparent border-0 p-0"
        >
          <Avatar
            src={currentUser.avatarUrl}
            name={currentUser.displayName}
            size={56}
            hasStory={true}
            hasUnseenStory={hasOwnUnseen}
            isOwnStoryEmpty={!hasOwnStories}
          />
          <span className="text-xs font-semibold text-[var(--text)]">قصتك</span>
        </button>

        {hasOwnStories && (
          <button
            type="button"
            data-testid="tw-story-add-more-btn"
            onClick={() => openCreate('story')}
            aria-label="إضافة إلى قصتك"
            className="absolute top-[42px] end-0 w-5 h-5 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] ring-2 ring-[var(--bg)] flex items-center justify-center shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        )}
      </div>

      {/* 2. Followed users ordered: unseen first (newest), then all-seen (newest) */}
      {storyTrayUsers.map((user) => {
        const unseen = hasUserUnseenStory(user.id);
        return (
          <button
            key={user.id}
            type="button"
            data-testid={`tw-story-trigger-${user.id}`}
            data-unseen={unseen ? 'true' : 'false'}
            onClick={() => openStoryViewer(user)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform bg-transparent border-0 p-0"
          >
            <Avatar
              src={user.avatarUrl}
              name={user.displayName}
              size={56}
              hasStory={true}
              hasUnseenStory={unseen}
              isMerchant={user.accountType === 'merchant'}
            />
            <span className="text-xs font-medium text-[var(--text)] max-w-[64px] truncate">
              {user.displayName.split(' ')[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
