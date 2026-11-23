import React, { useState, useEffect } from 'react';
import {
  Phone,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Send,
  RefreshCw,
  ArrowRight,
  Check,
  XCircle,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { ApiClientError, apiFetch } from '../../lib/api';
import {
  isValidIraqiPhoneInput,
  normalizeDigits,
  normalizeOtpDigits,
  validateClientHandle,
} from '../../lib/apiHelpers';
import { formatNumber } from '../../lib/formatters';
import type { User } from '../../types';

const IRAQ_PROVINCES = [
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

export interface OtpAuthFlowProps {
  redirectOnSuccess?: boolean;
  onSuccess?: () => void;
  initialPurpose?: 'login' | 'signup';
}

export function OtpAuthFlow({
  redirectOnSuccess = true,
  onSuccess,
  initialPurpose = 'login',
}: OtpAuthFlowProps) {
  const { completeAuthSession, numeralSystem } = useApp();

  const [step, setStep] = useState<'phone' | 'otp' | 'signup' | 'success'>('phone');
  const [purpose, setPurpose] = useState<'login' | 'signup'>(initialPurpose);
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [twoFactorMaskedPhone, setTwoFactorMaskedPhone] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [signupToken, setSignupToken] = useState('');

  // Signup state
  const [displayName, setDisplayName] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [handleCheck, setHandleCheck] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });
  const [province, setProvince] = useState('بغداد');
  const [birthYear, setBirthYear] = useState('2000');
  const [accountType, setAccountType] = useState<'personal' | 'creator' | 'merchant'>('personal');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentYear = new Date().getUTCFullYear();
  const parsedBirthYear = Number(normalizeDigits(birthYear));
  const userAge =
    Number.isInteger(parsedBirthYear) && parsedBirthYear >= 1920 && parsedBirthYear <= currentYear
      ? currentYear - parsedBirthYear
      : 26;
  const isUnder13 = userAge < 13;
  const isUnder18 = userAge >= 13 && userAge < 18;

  useEffect(() => {
    if (isUnder18 && accountType !== 'personal') {
      setAccountType('personal');
    }
  }, [isUnder18, accountType]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Debounced live handle availability check
  useEffect(() => {
    if (step !== 'signup') return;
    const raw = handleInput.trim();
    if (!raw) {
      setHandleCheck({ checking: false });
      return;
    }
    const localCheck = validateClientHandle(raw);
    if (!localCheck.ok) {
      setHandleCheck({
        checking: false,
        available: false,
        message: localCheck.message,
      });
      return;
    }

    let cancelled = false;
    setHandleCheck({ checking: true });
    const timer = setTimeout(() => {
      apiFetch<{ available: boolean; message?: string }>(
        `/api/auth/handle-available?handle=${encodeURIComponent(localCheck.handle)}`
      )
        .then((res) => {
          if (cancelled) return;
          setHandleCheck({
            checking: false,
            available: res.available,
            message: res.message || (res.available ? 'الاسم متاح' : 'اسم المستخدم مستخدم بالفعل'),
          });
        })
        .catch(() => {
          if (cancelled) return;
          setHandleCheck({ checking: false });
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handleInput, step]);

  const requestOtpCode = async (targetPurpose: 'login' | 'signup') => {
    setErrorMsg(null);
    const cleaned = normalizeDigits(phone).trim();
    if (!isValidIraqiPhoneInput(cleaned)) {
      setErrorMsg('يرجى إدخال رقم هاتف عراقي صحيح يبدأ بـ 07');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{
        challengeId: string;
        expiresInSec: number;
        resendAfterSec: number;
      }>('/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({
          phone: cleaned,
          purpose: targetPurpose,
        }),
      });
      setChallengeId(res.challengeId);
      setOtpInput('');
      setResendCooldown(res.resendAfterSec || 60);
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.retryAfterSec) setResendCooldown(err.retryAfterSec);
        setErrorMsg(err.message);
      } else {
        setErrorMsg('تعذّر إرسال رمز التحقق، حاول مرة أخرى');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void requestOtpCode(purpose);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanedId = normalizeDigits(identifier).trim();
    if (cleanedId.length < 2) {
      setErrorMsg('يرجى إدخال رقم الهاتف أو اسم المستخدم');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('يرجى إدخال كلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<
        | { status: 'authenticated'; user: User; sessionToken?: string }
        | {
            status: 'two_factor_required';
            challengeId: string;
            maskedPhone: string;
            resendAfterSec?: number;
          }
      >('/api/auth/password-login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: cleanedId,
          password: loginPassword,
        }),
      });
      if (res.status === 'two_factor_required') {
        setChallengeId(res.challengeId);
        setTwoFactorMaskedPhone(res.maskedPhone);
        setOtpInput('');
        setResendCooldown(res.resendAfterSec || 60);
        setStep('otp');
        return;
      }
      setStep('success');
      await completeAuthSession(res.user, redirectOnSuccess, res.sessionToken);
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('تعذّر تسجيل الدخول، تحقق من البيانات وحاول مرة أخرى');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const code = normalizeOtpDigits(otpInput);
    if (code.length !== 6) {
      setErrorMsg('أدخل الرمز المكون من ٦ أرقام كاملاً');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<
        | { status: 'authenticated'; user: User; sessionToken?: string }
        | { status: 'needs_signup'; signupToken: string }
      >('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, code }),
      });

      if (res.status === 'authenticated' && res.user) {
        setStep('success');
        await completeAuthSession(res.user, redirectOnSuccess, res.sessionToken);
        onSuccess?.();
        return;
      }

      if (res.status === 'needs_signup' && res.signupToken) {
        setSignupToken(res.signupToken);
        setStep('signup');
        return;
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('تعذّر التحقق من الرمز');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isUnder13) {
      setErrorMsg('يجب أن يكون عمرك ١٣ سنة على الأقل لإنشاء حساب');
      return;
    }
    const handleCheckLocal = validateClientHandle(handleInput);
    if (!handleCheckLocal.ok) {
      setErrorMsg(handleCheckLocal.message || 'اسم المستخدم غير صالح');
      return;
    }
    if (!displayName.trim() || displayName.trim().length < 2) {
      setErrorMsg('يرجى إدخال الاسم المعروض (حرفان على الأقل)');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg('يرجى الموافقة على شروط الاستخدام للمتابعة');
      return;
    }

    setLoading(true);
    try {
      if (signupPassword && signupPassword.length < 6) {
        setErrorMsg('كلمة المرور يجب أن تكون ٦ أحرف على الأقل');
        return;
      }

      const res = await apiFetch<{ status: 'authenticated'; user: User; sessionToken?: string }>(
        '/api/auth/signup',
        {
          method: 'POST',
          body: JSON.stringify({
            signupToken,
            handle: handleCheckLocal.handle,
            displayName: displayName.trim(),
            province,
            birthYear: parsedBirthYear,
            accountType: isUnder18 ? 'personal' : accountType,
            ...(signupPassword ? { password: signupPassword } : {}),
            acceptedTerms: true,
          }),
        }
      );
      setStep('success');
      await completeAuthSession(res.user, redirectOnSuccess, res.sessionToken);
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('تعذّر إنشاء الحساب، حاول مرة أخرى');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 relative">
      {step === 'success' && (
        <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--success)]/15 text-[var(--success)] flex items-center justify-center">
            <CheckCircle className="w-8 h-8" />
          </div>
          <span className="text-base font-bold text-[var(--text)]">مرحباً بك في تواصل!</span>
          <span className="text-xs text-[var(--text-muted)]">تم تأمين جلستك بنجاح...</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          data-testid="tw-auth-error"
          className="p-3 rounded-xl bg-[var(--danger-tint)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-bold flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {step === 'phone' && (
        <div className="flex flex-col gap-4">
          <div className="flex rounded-2xl bg-[var(--surface-2)] p-1 border border-[var(--border)] select-none">
            <button
              type="button"
              onClick={() => {
                setPurpose('login');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                purpose === 'login'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setPurpose('signup');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                purpose === 'signup'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          {purpose === 'login' && (
            <div className="flex items-center gap-1.5 text-xs select-none">
              <button
                type="button"
                data-testid="tw-auth-method-password"
                onClick={() => {
                  setLoginMethod('password');
                  setErrorMsg(null);
                }}
                className={`flex-1 h-9 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  loginMethod === 'password'
                    ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary-text)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>كلمة المرور</span>
              </button>
              <button
                type="button"
                data-testid="tw-auth-method-otp"
                onClick={() => {
                  setLoginMethod('otp');
                  setErrorMsg(null);
                }}
                className={`flex-1 h-9 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  loginMethod === 'otp'
                    ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary-text)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>رمز SMS</span>
              </button>
            </div>
          )}

          {purpose === 'login' && loginMethod === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="tw-auth-identifier"
                  className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5"
                >
                  <UserIcon className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>رقم الهاتف، البريد الإلكتروني، أو اسم المستخدم</span>
                </label>
                <input
                  id="tw-auth-identifier"
                  data-testid="tw-auth-identifier-input"
                  type="text"
                  dir="ltr"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="0770 123 4567 أو email@example.com أو @irq"
                  className="w-full h-12 px-4 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text)] text-sm font-mono focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="tw-auth-password"
                  className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>كلمة المرور</span>
                </label>
                <div className="relative">
                  <input
                    id="tw-auth-password"
                    data-testid="tw-auth-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    dir="ltr"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 ps-4 pe-12 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text)] text-sm font-mono focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute inset-y-0 end-0 px-3.5 flex items-center text-[var(--text-muted)] hover:text-[var(--text)]"
                    aria-label={showLoginPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                data-testid="tw-auth-password-submit"
                className="w-full h-12 text-sm mt-1"
              >
                {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tw-auth-phone" className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>رقم الهاتف العراقي</span>
                </label>
                <div className="relative">
                  <input
                    id="tw-auth-phone"
                    data-testid="tw-auth-phone-input"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0770 123 4567"
                    className="w-full h-12 px-4 pe-16 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text)] text-sm font-mono focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    required
                  />
                  <span
                    className="absolute end-3 top-3 text-[11px] font-bold text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border-strong)]"
                    dir="ltr"
                  >
                    +964
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  يدعم شبكات زين العراق، آسيا سيل، وكورك تليكوم عبر رمز تحقق من ٦ أرقام.
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[var(--success)] font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>جلسة مشفّرة ومحميّة بالتحقق الهاتفي عبر رمز SMS</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                data-testid="tw-auth-request-otp"
                className="w-full h-12 text-sm"
              >
                {loading ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق SMS'}
              </Button>
            </form>
          )}
        </div>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
          <div className="text-center flex flex-col items-center gap-1.5 py-1">
            <div className="w-11 h-11 rounded-full bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text)]">أدخل رمز التحقق</h3>
            <p className="text-xs text-[var(--text-muted)]">
              أرسلنا رمزاً من ٦ أرقام إلى الرقم{' '}
              <span dir="ltr" className="font-mono font-bold text-[var(--text)]">
                {twoFactorMaskedPhone || phone}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tw-auth-otp" className="text-xs font-bold text-[var(--text)] text-center">
              الرمز السري (٦ أرقام)
            </label>
            <input
              id="tw-auth-otp"
              data-testid="tw-auth-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(normalizeOtpDigits(e.target.value))}
              placeholder="••••••"
              className="w-full h-14 px-4 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-2)] text-center text-2xl font-mono font-bold tracking-[0.45em] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading || otpInput.length !== 6}
            data-testid="tw-auth-verify-otp"
            className="w-full h-12 text-sm"
          >
            {loading ? 'جارٍ التحقق...' : 'تأكيد الدخول'}
          </Button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setErrorMsg(null);
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text)] font-semibold flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>تغيير الرقم</span>
            </button>

            <button
              type="button"
              disabled={loading || resendCooldown > 0}
              onClick={() => void requestOtpCode(purpose)}
              className="text-[var(--primary)] font-bold disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                {resendCooldown > 0
                  ? `إعادة الإرسال (${formatNumber(resendCooldown, numeralSystem)} ث)`
                  : 'إعادة إرسال الرمز'}
              </span>
            </button>
          </div>
        </form>
      )}

      {step === 'signup' && (
        <form onSubmit={handleCompleteSignup} className="flex flex-col gap-3.5">
          <div className="border-b border-[var(--border)] pb-2">
            <h3 className="text-sm font-bold text-[var(--text)]">إكمال ملفك الشخصي</h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              تم تأكيد رقم هاتفك بنجاح. اختر اسم المستخدم وبيانات الحساب.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tw-signup-name" className="text-xs font-bold text-[var(--text)]">
              الاسم المعروض
            </label>
            <input
              id="tw-signup-name"
              data-testid="tw-signup-displayname"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="مثال: أحمد البغدادي"
              maxLength={60}
              className="w-full h-11 px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-sm text-[var(--text)]"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tw-signup-handle" className="text-xs font-bold text-[var(--text)]">
              اسم المستخدم (@handle)
            </label>
            <div className="relative">
              <input
                id="tw-signup-handle"
                data-testid="tw-signup-handle"
                type="text"
                dir="ltr"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value.toLowerCase())}
                placeholder="ali_baghdad"
                maxLength={20}
                className="w-full h-11 px-3.5 pe-9 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-sm font-mono text-[var(--text)]"
                required
              />
              {handleCheck.available === true && (
                <Check className="w-4 h-4 text-[var(--success)] absolute end-3 top-3.5" />
              )}
              {handleCheck.available === false && (
                <XCircle className="w-4 h-4 text-[var(--danger)] absolute end-3 top-3.5" />
              )}
            </div>
            {handleCheck.message && (
              <span
                className={`text-[11px] font-semibold ${
                  handleCheck.available ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                }`}
              >
                {handleCheck.checking ? 'جارٍ التحقق...' : handleCheck.message}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label htmlFor="tw-signup-province" className="text-xs font-bold text-[var(--text)]">
                المحافظة
              </label>
              <select
                id="tw-signup-province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)]"
              >
                {IRAQ_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="tw-signup-year" className="text-xs font-bold text-[var(--text)]">
                سنة الميلاد
              </label>
              <input
                id="tw-signup-year"
                data-testid="tw-signup-birthyear"
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                min="1920"
                max={currentYear}
                className="w-full h-11 px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs text-[var(--text)]"
                required
              />
            </div>
          </div>

          {isUnder13 && (
            <div className="p-2.5 rounded-xl bg-[var(--danger-tint)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-semibold">
              الحد الأدنى للعمر للتسجيل في تواصل هو ١٣ سنة.
            </div>
          )}

          {isUnder18 && (
            <div className="p-2.5 rounded-xl bg-[var(--warning-tint)] border border-[var(--warning)]/30 text-[var(--warning)] text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>حساب دون ١٨ سنة: يتم تفعيل الحساب الشخصي وحماية القاصرين تلقائياً.</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--text)]">نوع الحساب</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'personal' as const, label: 'شخصي' },
                { id: 'creator' as const, label: 'صانع محتوى' },
                { id: 'merchant' as const, label: 'متجر عراقي' },
              ].map((t) => {
                const disabled = isUnder18 && t.id !== 'personal';
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setAccountType(t.id)}
                    className={`h-10 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 ${
                      accountType === t.id
                        ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary-text)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tw-signup-password" className="text-xs font-bold text-[var(--text)]">
              كلمة المرور (اختيارية للدخول السريع)
            </label>
            <div className="relative">
              <input
                id="tw-signup-password"
                data-testid="tw-signup-password"
                type={showSignupPassword ? 'text' : 'password'}
                dir="ltr"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="٦ أحرف على الأقل"
                maxLength={128}
                className="w-full h-11 ps-3.5 pe-11 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-sm font-mono text-[var(--text)]"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword((prev) => !prev)}
                className="absolute inset-y-0 end-0 px-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label={showSignupPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-xs text-[var(--text)] select-none pt-1">
            <input
              type="checkbox"
              data-testid="tw-signup-terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[var(--border-strong)] text-[var(--primary)]"
            />
            <span>أوافق على شروط الاستخدام وميثاق مكافحة الابتزاز وحماية الخصوصية في العراق.</span>
          </label>

          <Button
            type="submit"
            variant="primary"
            disabled={loading || isUnder13}
            data-testid="tw-signup-submit"
            className="w-full h-12 text-sm mt-1"
          >
            {loading ? 'جارٍ إنشاء الحساب...' : 'إتمام إنشاء الحساب'}
          </Button>
        </form>
      )}
    </div>
  );
}
