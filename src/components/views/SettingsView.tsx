import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Palette,
  Shield,
  Bell,
  LogOut,
  HelpCircle,
  User,
  Lock,
  CheckCircle,
  Store,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { validateClientHandle } from '../../lib/apiHelpers';
import { ImageCropModal } from '../modals/ImageCropModal';
import { SettingsAccountTab } from '../settings/SettingsAccountTab';
import { SettingsSecurityTab } from '../settings/SettingsSecurityTab';
import { SettingsPrivacyTab } from '../settings/SettingsPrivacyTab';
import { SettingsAppearanceTab } from '../settings/SettingsAppearanceTab';
import { SettingsNotificationsTab } from '../settings/SettingsNotificationsTab';
import { SettingsMerchantTab } from '../settings/SettingsMerchantTab';
import { SettingsSupportTab } from '../settings/SettingsSupportTab';
import type { UserSettings } from '../../types';

const VALID_TABS = [
  'account',
  'security',
  'privacy',
  'appearance',
  'notifications',
  'merchant',
  'support',
] as const;

type SettingsTab = (typeof VALID_TABS)[number];

const SETTINGS_NAV: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'account', label: 'الحساب والمعلومات', icon: User },
  { id: 'security', label: 'الأمان والجلسات (2FA)', icon: Shield },
  { id: 'privacy', label: 'الخصوصية والحظر', icon: Lock },
  { id: 'appearance', label: 'المظهر والسمات', icon: Palette },
  { id: 'notifications', label: 'الإشعارات والأصوات', icon: Bell },
  { id: 'merchant', label: 'التوثيق والمتجر', icon: Store },
  { id: 'support', label: 'الدعم والأمان القانوني', icon: HelpCircle },
];

