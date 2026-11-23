import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, ShieldAlert, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { apiFetch, ApiClientError } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import type { ReportTargetType } from '../../types';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetTitle?: string;
  targetId?: string;
}

export function ReportModal({ isOpen, onClose, targetType, targetTitle, targetId }: ReportModalProps) {
  const { serverOnline, requireAuthForWrite, showAppToast } = useApp();
  const [step, setStep] = useState<'reason' | 'details' | 'success'>('reason');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [refNumber, setRefNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('reason');
      setSelectedReason('');
      setDetails('');
      setAlsoBlock(false);
      setRefNumber('');
      setIsSubmitting(false);
      setError('');
    }
  }, [isOpen]);

  const REASONS = [
    {
      id: 'extortion',
      label: 'ابتزاز أو تهديد (حالة طارئة)',
      desc: 'تهديد بنشر صور خاصة، ابتزاز إلكتروني، أو تهديد بالسلامة الشخصية.',
      urgent: true,
    },
    {
      id: 'scam',
      label: 'احتيال تجاري أو نصب مالي',
      desc: 'بضاعة مقلدة، استلام مبالغ دون إرسال الطلب، أو ادعاءات مضللة.',
    },
    {
      id: 'harassment',
      label: 'تحرش أو مضايقة موجهة',
      desc: 'إساءة متكررة، تنمر، أو تشهير شخصي.',
    },
    {
      id: 'self-harm',
      label: 'إيذاء النفس أو الانتحار',
      desc: 'منشورات تعبر عن نية إيذاء النفس (يتم توجيه الدعم فوراً).',
    },
    {
      id: 'hate',
      label: 'خطاب كراهية أو طائفية',
      desc: 'تحريض على العنف أو التمييز المناطقي أو الديني.',
    },
    {
      id: 'spam',
      label: 'محتوى مكرر أو سبام',
      desc: 'روابط مريبة أو ترويج غير مصرح به.',
    },
  ];

  const handleNext = () => {
    setError('');
    setStep('details');
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;

    if (!serverOnline) {
      setRefNumber(`OFFLINE-REP-${Date.now().toString(36).toUpperCase()}`);
      setStep('success');
      return;
    }

    if (!requireAuthForWrite()) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const res = await apiFetch<{ id: string; status: string; urgent: boolean }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          targetId: targetId?.trim() || targetTitle?.trim() || 'unknown',
          reason: selectedReason,
          details: details.trim(),
          alsoBlock,
        }),
      });
      setRefNumber(res.id);
      setStep('success');
      showAppToast('تم استلام البلاغ وإحالته لفريق السلامة', 'success');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('تعذر إرسال البلاغ، حاول مرة أخرى');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`إبلاغ عن مخالفة (${targetType})`}
      testId="tw-report-modal"
      contentClassName="max-w-lg"
    >
      <div className="w-full bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2 text-[var(--danger)]">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div className="flex flex-col">
              <h2 className="text-base font-bold text-[var(--text)]">
                إبلاغ عن مخالفة ({targetType})
              </h2>
              {targetTitle && (
                <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[260px]">
                  {targetTitle}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Reason Selector */}
        {step === 'reason' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              يرجى اختيار سبب البلاغ بدقة لمساعدتنا على مراجعته وتأمينه في أسرع وقت:
            </p>

            <div className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedReason(r.id)}
                  className={`p-3 rounded-2xl border text-start flex flex-col gap-1 transition-all ${
                    selectedReason === r.id
                      ? 'border-[var(--primary)] bg-[var(--primary-tint)] ring-2 ring-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text)]">{r.label}</span>
                    {r.urgent && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--danger-tint)] text-[var(--danger)] text-[11px] font-bold">
                        أولوية قصوى
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    {r.desc}
                  </span>
                </button>
              ))}
            </div>

            <Button
              type="button"
              disabled={!selectedReason}
              onClick={handleNext}
              className="w-full mt-2"
            >
              متابعة
            </Button>
          </div>
        )}

        {/* Step 2: Details & Guidance */}
        {step === 'details' && (
          <form onSubmit={handleFinish} className="flex flex-col gap-4">
            {selectedReason === 'extortion' && (
              <div className="p-3 rounded-2xl bg-[var(--danger-tint)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex flex-col gap-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
                  <span>توجيهات حماية فورية لحالات الابتزاز:</span>
                </span>
                <span className="leading-relaxed">
                  لا تستجب لأي مطالب مادية أو تهديدات. يتم توجيه البلاغ فوراً لمشرفي الأمان. ننصحك بتوثيق الرسائل والاتصال بالخط الساخن للأمن الوطني لمكافحة الجرائم الإلكترونية (131 مجاناً داخل العراق).
                </span>
              </div>
            )}

            {selectedReason === 'self-harm' && (
              <div className="p-3 rounded-2xl bg-[var(--primary-tint)] border border-[var(--primary)]/30 text-[var(--primary-text)] text-xs flex flex-col gap-1">
                <span className="font-bold flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-[var(--primary)]" />
                  <span>أنت لست وحدك:</span>
                </span>
                <span className="leading-relaxed">
                  إذا كنت أنت أو شخص تعرفه يمر بظروف صعبة، يرجى التحدث إلى مختص نفسي أو التواصل مع خدمات الرعاية الاجتماعية.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">
                تفاصيل إضافية لمساعدة فريق المراجعة (اختياري):
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                placeholder="اذكر أي تفاصيل إضافية توضح المخالفة..."
                className="w-full p-3 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-xs border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--text)]">
              <input
                type="checkbox"
                checked={alsoBlock}
                onChange={(e) => setAlsoBlock(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span>حظر هذا الحساب تلقائياً لمنع أي تواصل مستقبلي</span>
            </label>

            {error && (
              <div className="p-2.5 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setStep('reason')} className="flex-1" disabled={isSubmitting}>
                السابق
              </Button>
              <Button type="submit" variant="danger" className="flex-1" isLoading={isSubmitting}>
                إرسال البلاغ
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Success Screen with Reference Number */}
        {step === 'success' && (
          <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
            <CheckCircle2 className="w-14 h-14 text-[var(--success)]" />
            <h3 className="text-base font-bold text-[var(--text)]">تم استلام بلاغك بنجاح</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-sm">
              شكراً لمساهمتك في جعل تواصل بيئة آمنة للجميع. رقم مرجع البلاغ الخاص بك للمتابعة:
            </p>
            <span className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] font-mono text-sm font-bold text-[var(--primary)] border border-[var(--border)]" dir="ltr">
              {refNumber}
            </span>
            <Button type="button" onClick={onClose} className="mt-3">
              إغلاق
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
