import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldAlert,
  CheckCircle2,
  Ban,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { apiFetch, ApiClientError, type AdminKpisDto, type AdminReportDto } from '../../lib/api';
import { formatNumber } from '../../lib/formatters';
import { arabicTextMatches } from '../../lib/arabicSearch';

export function AdminView() {
  const { users, serverOnline, isAuthenticated, numeralSystem, showAppToast, setCurrentRoute } = useApp();
  const [activeTab, setActiveTab] = useState<'kpi' | 'reports' | 'users' | 'flags'>('reports');
  const [reports, setReports] = useState<AdminReportDto[]>([]);
  const [kpis, setKpis] = useState<AdminKpisDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userStatuses, setUserStatuses] = useState<Record<string, 'active' | 'suspended' | 'deleted'>>({});

  const loadAdminData = useCallback(async () => {
    if (!serverOnline) return;
    setLoading(true);
    setError('');
    try {
      const [kpiData, reportData] = await Promise.all([
        apiFetch<AdminKpisDto>('/api/admin/kpis'),
        apiFetch<{ reports: AdminReportDto[] }>('/api/admin/reports'),
      ]);
      setKpis(kpiData);
      setReports(reportData.reports);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('تعذر تحميل بيانات الإدارة');
      }
    } finally {
      setLoading(false);
    }
  }, [serverOnline]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData, isAuthenticated]);

  const handleResolve = async (id: string, action: 'ban' | 'dismiss') => {
    setResolvingId(id);
    try {
      await apiFetch(`/api/admin/reports/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setReports((prev) => prev.filter((r) => r.id !== id));
      setKpis((prev) =>
        prev ? { ...prev, pendingReports: Math.max(0, prev.pendingReports - 1) } : prev
      );
      showAppToast(action === 'ban' ? 'تم تعليق الحساب وحل البلاغ' : 'تم استبعاد البلاغ', 'success');
    } catch (err) {
      showAppToast(err instanceof ApiClientError ? err.message : 'تعذر معالجة البلاغ', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleToggleSuspend = async (userId: string, currentStatus: 'active' | 'suspended' | 'deleted') => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus }),
      });
      setUserStatuses((prev) => ({ ...prev, [userId]: nextStatus }));
      showAppToast(nextStatus === 'suspended' ? 'تم تجميد الحساب' : 'تم تفعيل الحساب', 'success');
    } catch (err) {
      showAppToast(err instanceof ApiClientError ? err.message : 'تعذر تحديث حالة الحساب', 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim();
    if (!q) return true;
    return arabicTextMatches(`${u.displayName} ${u.username} ${u.province}`, q);
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 flex flex-col gap-5 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12">
      {/* Admin Header */}
      <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--primary)]">
          <ShieldAlert className="w-6 h-6" />
          <div>
            <h1 className="text-base font-bold text-[var(--text)]">لوحة الإدارة والرقابة والأمان</h1>
            <span className="text-xs text-[var(--text-muted)]">
              إدارة البلاغات النشطة ومراجعة الحسابات والمؤشرات التشغيلية
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[var(--surface-2)] p-1 rounded-2xl border border-[var(--border)] select-none">
            {[
              { id: 'kpi', label: 'المؤشرات العامة' },
              { id: 'reports', label: `طابور البلاغات (${formatNumber(reports.length, numeralSystem)})` },
              { id: 'users', label: 'إدارة الحسابات' },
              { id: 'flags', label: 'أعلام الميزات' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  activeTab === t.id
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadAdminData()}
            disabled={loading}
            className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[var(--danger-tint)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          {!isAuthenticated && (
            <Button type="button" onClick={() => setCurrentRoute('auth')} className="h-8 px-3 text-xs">
              تسجيل الدخول
            </Button>
          )}
        </div>
      )}

      {/* 1. Reports Queue */}
      {activeTab === 'reports' && (
        <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text)]">طابور البلاغات المفتوحة للمراجعة</h2>
            <span className="text-xs text-[var(--text-muted)]">
              {loading ? 'جاري التحميل...' : `البلاغات المفتوحة: ${formatNumber(reports.length, numeralSystem)}`}
            </span>
          </div>

          {!serverOnline ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              يتطلب عرض البلاغات الاتصال بالخادم.
            </div>
          ) : reports.length === 0 && !loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-[var(--success)]" />
              <span className="text-xs font-bold text-[var(--text)]">
                طابور البلاغات فارغ تماماً حالياً!
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
                    rep.urgent
                      ? 'border-[var(--danger)] bg-[var(--danger-tint)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                        #{rep.id}
                      </span>
                      <span className="text-xs font-bold text-[var(--text)]">
                        {rep.targetType} · {rep.reason}
                      </span>
                      {rep.urgent && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--danger)] text-[var(--danger-fg)] text-[11px] font-bold">
                          عاجل: أولوية قصوى
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]" dir="ltr">
                      {new Date(rep.createdAt).toLocaleString('ar-IQ')}
                    </span>
                  </div>

                  {rep.details && (
                    <p className="text-xs text-[var(--text)] font-medium">التفاصيل: {rep.details}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)]">
                      الهدف: <strong className="text-[var(--text)] font-mono">{rep.targetId}</strong> · المبلّغ: {rep.reporterId}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        onClick={() => void handleResolve(rep.id, 'ban')}
                        isLoading={resolvingId === rep.id}
                        className="h-8 px-3 text-xs gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>تعليق الحساب وإغلاق البلاغ</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => void handleResolve(rep.id, 'dismiss')}
                        disabled={resolvingId === rep.id}
                        className="h-8 px-3 text-xs"
                      >
                        استبعاد البلاغ
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. KPI Metrics */}
      {activeTab === 'kpi' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي الحسابات المسجلة', value: kpis ? formatNumber(kpis.totalUsers, numeralSystem) : '—' },
            { label: 'البلاغات المفتوحة', value: kpis ? formatNumber(kpis.pendingReports, numeralSystem) : '—' },
            { label: 'إجمالي المنشورات', value: kpis ? formatNumber(kpis.totalPosts, numeralSystem) : '—' },
            { label: 'إجمالي القصص', value: kpis ? formatNumber(kpis.totalStories, numeralSystem) : '—' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-1"
            >
              <span className="text-xs text-[var(--text-muted)]">{kpi.label}</span>
              <span className="text-2xl font-bold font-display text-[var(--text)]">
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Users Moderation Tab */}
      {activeTab === 'users' && (
        <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--text)]">إدارة الحسابات والصلاحيات</h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="بحث بالاسم أو المعرّف..."
                className="w-full h-9 ps-9 pe-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>

          <div className="flex flex-col divide-y divide-[var(--border)]">
            {filteredUsers.map((u) => {
              const effectiveStatus = userStatuses[u.id] ?? u.status ?? 'active';
              return (
                <div key={u.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={u.avatarUrl} name={u.displayName} size={36} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[var(--text)] truncate">{u.displayName}</span>
                      <span className="text-[11px] text-[var(--text-muted)] truncate" dir="ltr">
                        @{u.username} · {u.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        effectiveStatus === 'suspended'
                          ? 'bg-[var(--danger-tint)] text-[var(--danger)]'
                          : 'bg-[var(--success-tint)] text-[var(--success)]'
                      }`}
                    >
                      {effectiveStatus === 'suspended' ? 'مجمّد' : 'نشط'}
                    </span>

                    <Button
                      type="button"
                      variant={effectiveStatus === 'suspended' ? 'outline' : 'danger'}
                      onClick={() => void handleToggleSuspend(u.id, effectiveStatus)}
                      className="h-8 px-3 text-xs"
                    >
                      {effectiveStatus === 'suspended' ? 'تفعيل' : 'تجميد'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Feature Flags */}
      {activeTab === 'flags' && (
        <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
          <h2 className="text-sm font-bold text-[var(--text)]">أعلام الميزات (Feature Flags)</h2>
          <div className="flex flex-col divide-y divide-[var(--border)] text-xs">
            {[
              { name: 'ff_profile_canvas', label: 'محرر تصاميم الملفات (Profile Canvas)', enabled: true },
              { name: 'ff_t_coins_wallet', label: 'المحفظة الافتراضية والهدايا T-Coins', enabled: true },
              { name: 'ff_merchant_shop', label: 'سوق تواصل والمتاجر المحلية', enabled: true },
              { name: 'ff_bot_accounts', label: 'حسابات البوتات والخدمات المؤتمتة', enabled: true },
              { name: 'ff_ar_face_lenses', label: 'عدسات ومؤثرات الواقع المعزز AR', enabled: false },
            ].map((f) => (
              <div key={f.name} className="py-2.5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-[var(--text)]">{f.label}</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{f.name}</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    f.enabled
                      ? 'bg-[var(--success-tint)] text-[var(--success)]'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  {f.enabled ? 'مفعلة في الإنتاج' : 'مؤجلة خلف علم'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
