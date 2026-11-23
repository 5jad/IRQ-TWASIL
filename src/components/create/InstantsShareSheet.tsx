import React, { useState } from 'react';
import { Users, Star, Plus, ChevronDown, ChevronLeft, Check } from 'lucide-react';
import type { StoryAudience, User } from '../../types';
import { formatNumber } from '../../lib/formatters';

export interface InstantsShareSheetProps {
  isOpen: boolean;
  users: User[];
  currentUserId?: string;
  numeralSystem: 'arabic-indic' | 'western';
  audience: StoryAudience;
  onSelectAudience: (audience: StoryAudience) => void;
  onCancel: () => void;
  onSend: (audience: StoryAudience, customListName?: string) => void;
}

export function InstantsShareSheet({
  isOpen,
  users,
  currentUserId,
  numeralSystem,
  audience,
  onSelectAudience,
  onCancel,
  onSend,
}: InstantsShareSheetProps) {
  const [closeFriendsOpen, setCloseFriendsOpen] = useState(false);
  const [customLists, setCustomLists] = useState<string[]>(['قائمة المقربين']);
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [chosenCustomName, setChosenCustomName] = useState<string | undefined>(undefined);

  if (!isOpen) return null;

  const friendUsers = users.filter(
    (u) => u.id !== currentUserId && u.kind !== 'bot' && Boolean(u.isCloseFriend)
  );

  return (
    <div
      data-testid="tw-instants-share-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="مشاركة مع"
      className="fixed inset-x-0 bottom-0 top-[min(582px,calc(100%-277px))] z-40 flex justify-center"
    >
      <div className="w-full max-w-[430px] h-full rounded-t-[24px] bg-[var(--cam-surface)] text-[var(--cam-text)] border-t border-white/10 shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,12px)]">
        {/* Handle 36x3 centered 8px from top */}
        <div className="pt-[8px] flex justify-center shrink-0">
          <div className="w-[36px] h-[3px] rounded-full bg-[var(--cam-muted)]/45" />
        </div>

        {/* Header Row: Start "إلغاء" (17/500), Center "مشاركة مع" (20/700) */}
        <div className="relative h-[44px] px-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            data-testid="tw-instants-share-cancel"
            onClick={onCancel}
            className="text-[17px] font-medium text-[var(--cam-text)] min-h-[44px] flex items-center"
          >
            إلغاء
          </button>

          <h2 className="absolute left-1/2 -translate-x-1/2 text-[20px] font-bold text-[var(--cam-text)]">
            مشاركة مع
          </h2>

          <button
            type="button"
            data-testid="tw-instants-share-send"
            onClick={() => onSend(audience, chosenCustomName)}
            className="px-3.5 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-sm font-bold"
          >
            إرسال
          </button>
        </div>

        {/* 1px Divider */}
        <div className="h-px bg-white/10 w-full shrink-0" />

        {/* Rows Container */}
        <div className="flex-1 overflow-y-auto px-4 divide-y divide-white/5">
          {/* Row 1: الأصدقاء (--lapis) */}
          <button
            type="button"
            data-testid="tw-instants-row-friends"
            onClick={() => {
              setChosenCustomName(undefined);
              onSelectAudience('everyone');
            }}
            className="w-full h-[62px] flex items-center justify-between gap-3 text-start"
          >
            <span className="flex items-center gap-3">
              <span className="w-[40px] h-[40px] rounded-full bg-[var(--lapis)] text-[var(--lapis-fg)] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </span>
              <span className="text-[15px] font-bold text-[var(--cam-text)]">الأصدقاء</span>
            </span>

            <span
              className={`w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center ${
                audience === 'everyone'
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-fg)]'
                  : 'border-[var(--cam-muted)]'
              }`}
            >
              {audience === 'everyone' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </span>
          </button>

          {/* Row 2: الأصدقاء المقرّبون (--success) */}
          <div className="flex flex-col">
            <div className="h-[62px] flex items-center justify-between gap-2">
              <div className="flex-1 h-full flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  data-testid="tw-instants-row-close-friends"
                  onClick={() => {
                    setChosenCustomName(undefined);
                    onSelectAudience('close-friends');
                  }}
                  className="flex items-center gap-3 text-start min-w-0"
                >
                  <span className="w-[40px] h-[40px] rounded-full bg-[var(--success)] text-[var(--primary-fg)] flex items-center justify-center shrink-0">
                    <Star className="w-5 h-5 fill-current" />
                  </span>
                  <span className="text-[15px] font-bold text-[var(--cam-text)] truncate">
                    الأصدقاء المقرّبون
                  </span>
                </button>

                <button
                  type="button"
                  aria-expanded={closeFriendsOpen}
                  aria-label="عرض قائمة الأصدقاء المقرّبين"
                  onClick={() => setCloseFriendsOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--cam-muted)] hover:text-[var(--cam-text)] px-1.5 py-1 rounded-lg shrink-0"
                >
                  <span>{formatNumber(friendUsers.length, numeralSystem)} شخصاً</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      closeFriendsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                aria-label="تحديد الأصدقاء المقرّبين"
                onClick={() => {
                  setChosenCustomName(undefined);
                  onSelectAudience('close-friends');
                }}
                className={`w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                  audience === 'close-friends'
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-fg)]'
                    : 'border-[var(--cam-muted)]'
                }`}
              >
                {audience === 'close-friends' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
            </div>

            {closeFriendsOpen && (
              <div className="pb-2 ps-[52px] flex flex-wrap gap-1.5">
                {friendUsers.length === 0 ? (
                  <span className="text-[11px] text-[var(--cam-muted)]">
                    لم تضف أصدقاء مقرّبين بعد
                  </span>
                ) : (
                  friendUsers.map((u) => (
                    <span
                      key={u.id}
                      className="px-2.5 py-1 rounded-full bg-[var(--cam-surface-2)] text-[11px] font-semibold text-[var(--cam-text)]"
                    >
                      {u.displayName}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Row 3: إنشاء قائمة جديدة (--cam-surface-2) */}
          <div className="flex flex-col">
            <button
              type="button"
              data-testid="tw-instants-row-custom"
              onClick={() => setCreatingList((v) => !v)}
              className="w-full h-[62px] flex items-center justify-between gap-3 text-start"
            >
              <span className="flex items-center gap-3">
                <span className="w-[40px] h-[40px] rounded-full bg-[var(--cam-surface-2)] text-[var(--cam-text)] flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold text-[var(--cam-text)]">
                    إنشاء قائمة جديدة
                  </span>
                  <span className="text-xs text-[var(--cam-muted)]">
                    {chosenCustomName ? `قائمة: ${chosenCustomName}` : 'قوائم مخصّصة'}
                  </span>
                </div>
              </span>

              <ChevronLeft className="w-5 h-5 text-[var(--cam-muted)]" />
            </button>

            {creatingList && (
              <div className="pb-2 ps-[52px] flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="اسم القائمة الجديدة..."
                    className="flex-1 h-9 px-3 rounded-xl bg-[var(--cam-surface-2)] text-xs text-[var(--cam-text)] placeholder:text-[var(--cam-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newListName.trim();
                      if (!trimmed) return;
                      setCustomLists((prev) => [...prev, trimmed]);
                      setChosenCustomName(trimmed);
                      onSelectAudience('custom');
                      setNewListName('');
                      setCreatingList(false);
                    }}
                    className="h-9 px-3 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
                  >
                    حفظ
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {customLists.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setChosenCustomName(name);
                        onSelectAudience('custom');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        audience === 'custom' && chosenCustomName === name
                          ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                          : 'bg-[var(--cam-surface-2)] text-[var(--cam-text)]'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
