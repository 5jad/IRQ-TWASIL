import React from 'react';
import { Bell } from 'lucide-react';
import { Switch } from '../ui/Input';
import type { UserSettings } from '../../types';

interface SettingsNotificationsTabProps {
  notifLikes: boolean;
  setNotifLikes: (v: boolean) => void;
  notifComments: boolean;
  setNotifComments: (v: boolean) => void;
  notifFollows: boolean;
  setNotifFollows: (v: boolean) => void;
  notifDms: boolean;
  setNotifDms: (v: boolean) => void;
  notifOrders: boolean;
  setNotifOrders: (v: boolean) => void;
  quietMode: boolean;
  setQuietMode: (v: boolean) => void;
  applySetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
    localSetter: (v: UserSettings[K]) => void
  ) => void;
}

export function SettingsNotificationsTab({
  notifLikes,
  setNotifLikes,
  notifComments,
  setNotifComments,
  notifFollows,
  setNotifFollows,
  notifDms,
  setNotifDms,
  notifOrders,
  setNotifOrders,
  quietMode,
  setQuietMode,
  applySetting,
}: SettingsNotificationsTabProps) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
      <h3 className="text-sm font-bold text-[var(--text)] border-b border-[var(--border)] pb-2.5 flex items-center gap-2">
        <Bell className="w-4 h-4 text-[var(--primary)]" />
        <span>إعدادات التنبيهات والهدوء</span>
      </h3>

      <div className="flex flex-col divide-y divide-[var(--border)]">
        <Switch
          checked={notifLikes}
          onChange={(v) => applySetting('notifyLikes', v, setNotifLikes)}
          label="الإعجابات والتفاعلات"
          description="تنبيه عند تفاعل الأصدقاء مع منشوراتك."
        />
        <Switch
          checked={notifComments}
          onChange={(v) => applySetting('notifyComments', v, setNotifComments)}
          label="التعليقات والردود"
          description="تنبيه عند التعليق أو الرد على منشوراتك."
        />
        <Switch
          checked={notifFollows}
          onChange={(v) => applySetting('notifyFollows', v, setNotifFollows)}
          label="المتابعون الجدد"
          description="تنبيه عند متابعة حسابك من قبل مستخدم جديد."
        />
        <Switch
          checked={notifDms}
          onChange={(v) => applySetting('notifyMessages', v, setNotifDms)}
          label="الرسائل والمكالمات الخاصة"
          description="تنبيه فوري لرسائل الدردشة ومكالمات الصوت والفيديو."
        />
        <Switch
          checked={notifOrders}
          onChange={(v) => applySetting('notifyOrders', v, setNotifOrders)}
          label="تنبيهات السوق والطلبات"
          description="تنبيهات البائعين والمشترين ومتابعة الطلبات."
        />
        <Switch
          checked={quietMode}
          onChange={(v) => applySetting('quietMode', v, setQuietMode)}
          label="وضع الهدوء (Quiet Mode)"
          description="كتم التنبيهات غير العاجلة مؤقتاً وحفظ التفضيل في حسابك."
        />
      </div>
    </div>
  );
}
