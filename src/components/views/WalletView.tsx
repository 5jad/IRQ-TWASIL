import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Coins, ArrowDownLeft, ArrowUpRight, Gift, AlertCircle, PlusCircle, ShieldCheck } from 'lucide-react';
import { formatNumber, formatTimeSafe } from '../../lib/formatters';
import { Button } from '../ui/Button';

const TOPUP_PRESETS = [250, 500, 1000, 2500];

const GIFTS = [
  { emoji: '☕', name: 'شاي عراقي مهيّل', cost: 50 },
  { emoji: '🌹', name: 'وردة بغدادية', cost: 100 },
  { emoji: '🏺', name: 'صينية نحاس ذهبية', cost: 300 },
  { emoji: '🌴', name: 'تاج النخيل', cost: 500 },
];

export function WalletView() {
  const {
    currentUser,
    users,
    isAuthenticated,
    numeralSystem,
    walletBalance,
    walletTransactions,
    topupWallet,
    requireAuthForWrite,
    serverOnline,
    showAppToast,
  } = useApp();

  const isAdmin = isAuthenticated && currentUser.role === 'admin';
  const [customAmount, setCustomAmount] = useState('500');
  const [targetUserId, setTargetUserId] = useState('');
  const [isToppingUp, setIsToppingUp] = useState(false);

  const handleTopup = async (amount: number) => {
    if (serverOnline && !requireAuthForWrite()) return;
    if (!isAdmin) {
      showAppToast('شحن العملات التجريبية مقيّد للإدارة فقط', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount < 10 || amount > 100000) {
      showAppToast('أدخل مبلغ شحن بين ١٠ و ١٠٠٬٠٠٠ عملة', 'error');
      return;
    }
    setIsToppingUp(true);
    try {
      await topupWallet(Math.round(amount), targetUserId || undefined);
    } finally {
      setIsToppingUp(false);
    }
  };

  return (
    <div
      data-testid="tw-wallet-view"
      className="w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-5 pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12"
    >
      {/* Wallet Balance Card */}
      <div className="p-6 rounded-3xl bg-[var(--lapis)] text-[var(--lapis-fg)] shadow-xl flex flex-col justify-between gap-4 border border-[var(--border)]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6" />
            <span className="text-xs font-bold">محفظة عملات T-Coins (عملات رقمية تجريبية)</span>
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface)]/20 text-xs font-semibold">
            نقاط افتراضية تجريبية
          </span>
        </div>

        <div className="flex flex-col">
          <span
            className="text-3xl font-bold font-display tracking-tight tabular-nums"
            data-testid="tw-wallet-balance"
          >
            {formatNumber(walletBalance, numeralSystem)} T-Coin
          </span>
          <span className="text-xs opacity-90 mt-1">
            عملات رقمية تجريبية تُستخدم للهدايا المعنوية في البث المباشر دون أي قيمة مالية حقيقية.
          </span>
        </div>

        {isAdmin ? (
          <div data-testid="tw-wallet-admin-topup" className="flex flex-col gap-3 pt-3 border-t border-current/20">
            <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-95">
              <ShieldCheck className="w-4 h-4" />
              <span>لوحة شحن الرصيد التجريبي (صلاحية الإدارة فقط)</span>
            </div>

            {/* Quick Topup Presets */}
            <div className="flex flex-wrap items-center gap-2">
              {TOPUP_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={isToppingUp}
                  onClick={() => void handleTopup(preset)}
                  className="px-3 py-1.5 rounded-xl bg-[var(--gold)] text-[var(--gold-fg)] text-xs font-bold tabular-nums shadow-xs active:scale-95 disabled:opacity-60"
                >
                  +{formatNumber(preset, numeralSystem)}
                </button>
              ))}
            </div>

            {/* Custom Topup Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleTopup(Number(customAmount));
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                aria-label="المستفيد من الشحن"
                className="h-9 px-2.5 rounded-xl bg-black/25 border border-white/25 text-xs text-white focus:outline-none max-w-[180px]"
              >
                <option value="" className="text-slate-900">حسابي الحالي (@{currentUser.username})</option>
                {users
                  .filter((u) => u.id !== currentUser.id && u.kind !== 'bot')
                  .map((u) => (
                    <option key={u.id} value={u.id} className="text-slate-900">
                      {u.displayName} (@{u.username})
                    </option>
                  ))}
              </select>

              <input
                type="number"
                min={10}
                max={100000}
                dir="ltr"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                aria-label="مبلغ الشحن"
                className="h-9 w-28 px-3 rounded-xl bg-black/25 border border-white/25 text-xs font-mono tabular-nums text-white placeholder:text-white/60 focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary-sm"
                isLoading={isToppingUp}
                className="gap-1.5 bg-white text-slate-900 hover:bg-white/90"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>شحن تجريبي</span>
              </Button>
            </form>
          </div>
        ) : (
          <div
            data-testid="tw-wallet-topup-restricted"
            className="pt-3 border-t border-current/20 text-xs opacity-90 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              شحن العملات التجريبية مقيّد لإدارة المنصة فقط حالياً لعدم تفعيل بوابة الدفع الإلكتروني.
            </span>
          </div>
        )}
      </div>

      {/* Honesty Notice */}
      <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-[var(--accent)] shrink-0" />
        <span>
          تنبيه: عملات T-Coins هي عملات رقمية تجريبية داخلية للتجربة ولا تمثل أموالاً حقيقية أو استثماراً مالياً.
        </span>
      </div>

      {/* Gifts Catalog */}
      <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
          <Gift className="w-4 h-4 text-[var(--accent)]" />
          <span>كتالوج الهدايا الافتراضية (Virtual Gifts)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {GIFTS.map((g) => (
            <div
              key={g.name}
              className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col items-center gap-1.5 text-center"
            >
              <span className="text-lg">{g.emoji}</span>
              <span className="text-xs font-bold text-[var(--text)] truncate w-full">{g.name}</span>
              <span className="text-[11px] font-bold tabular-nums text-[var(--accent-text)]">
                {formatNumber(g.cost, numeralSystem)} T-Coin
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions Ledger */}
      <div className="p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[var(--text)]">سجل المعاملات المحفوظة</h2>

        {walletTransactions.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--text-muted)]">
            لا توجد معاملات مسجّلة حتى الآن.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {walletTransactions.map((tx) => {
              const isCredit = tx.kind !== 'gift_sent' && tx.amountCoins >= 0;
              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isCredit
                          ? 'bg-[var(--success-tint)] text-[var(--success)]'
                          : 'bg-[var(--danger-tint)] text-[var(--danger)]'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-[var(--text)]">{tx.description}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatTimeSafe(tx.createdAt, numeralSystem)}
                      </span>
                    </div>
                  </div>

                  <span
                    dir="ltr"
                    className={`font-mono font-bold tabular-nums ${
                      isCredit ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}
                  >
                    {tx.amountCoins > 0 ? `+${tx.amountCoins}` : tx.amountCoins} T-Coin
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
