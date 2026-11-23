import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Switch, SegmentedControl } from '../ui/Input';
import type { UserSettings } from '../../types';

interface SettingsPrivacyTabProps {
  sensitiveContentFilter: boolean;
  setSensitiveContentFilter: (v: boolean) => void;
  onlineStatusVisibility: boolean;
  setOnlineStatusVisibility: (v: boolean) => void;
  readReceipts: boolean;
  setReadReceipts: (v: boolean) => void;
  dmPermission: 'everyone' | 'followers' | 'nobody';
  setDmPermission: (v: 'everyone' | 'followers' | 'nobody') => void;
  commentPermission: 'everyone' | 'followers' | 'nobody';
  setCommentPermission: (v: 'everyone' | 'followers' | 'nobody') => void;
  applySetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
    localSetter: (v: UserSettings[K]) => void
  ) => void;
}

export function SettingsPrivacyTab({
  sensitiveContentFilter,
  setSensitiveContentFilter,
  onlineStatusVisibility,
  setOnlineStatusVisibility,
  readReceipts,
  setReadReceipts,
  dmPermission,
  setDmPermission,
  commentPermission,
  setCommentPermission,
  applySetting,
}: SettingsPrivacyTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Sensitive Content Filter */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-amber-500/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[var(--text)]">تصفية المحتوى الحساس والوقائي</span>
            <span className="text-xs text-[var(--text-muted)]">
              إخفاء المنشورات الحساسة تلقائياً وحماية المحادثات وفق إعدادات الخصوصية المحفوظة.
            </span>
          </div>
        </div>
        <Switch
          checked={sensitiveContentFilter}
          onChange={(v) => applySetting('sensitiveContentFilter', v, setSensitiveContentFilter)}
        />
      </div>

      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
        <h3 className="text-sm font-bold text-[var(--text)] border-b border-[var(--border)] pb-2">
          من يشاهد نشاطك ويتواصل معك
        </h3>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[var(--text)] block">ظهور حالة الاتصال (متصل الآن)</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                إظهار أو إخفاء حالة اتصالك الحالية في المحادثات الخاصة.
              </span>
            </div>
            <Switch
              checked={onlineStatusVisibility}
              onChange={(v) => applySetting('onlineStatusVisibility', v, setOnlineStatusVisibility)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[var(--border)]">
            <div>
              <span className="text-xs font-bold text-[var(--text)] block">إيصالات القراءة</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                السماح للطرف الآخر بمعرفة قراءة رسائله في المحادثات الخاصة.
              </span>
            </div>
            <Switch
              checked={readReceipts}
              onChange={(v) => applySetting('readReceipts', v, setReadReceipts)}
            />
          </div>

          <div className="flex flex-col gap-1.5 pt-2.5 border-t border-[var(--border)]">
            <span className="text-xs font-bold text-[var(--text)]">من يستطيع مراسلتي في الخاص</span>
            <SegmentedControl<'everyone' | 'followers' | 'nobody'>
              options={[
                { value: 'everyone', label: 'الجميع' },
                { value: 'followers', label: 'المتابعون فقط' },
                { value: 'nobody', label: 'لا أحد' },
              ]}
              value={dmPermission}
              onChange={(v) => applySetting('dmPermission', v, setDmPermission)}
            />
          </div>

          <div className="flex flex-col gap-1.5 pt-2.5 border-t border-[var(--border)]">
            <span className="text-xs font-bold text-[var(--text)]">من يستطيع التعليق على منشوراتي</span>
            <SegmentedControl<'everyone' | 'followers' | 'nobody'>
              options={[
                { value: 'everyone', label: 'الجميع' },
                { value: 'followers', label: 'المتابعون فقط' },
                { value: 'nobody', label: 'لا أحد' },
              ]}
              value={commentPermission}
              onChange={(v) => applySetting('commentPermission', v, setCommentPermission)}
            />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-2">
        <h3 className="text-sm font-bold text-[var(--text)] border-b border-[var(--border)] pb-2">
          إدارة الحظر والحسابات المقيدة
        </h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          يمكنك حظر أو إزالة أي حساب أو بوت مباشرة من صفحة ملفه الشخصي أو من شريط المحادثة. الحسابات المحظورة لا يمكنها مراسلتك أو عرض منشوراتك.
        </p>
      </div>
    </div>
  );
}
