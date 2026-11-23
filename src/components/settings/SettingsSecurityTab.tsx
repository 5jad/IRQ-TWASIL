import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Mail,
  KeyRound,
  PhoneCall,
  RefreshCw,
  Smartphone,
  Laptop,
  Trash2,
} from 'lucide-react';
import { Switch, SegmentedControl } from '../ui/Input';
import { Button } from '../ui/Button';
import { apiFetch, ApiClientError, type AuthDeviceDto } from '../../lib/api';
import { isValidIraqiPhoneInput, normalizeDigits, normalizeOtpDigits } from '../../lib/apiHelpers';
import type { AppRoute, User, UserSettings } from '../../types';

interface SettingsSecurityTabProps {
  currentUser: User;
  serverOnline: boolean;
  isAuthenticated: boolean;
  twoFactorEnabled: boolean;
  setTwoFactorEnabled: (v: boolean) => void;
  applySetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
    localSetter: (v: UserSettings[K]) => void
  ) => void;
  requireAuthForWrite: () => boolean;
  refreshBootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  setCurrentRoute: (route: AppRoute) => void;
  showAppToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
}

export function SettingsSecurityTab({
  currentUser,
  serverOnline,
  isAuthenticated,
  twoFactorEnabled,
  setTwoFactorEnabled,
  applySetting,
  requireAuthForWrite,
  refreshBootstrap,
  logout,
  setCurrentRoute,
  showAppToast,
}: SettingsSecurityTabProps) {
  const [devices, setDevices] = useState<AuthDeviceDto[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  // Email & Password state
  const [emailInput, setEmailInput] = useState(currentUser.email ?? '');
  const [emailCurPassword, setEmailCurPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  const [curPasswordInput, setCurPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Phone link OTP state
  const [linkPhoneInput, setLinkPhoneInput] = useState('');
  const [linkChallengeId, setLinkChallengeId] = useState('');
  const [linkCodeInput, setLinkCodeInput] = useState('');
  const [linkStep, setLinkStep] = useState<'idle' | 'otp'>('idle');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Delete account state
  const [deleteMode, setDeleteMode] = useState<'password' | 'otp'>(
    currentUser.hasPassword ? 'password' : 'otp'
  );
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhone, setDeletePhone] = useState('');
  const [deleteChallengeId, setDeleteChallengeId] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteStep, setDeleteStep] = useState<'idle' | 'otp'>('idle');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setEmailInput(currentUser.email ?? '');
    setDeleteMode(currentUser.hasPassword ? 'password' : 'otp');
  }, [currentUser.id, currentUser.email, currentUser.hasPassword]);

  const loadDevices = useCallback(async () => {
    if (!serverOnline || !isAuthenticated) {
      setDevices([]);
      return;
    }
    setDevicesLoading(true);
    setDevicesError('');
    try {
      const res = await apiFetch<{ devices: AuthDeviceDto[] }>('/api/auth/devices');
      setDevices(res.devices);
    } catch (err) {
      setDevicesError(err instanceof ApiClientError ? err.message : 'تعذر تحميل الأجهزة المسجلة');
    } finally {
      setDevicesLoading(false);
    }
  }, [serverOnline, isAuthenticated]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const revokeDevice = async (sessionId: string) => {
    try {
      await apiFetch(`/api/auth/devices/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      setDevices((prev) => prev.filter((d) => d.id !== sessionId));
      showAppToast('تم إنهاء جلسة الجهاز', 'success');
    } catch (err) {
      showAppToast(err instanceof ApiClientError ? err.message : 'تعذر إنهاء الجلسة', 'error');
    }
  };

  const terminateOtherSessions = async () => {
    const others = devices.filter((d) => !d.isCurrent);
    if (others.length === 0) return;
    try {
      await Promise.all(
        others.map((d) => apiFetch(`/api/auth/devices/${encodeURIComponent(d.id)}`, { method: 'DELETE' }))
      );
      setDevices((prev) => prev.filter((d) => d.isCurrent));
      showAppToast('تم إنهاء كافة الجلسات الأخرى', 'success');
    } catch (err) {
      showAppToast(err instanceof ApiClientError ? err.message : 'تعذر إنهاء الجلسات الأخرى', 'error');
    }
  };

  const handleLogoutAll = async () => {
    try {
      if (serverOnline && isAuthenticated) {
        await apiFetch('/api/auth/logout-all', { method: 'POST', body: JSON.stringify({}) });
      }
    } catch {
      // Proceed with local logout even if network expires
    }
    await logout();
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serverOnline && !requireAuthForWrite()) return;
    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      showAppToast('أدخل بريداً إلكترونياً صحيحاً', 'error');
      return;
    }
    if (currentUser.hasPassword && !emailCurPassword) {
      showAppToast('أدخل كلمة المرور الحالية لتحديث البريد الإلكتروني', 'error');
      return;
    }
    setEmailSaving(true);
    try {
      await apiFetch('/api/auth/email', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          ...(currentUser.hasPassword ? { currentPassword: emailCurPassword } : {}),
        }),
      });
      setEmailCurPassword('');
      await refreshBootstrap();
      showAppToast('تم تحديث البريد الإلكتروني بنجاح', 'success');
    } catch (err) {
      showAppToast(err instanceof ApiClientError ? err.message : 'تعذر تحديث البريد الإلكتروني', 'error');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serverOnline && !requireAuthForWrite()) return;
    if (currentUser.hasPassword && !curPasswordInput) {
      showAppToast('أدخل كلمة المرور الحالية أولاً', 'error');
      return;
    }
    if (newPasswordInput.length < 6) {
      showAppToast('كلمة المرور الجديدة يجب أن تكون ٦ أحرف على الأقل', 'error');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      showAppToast('تأكيد كلمة المرور غير متطابق', 'error');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({
          ...(currentUser.hasPassword ? { currentPassword: curPasswordInput } : {}),
          newPassword: newPasswordInput,
        }),
      });
      setCurPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      await refreshBootstrap();
      showAppToast('تم تحديث كلمة المرور بنجاح', 'success');
    } catch (err) {
      showAppToast(err instanceof ApiClientError ? err.message : 'تعذر تحديث كلمة المرور', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRequestPhoneLinkOtp = async () => {
    setLinkError('');
    if (serverOnline && !requireAuthForWrite()) return;
    if (!isValidIraqiPhoneInput(linkPhoneInput)) {
      setLinkError('أدخل رقم هاتف عراقي صحيح (مثال: 07701234567)');
      return;
    }
    setLinkLoading(true);
    try {
      const res = await apiFetch<{ challengeId: string }>('/api/auth/phone/request-link', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizeDigits(linkPhoneInput) }),
      });
      setLinkChallengeId(res.challengeId);
      setLinkStep('otp');
      showAppToast('تم إرسال رمز التحقق لربط رقم الهاتف', 'success');
    } catch (err) {
      setLinkError(err instanceof ApiClientError ? err.message : 'تعذر إرسال رمز الربط');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleVerifyPhoneLinkOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError('');
    const cleanCode = normalizeOtpDigits(linkCodeInput);
    if (cleanCode.length !== 6) {
      setLinkError('أدخل رمز التحقق المكون من 6 أرقام');
      return;
    }
    setLinkLoading(true);
    try {
      await apiFetch('/api/auth/phone/verify-link', {
        method: 'POST',
        body: JSON.stringify({ challengeId: linkChallengeId, code: cleanCode }),
      });
      setLinkStep('idle');
      setLinkCodeInput('');
      setLinkPhoneInput('');
      await refreshBootstrap();
      showAppToast('تم ربط رقم الهاتف وتوثيقه بنجاح', 'success');
    } catch (err) {
      setLinkError(err instanceof ApiClientError ? err.message : 'رمز التحقق غير صحيح');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleRequestDeleteOtp = async () => {
    setDeleteError('');
    if (!isValidIraqiPhoneInput(deletePhone)) {
      setDeleteError('أدخل رقم هاتف عراقي صحيح مسجل بهذا الحساب');
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await apiFetch<{ challengeId: string }>('/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizeDigits(deletePhone), purpose: 'delete-account' }),
      });
      setDeleteChallengeId(res.challengeId);
      setDeleteStep('otp');
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : 'تعذر إرسال رمز التحقق');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    const cleanCode = normalizeOtpDigits(deleteCode);
    if (cleanCode.length !== 6) {
      setDeleteError('أدخل رمز التحقق المكون من 6 أرقام');
      return;
    }
    setDeleteLoading(true);
    try {
      await apiFetch('/api/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ challengeId: deleteChallengeId, code: cleanCode }),
      });
      showAppToast('تم حذف الحساب نهائياً', 'info');
      await logout();
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : 'رمز التحقق غير صحيح');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeleteWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('أدخل كلمة المرور لتأكيد حذف الحساب');
      return;
    }
    setDeleteLoading(true);
    try {
      await apiFetch('/api/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      showAppToast('تم حذف الحساب نهائياً', 'info');
      await logout();
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : 'كلمة المرور غير صحيحة');
    } finally {
      setDeleteLoading(false);
    }
  };

  const hasLinkedPhone = Boolean(currentUser.maskedPhone || currentUser.phoneMasked);

  return (
    <div className="flex flex-col gap-4">
      {/* 2FA Toggle Card */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">
              التحقق الثنائي عبر رمز الهاتف العراقي (2FA)
            </h3>
            <span className="text-xs text-[var(--text-muted)]">
              تفعيل التحقق الإضافي لحماية حسابك عند تسجيل الدخول.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!hasLinkedPhone && (
            <span className="text-[11px] font-semibold text-[var(--warning)]">اربط هاتفك أولاً</span>
          )}
          <Switch
            checked={twoFactorEnabled && hasLinkedPhone}
            disabled={!hasLinkedPhone}
            onChange={(v) => {
              if (!hasLinkedPhone) {
                showAppToast('يرجى ربط رقم هاتف عراقي أدناه لتفعيل التحقق الثنائي', 'error');
                return;
              }
              applySetting('twoFactorEnabled', v, setTwoFactorEnabled);
            }}
          />
        </div>
      </div>

      {/* Email & Password Cards */}
      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form
            onSubmit={handleSaveEmail}
            className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <Mail className="w-4 h-4 text-[var(--primary)]" />
              <span>البريد الإلكتروني</span>
            </div>
            <input
              type="email"
              dir="ltr"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="name@example.com"
              className="h-10 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)] font-mono"
            />
            {currentUser.hasPassword && (
              <input
                type="password"
                dir="ltr"
                value={emailCurPassword}
                onChange={(e) => setEmailCurPassword(e.target.value)}
                placeholder="كلمة المرور الحالية"
                className="h-10 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)]"
              />
            )}
            <Button type="submit" variant="primary" isLoading={emailSaving} className="h-9 px-4 text-xs self-end">
              حفظ البريد
            </Button>
          </form>

          <form
            onSubmit={handleSavePassword}
            className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <KeyRound className="w-4 h-4 text-[var(--primary)]" />
              <span>{currentUser.hasPassword ? 'تغيير كلمة المرور' : 'تعيين كلمة مرور'}</span>
            </div>
            {currentUser.hasPassword && (
              <input
                type="password"
                dir="ltr"
                value={curPasswordInput}
                onChange={(e) => setCurPasswordInput(e.target.value)}
                placeholder="كلمة المرور الحالية"
                className="h-10 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)]"
              />
            )}
            <input
              type="password"
              dir="ltr"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="كلمة المرور الجديدة (٦+ أحرف)"
              className="h-10 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)]"
            />
            <input
              type="password"
              dir="ltr"
              value={confirmPasswordInput}
              onChange={(e) => setConfirmPasswordInput(e.target.value)}
              placeholder="تأكيد كلمة المرور الجديدة"
              className="h-10 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)]"
            />
            <Button type="submit" variant="primary" isLoading={passwordSaving} className="h-9 px-4 text-xs self-end">
              حفظ كلمة المرور
            </Button>
          </form>
        </div>
      )}

      {/* Phone Link OTP Card */}
      {isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <PhoneCall className="w-4 h-4 text-[var(--primary)]" />
              <span>ربط أو تحديث رقم الهاتف العراقي (OTP)</span>
            </div>
            {hasLinkedPhone && (
              <span dir="ltr" className="text-xs font-mono text-[var(--success)] font-bold">
                {currentUser.maskedPhone ?? currentUser.phoneMasked}
              </span>
            )}
          </div>

          {linkStep === 'idle' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="tel"
                dir="ltr"
                value={linkPhoneInput}
                onChange={(e) => setLinkPhoneInput(e.target.value)}
                placeholder="0770 123 4567"
                className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs font-mono text-[var(--text)]"
              />
              <Button
                type="button"
                variant="outline"
                isLoading={linkLoading}
                onClick={() => void handleRequestPhoneLinkOtp()}
                className="h-10 px-4 text-xs"
              >
                إرسال رمز الربط
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerifyPhoneLinkOtp} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                dir="ltr"
                value={linkCodeInput}
                onChange={(e) => setLinkCodeInput(e.target.value)}
                placeholder="رمز من 6 أرقام"
                className="h-10 w-36 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs font-mono text-center text-[var(--text)]"
              />
              <Button type="submit" variant="primary" isLoading={linkLoading} className="h-10 px-4 text-xs">
                تأكيد ربط الهاتف
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLinkStep('idle');
                  setLinkCodeInput('');
                }}
                className="h-10 px-3 text-xs"
              >
                إلغاء
              </Button>
            </form>
          )}

          {linkError && (
            <div className="p-2.5 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-semibold">
              {linkError}
            </div>
          )}
        </div>
      )}

      {/* Active Sessions */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">الجلسات والأجهزة المسجلة</h3>
            <span className="text-xs text-[var(--text-muted)]">الأجهزة المتصلة حالياً بحسابك في تواصل.</span>
          </div>

          <div className="flex items-center gap-2">
            {devices.filter((d) => !d.isCurrent).length > 0 && (
              <button
                type="button"
                onClick={() => void terminateOtherSessions()}
                className="text-xs font-bold text-rose-500 hover:underline px-2 py-1"
              >
                إنهاء كافة الجلسات الأخرى
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => void loadDevices()}
                className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label="تحديث الأجهزة"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${devicesLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="py-3 text-xs text-[var(--text-muted)] flex items-center justify-between gap-2">
            <span>سجّل دخولك لعرض وإدارة الأجهزة المتصلة بحسابك.</span>
            <Button type="button" onClick={() => setCurrentRoute('auth')} className="h-8 px-3 text-xs">
              تسجيل الدخول
            </Button>
          </div>
        ) : devicesError ? (
          <div className="p-3 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs">{devicesError}</div>
        ) : devices.length === 0 ? (
          <div className="py-3 text-xs text-[var(--text-muted)]">
            {devicesLoading ? 'جاري تحميل الأجهزة...' : 'لا توجد جلسات نشطة أخرى.'}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {devices.map((sess) => {
              const isPhone = /iphone|android|mobile/i.test(sess.deviceLabel);
              return (
                <div key={sess.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                      {isPhone ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text)] truncate">{sess.deviceLabel}</span>
                        {sess.isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[var(--success-tint)] text-[var(--success)] text-[11px] font-bold shrink-0">
                            هذا الجهاز
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]" dir="ltr">
                        {sess.ipAddress || 'جلسة موثقة'} · {new Date(sess.lastActiveAt).toLocaleString('ar-IQ')}
                      </span>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <button
                      type="button"
                      onClick={() => void revokeDevice(sess.id)}
                      className="text-rose-500 font-semibold hover:underline shrink-0"
                    >
                      إنهاء الجلسة
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isAuthenticated && (
          <div className="pt-2 border-t border-[var(--border)] flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLogoutAll()}
              className="h-9 px-4 text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
            >
              تسجيل الخروج من جميع الأجهزة
            </Button>
          </div>
        )}
      </div>

      {/* Delete Account */}
      {isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--danger)]/30 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-[var(--danger)]">
              <Trash2 className="w-4 h-4" />
              <h3 className="text-sm font-bold">حذف الحساب نهائياً</h3>
            </div>

            {currentUser.hasPassword && hasLinkedPhone && (
              <SegmentedControl<'password' | 'otp'>
                options={[
                  { value: 'password', label: 'بكلمة المرور' },
                  { value: 'otp', label: 'برمز OTP' },
                ]}
                value={deleteMode}
                onChange={(m) => {
                  setDeleteMode(m);
                  setDeleteError('');
                }}
              />
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            يؤدي حذف الحساب إلى إزالة جلساتك وتعطيل الوصول إلى ملفك الشخصي نهائياً بعد تأكيد هويتك.
          </p>

          {deleteMode === 'password' && currentUser.hasPassword ? (
            <form onSubmit={handleConfirmDeleteWithPassword} className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                dir="ltr"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
              <Button type="submit" variant="danger" isLoading={deleteLoading} className="h-10 px-4 text-xs">
                تأكيد حذف الحساب
              </Button>
            </form>
          ) : deleteStep === 'idle' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="tel"
                dir="ltr"
                value={deletePhone}
                onChange={(e) => setDeletePhone(e.target.value)}
                placeholder="0770 123 4567"
                className="h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
              />
              <Button
                type="button"
                variant="danger"
                isLoading={deleteLoading}
                onClick={() => void handleRequestDeleteOtp()}
                className="h-10 px-4 text-xs"
              >
                إرسال رمز تأكيد الحذف
              </Button>
            </div>
          ) : (
            <form onSubmit={handleConfirmDeleteAccount} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                dir="ltr"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
                placeholder="رمز من 6 أرقام"
                className="h-10 w-36 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-center text-[var(--text)]"
              />
              <Button type="submit" variant="danger" isLoading={deleteLoading} className="h-10 px-4 text-xs">
                تأكيد حذف الحساب
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDeleteStep('idle');
                  setDeleteCode('');
                }}
                className="h-10 px-3 text-xs"
              >
                إلغاء
              </Button>
            </form>
          )}

          {deleteError && (
            <div className="p-2.5 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-semibold">
              {deleteError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
