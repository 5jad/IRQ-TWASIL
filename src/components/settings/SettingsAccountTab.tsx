import React from 'react';
import { User, Camera, Save } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import type { User as UserType } from '../../types';

const IRAQI_PROVINCES = [
  'بغداد',
  'البصرة',
  'أربيل',
  'النجف الأشرف',
  'نينوى',
  'كربلاء المقدسة',
  'السليمانية',
  'كركوك',
  'بابل',
  'ذي قار',
  'الأنبار',
  'ديالى',
  'ميسان',
  'واسط',
  'المثنى',
  'القادسية',
  'صلاح الدين',
  'دهوك',
];

interface SettingsAccountTabProps {
  currentUser: UserType;
  isAuthenticated: boolean;
  displayName: string;
  setDisplayName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  province: string;
  setProvince: (v: string) => void;
  accountType: UserType['accountType'];
  setAccountType: (v: UserType['accountType']) => void;
  accountError: string;
  isSavingAccount: boolean;
  isUploadingAvatar: boolean;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveAccount: (e: React.FormEvent) => void;
}

export function SettingsAccountTab({
  currentUser,
  isAuthenticated,
  displayName,
  setDisplayName,
  username,
  setUsername,
  bio,
  setBio,
  province,
  setProvince,
  accountType,
  setAccountType,
  accountError,
  isSavingAccount,
  isUploadingAvatar,
  onAvatarChange,
  onSaveAccount,
}: SettingsAccountTabProps) {
  return (
    <form onSubmit={onSaveAccount} className="flex flex-col gap-4">
      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
        <h2 className="text-sm font-bold text-[var(--text)] border-b border-[var(--border)] pb-2.5 flex items-center gap-2">
          <User className="w-4 h-4 text-[var(--primary)]" />
          <span>المعلومات الشخصية الأساسية</span>
        </h2>

        {/* Avatar Upload Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={48} />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--text)]">الصورة الشخصية</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                PNG أو JPG أو WebP أو GIF (متحرك) بحد أقصى 5 MB
              </span>
            </div>
          </div>
          <label className="h-9 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs font-bold text-[var(--text)] flex items-center gap-1.5 cursor-pointer hover:border-[var(--primary)]">
            <Camera className="w-4 h-4 text-[var(--primary)]" />
            <span>{isUploadingAvatar ? 'جاري الرفع...' : 'تغيير الصورة'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              onChange={onAvatarChange}
              disabled={isUploadingAvatar}
              data-testid="tw-settings-avatar-input"
              aria-label="اختيار الصورة الشخصية"
              className="sr-only"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--text)]">الاسم المعروض</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--text)]">اسم المستخدم الرمزي (@username)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="ltr"
              className="w-full h-10 px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs font-mono text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
              required
            />
            <span className="text-[11px] text-[var(--text-muted)]">
              يمكن تغيير المعرّف مرة كل ١٤ يوماً فقط.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[var(--text)]">النبذة التعريفية</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)] leading-relaxed focus:border-[var(--primary)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--text)]">المحافظة</label>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)]"
            >
              {IRAQI_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--text)]">رقم الهاتف الموثق</label>
            <div className="relative">
              <input
                type="text"
                value={
                  currentUser.maskedPhone ??
                  currentUser.phoneMasked ??
                  (isAuthenticated ? 'غير مرتبط بعد' : 'حساب زائر')
                }
                readOnly
                dir="ltr"
                className="w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-muted)]"
              />
              {isAuthenticated && (currentUser.maskedPhone || currentUser.phoneMasked) && (
                <span className="absolute end-2 top-2 px-1.5 py-0.5 rounded bg-[var(--success-tint)] text-[var(--success)] text-[11px] font-bold">
                  OTP
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--text)]">نوع الحساب</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as UserType['accountType'])}
              className="w-full h-10 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)]"
            >
              <option value="personal">حساب شخصي</option>
              <option value="creator">صانع محتوى عراقي</option>
              <option value="merchant">متجر عراقي موثق</option>
            </select>
          </div>
        </div>

        {accountError && (
          <div className="p-2.5 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-semibold">
            {accountError}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button type="submit" variant="primary" isLoading={isSavingAccount} className="h-10 px-5 text-xs gap-1.5">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
