import React from 'react';
import { Store, CheckCircle, ShieldAlert } from 'lucide-react';
import type { User } from '../../types';

interface SettingsMerchantTabProps {
  currentUser: User;
}

export function SettingsMerchantTab({ currentUser }: SettingsMerchantTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">توثيق الحساب ومتجر تواصل العراقي</h3>
            <span className="text-xs text-[var(--text-muted)]">
              عرض حالة التوثيق الحالية وشارة المتجر المعتمدة في حسابك.
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border)] text-xs text-[var(--text)] flex flex-col gap-2">
          {currentUser.isVerified ? (
            <div className="flex items-center gap-2 font-bold text-[var(--primary)]">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                {currentUser.verifiedKind === 'official'
                  ? `حساب رسمي موثّق: ${currentUser.displayName}`
                  : currentUser.verifiedKind === 'merchant'
                  ? `متجر تجاري موثّق: ${currentUser.displayName}`
                  : `حساب موثّق بالهوية: ${currentUser.displayName}`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-bold text-[var(--text-muted)]">
              <ShieldAlert className="w-4 h-4 shrink-0 text-[var(--accent)]" />
              <span>
                حسابك غير موثّق حالياً (
                {currentUser.accountType === 'merchant'
                  ? 'حساب تاجر'
                  : currentUser.accountType === 'creator'
                  ? 'حساب صانع محتوى'
                  : 'حساب شخصي'}
                )
              </span>
            </div>
          )}
          <p className="text-[var(--text-muted)] leading-relaxed">
            {currentUser.isVerified
              ? 'يتمتع الحساب الموثّق بأولوية ظهور في نتائج البحث وحماية إضافية ضد انتحال الشخصية، مع عرض منتجاته بوضوح في السوق.'
              : 'يمكنك إدراج منتجاتك وإدارتها من قسم السوق مباشرة، وعند مراجعة الإدارة يتم تفعيل شارة التوثيق الرسمية على حسابك.'}
          </p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
        <h3 className="text-sm font-bold text-[var(--text)] border-b border-[var(--border)] pb-2">
          ميثاق التجارة العادلة في العراق
        </h3>
        <ul className="text-xs text-[var(--text-muted)] list-disc list-inside space-y-1.5 leading-relaxed">
          <li>الأسعار المعروضة تكون بالدينار العراقي (IQD) بوضوح وشفافية.</li>
          <li>التواصل والاتفاق على التوصيل يتم مباشرة بين البائع والمشتري دون عمولات خفية.</li>
          <li>يُحظر منعاً باتاً عرض منتجات مقلدة أو منسوخة دون تصريح أصحابها.</li>
        </ul>
      </div>
    </div>
  );
}