export function SettingsView() {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    handedness,
    setHandedness,
    fontScale,
    setFontScale,
    numeralSystem,
    setNumeralSystem,
    reduceMotion,
    setReduceMotion,
    dataSaver,
    setDataSaver,
    currentUser,
    updateCurrentUser,
    updateUserSettings,
    refreshBootstrap,
    logout,
    setCurrentRoute,
    serverOnline,
    isAuthenticated,
    requireAuthForWrite,
    showAppToast,
  } = useApp();

  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const activeTab: SettingsTab =
    tab && (VALID_TABS as readonly string[]).includes(tab) ? (tab as SettingsTab) : 'account';

  const setActiveTab = (newTab: SettingsTab) => {
    navigate(`/settings/${newTab}`);
  };

  // Account editing form state synced to currentUser
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio);
  const [province, setProvince] = useState(currentUser.province || 'بغداد');
  const [accountType, setAccountType] = useState(currentUser.accountType);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    setDisplayName(currentUser.displayName);
    setUsername(currentUser.username);
    setBio(currentUser.bio);
    setProvince(currentUser.province || 'بغداد');
    setAccountType(currentUser.accountType);
  }, [
    currentUser.id,
    currentUser.displayName,
    currentUser.username,
    currentUser.bio,
    currentUser.province,
    currentUser.accountType,
  ]);

  const persisted = currentUser.settings;

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(persisted?.twoFactorEnabled ?? false);
  const [onlineStatusVisibility, setOnlineStatusVisibility] = useState<boolean>(
    persisted?.onlineStatusVisibility ?? true
  );
  const [dmPermission, setDmPermission] = useState<'everyone' | 'followers' | 'nobody'>(
    persisted?.dmPermission ?? 'everyone'
  );
  const [commentPermission, setCommentPermission] = useState<'everyone' | 'followers' | 'nobody'>(
    persisted?.commentPermission ?? 'everyone'
  );
  const [readReceipts, setReadReceipts] = useState<boolean>(persisted?.readReceipts ?? true);
  const [quietMode, setQuietMode] = useState<boolean>(persisted?.quietMode ?? false);
  const [sensitiveContentFilter, setSensitiveContentFilter] = useState<boolean>(
    persisted?.sensitiveContentFilter ?? true
  );

  const [notifLikes, setNotifLikes] = useState(persisted?.notifyLikes ?? true);
  const [notifComments, setNotifComments] = useState(persisted?.notifyComments ?? true);
  const [notifFollows, setNotifFollows] = useState(persisted?.notifyFollows ?? true);
  const [notifDms, setNotifDms] = useState(persisted?.notifyMessages ?? true);
  const [notifOrders, setNotifOrders] = useState(persisted?.notifyOrders ?? true);

  useEffect(() => {
    const s = currentUser.settings;
    if (!s) return;
    setTwoFactorEnabled(s.twoFactorEnabled);
    setOnlineStatusVisibility(s.onlineStatusVisibility);
    setDmPermission(s.dmPermission);
    setCommentPermission(s.commentPermission);
    setReadReceipts(s.readReceipts);
    setQuietMode(s.quietMode);
    setSensitiveContentFilter(s.sensitiveContentFilter);
    setNotifLikes(s.notifyLikes);
    setNotifComments(s.notifyComments);
    setNotifFollows(s.notifyFollows);
    setNotifDms(s.notifyMessages);
    setNotifOrders(s.notifyOrders);
  }, [currentUser.settings]);

  const applySetting = useCallback(
    <K extends keyof UserSettings>(
      key: K,
      value: UserSettings[K],
      localSetter: (v: UserSettings[K]) => void
    ) => {
      if (serverOnline && !requireAuthForWrite()) return;
      localSetter(value);
      void updateUserSettings({ [key]: value });
    },
    [requireAuthForWrite, serverOnline, updateUserSettings]
  );

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError('');
    if (serverOnline && !requireAuthForWrite()) return;

    const handleCheck = validateClientHandle(username);
    if (!handleCheck.ok) {
      setAccountError(handleCheck.message ?? 'اسم المستخدم غير صالح');
      return;
    }

    setIsSavingAccount(true);
    try {
      const ok = await updateCurrentUser({
        displayName: displayName.trim(),
        username: handleCheck.handle,
        bio: bio.trim(),
        province,
        accountType,
      });
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (serverOnline && !requireAuthForWrite()) return;
    setPendingAvatarFile(file);
  };

  const handleConfirmAvatarCrop = async (croppedFile: File) => {
    setIsUploadingAvatar(true);
    try {
      const ok = await updateCurrentUser({}, { avatarFile: croppedFile });
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
      setPendingAvatarFile(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div
      data-testid="tw-settings-view"
      className="w-full max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12"
    >
      {/* User Badge Summary */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={currentUser.avatarUrl}
            name={currentUser.displayName}
            size={48}
            isVerified={currentUser.isVerified}
            verifiedKind={currentUser.verifiedKind}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-[var(--text)]">{currentUser.displayName}</span>
              <VerifiedBadge kind={currentUser.verifiedKind} size={15} />
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              <span dir="ltr" className="inline-block font-mono">
                @{currentUser.username}
              </span>{' '}
              · {currentUser.province}
            </span>
            {currentUser.email && (
              <span className="text-[11px] text-[var(--text-muted)] self-start font-mono" dir="ltr">
                {currentUser.email}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCurrentRoute('profile')} className="h-9 px-3 text-xs">
            عرض الملف
          </Button>
          {serverOnline && !isAuthenticated ? (
            <Button variant="primary" onClick={() => setCurrentRoute('auth')} className="h-9 px-3 text-xs">
              تسجيل الدخول
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => void logout()}
              className="h-9 px-3 text-xs text-rose-500 hover:bg-rose-500/10 gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Navigation Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto select-none bg-[var(--surface)] p-1.5 rounded-2xl border border-[var(--border)] scrollbar-none">
        {SETTINGS_NAV.map((nav) => {
          const Icon = nav.icon;
          const isActive = activeTab === nav.id;
          return (
            <button
              key={nav.id}
              type="button"
              onClick={() => setActiveTab(nav.id)}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all ${
                isActive
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{nav.label}</span>
            </button>
          );
        })}
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>تم حفظ التعديلات بنجاح وتحديث بيانات ملفك الشخصي!</span>
        </div>
      )}

      {activeTab === 'account' && (
        <SettingsAccountTab
          currentUser={currentUser}
          isAuthenticated={isAuthenticated}
          displayName={displayName}
          setDisplayName={setDisplayName}
          username={username}
          setUsername={setUsername}
          bio={bio}
          setBio={setBio}
          province={province}
          setProvince={setProvince}
          accountType={accountType}
          setAccountType={setAccountType}
          accountError={accountError}
          isSavingAccount={isSavingAccount}
          isUploadingAvatar={isUploadingAvatar}
          onAvatarChange={handleAvatarChange}
          onSaveAccount={handleSaveAccount}
        />
      )}

      {activeTab === 'security' && (
        <SettingsSecurityTab
          currentUser={currentUser}
          serverOnline={serverOnline}
          isAuthenticated={isAuthenticated}
          twoFactorEnabled={twoFactorEnabled}
          setTwoFactorEnabled={setTwoFactorEnabled}
          applySetting={applySetting}
          requireAuthForWrite={requireAuthForWrite}
          refreshBootstrap={refreshBootstrap}
          logout={logout}
          setCurrentRoute={setCurrentRoute}
          showAppToast={showAppToast}
        />
      )}

      {activeTab === 'privacy' && (
        <SettingsPrivacyTab
          sensitiveContentFilter={sensitiveContentFilter}
          setSensitiveContentFilter={setSensitiveContentFilter}
          onlineStatusVisibility={onlineStatusVisibility}
          setOnlineStatusVisibility={setOnlineStatusVisibility}
          readReceipts={readReceipts}
          setReadReceipts={setReadReceipts}
          dmPermission={dmPermission}
          setDmPermission={setDmPermission}
          commentPermission={commentPermission}
          setCommentPermission={setCommentPermission}
          applySetting={applySetting}
        />
      )}

      {activeTab === 'appearance' && (
        <SettingsAppearanceTab
          theme={theme}
          setTheme={setTheme}
          accent={accent}
          setAccent={setAccent}
          handedness={handedness}
          setHandedness={setHandedness}
          fontScale={fontScale}
          setFontScale={setFontScale}
          numeralSystem={numeralSystem}
          setNumeralSystem={setNumeralSystem}
          reduceMotion={reduceMotion}
          setReduceMotion={setReduceMotion}
          dataSaver={dataSaver}
          setDataSaver={setDataSaver}
        />
      )}

      {activeTab === 'notifications' && (
        <SettingsNotificationsTab
          notifLikes={notifLikes}
          setNotifLikes={setNotifLikes}
          notifComments={notifComments}
          setNotifComments={setNotifComments}
          notifFollows={notifFollows}
          setNotifFollows={setNotifFollows}
          notifDms={notifDms}
          setNotifDms={setNotifDms}
          notifOrders={notifOrders}
          setNotifOrders={setNotifOrders}
          quietMode={quietMode}
          setQuietMode={setQuietMode}
          applySetting={applySetting}
        />
      )}

      {activeTab === 'merchant' && <SettingsMerchantTab currentUser={currentUser} />}

      {activeTab === 'support' && <SettingsSupportTab />}

      <ImageCropModal
        isOpen={Boolean(pendingAvatarFile)}
        file={pendingAvatarFile}
        shape="circle"
        aspectRatio={1}
        outputWidth={1024}
        outputHeight={1024}
        title="تحديد قص الصورة الشخصية"
        onCancel={() => setPendingAvatarFile(null)}
        onConfirm={handleConfirmAvatarCrop}
      />
    </div>
  );
}
