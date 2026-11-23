import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, FollowButton } from '../ui/Button';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { TextField, PasswordField, SearchField, Switch, SegmentedControl } from '../ui/Input';
import { PostCard } from '../feed/PostCard';
import { ChatRow } from '../chat/ChatRow';
import { ChatBubble, DateChip } from '../chat/ChatBubble';
import { ProductCard } from '../market/ProductCard';
import { Theme, AccentPreset, Handedness, NumeralSystem } from '../../types';
import {
  formatPriceIQD,
  formatCompactCount,
  formatRelativeTime,
  formatNumber,
  IRAQI_MONTHS,
} from '../../lib/formatters';
import {
  Palette,
  Sliders,
  Type,
  Eye,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react';

export function ComponentGallery() {
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
    posts,
    conversations,
    activeMessages,
    products,
  } = useApp();

  const [testInput, setTestInput] = useState('');
  const [testPassword, setTestPassword] = useState('Baghdad2026!');
  const [isFollowingDemo, setIsFollowingDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<'tokens' | 'components' | 'formatters' | 'preview'>(
    'tokens'
  );

  const THEMES: { id: Theme; label: string; desc: string }[] = [
    { id: 'light', label: 'رمال بغداد', desc: 'نهاري هادئ ودافئ' },
    { id: 'dark', label: 'بغداد كحّلة', desc: 'ليلي مريح للعينين' },
    { id: 'calm', label: 'هادئ', desc: 'سيبيا رمادي بدون إضاءة بيضاء نقية' },
    { id: 'high-contrast', label: 'تباين عالٍ', desc: 'نسبة تباين 21:1 للأشخاص ضعاف البصر' },
  ];

  const ACCENTS: { id: AccentPreset; label: string }[] = [
    { id: 'teal', label: 'أزرق رافديني' },
    { id: 'copper', label: 'نحاسي تراثي' },
    { id: 'indigo', label: 'نيلي بغدادي' },
    { id: 'green', label: 'أخضر نخيل' },
    { id: 'rose', label: 'وردي جوري' },
    { id: 'violet', label: 'بنفسجي' },
    { id: 'slate', label: 'رمادي حجري' },
    { id: 'gold', label: 'ذهبي بابل' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 flex flex-col gap-8 pb-32">
      {/* Title & Introduction */}
      <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent)]">
          <Sparkles className="w-4 h-4" />
          <span>المرحلة ١ — دليل المكونات ونظام التصميم الموحد</span>
        </div>
        <h1 className="text-2xl font-bold font-display text-[var(--text)]">
          نظام تصميم IRQ تواصل
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          فحص وتجربة جميع رموز التصميم، السمات الأربعة، سمة اللون المخصصة، محاذاة شريط التنقل بحسب
          اليد، والخطوط العربية (Cairo & Reem Kufi) مع دعم كامل للـ RTL.
        </p>

        {/* Tab switch */}
        <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
          {[
            { id: 'tokens', label: 'السمات والألوان والتحكم' },
            { id: 'components', label: 'أزرار ومكونات الواجهة' },
            { id: 'formatters', label: 'منسقات اللغة العراقية' },
            { id: 'preview', label: 'معاينة المنشورات والمحادثات' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === t.id
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-xs'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: TOKENS & CONTROLS */}
      {activeTab === 'tokens' && (
        <div className="flex flex-col gap-6">
          {/* 1. Theme Selector */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--primary)]" />
              <span>السمات الأربعة المعتمدة (Themes)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setTheme(th.id)}
                  className={`p-3.5 rounded-xl border text-start flex flex-col gap-1 transition-all ${
                    theme === th.id
                      ? 'border-[var(--primary)] bg-[var(--primary-tint)] ring-2 ring-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <span className="text-sm font-bold text-[var(--text)]">{th.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{th.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. User Accent Preset */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--accent)]" />
              <span>اللون البارز للمستخدم (User Accent — 8 Presets)</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {ACCENTS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setAccent(acc.id)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-start transition-all ${
                    accent === acc.id
                      ? 'border-[var(--text)] ring-2 ring-[var(--text)] bg-[var(--surface-2)] font-bold'
                      : 'border-[var(--border)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span
                    data-accent={acc.id}
                    className="w-4 h-4 rounded-full shrink-0 shadow-xs border border-[var(--border)]"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                  <span className="text-xs text-[var(--text)] truncate">{acc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Handedness (Thumb ergonomics for BottomBar) */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--primary)]" />
              <span>محاذاة شريط التنقل السفلي حسب اليد المهيمنة (Handedness)</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              ضبط تموضع الشريط السفلي العائم ليناسب إبهام اليد اليمنى، اليسرى، أو المنتصف مع تجربة هاتف سهلة.
            </p>

            <SegmentedControl<Handedness>
              options={[
                { value: 'center', label: 'منتصف الشاشة' },
                { value: 'right', label: 'يمين (اليد اليمنى)' },
                { value: 'left', label: 'يسار (اليد اليسرى)' },
              ]}
              value={handedness}
              onChange={setHandedness}
            />
          </div>

          {/* 4. Font Scale & Numerals */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4">
            <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Type className="w-4 h-4 text-[var(--primary)]" />
              <span>مقياس الخط والأرقام (Font Scale & Numerals)</span>
            </h2>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-semibold text-[var(--text)]">
                <span>حجم الخط العام: {Math.round(fontScale * 100)}%</span>
                <span className="text-[var(--text-muted)]">النطاق: 85% إلى 150%</span>
              </div>
              <input
                type="range"
                min="0.85"
                max="1.50"
                step="0.05"
                value={fontScale}
                onChange={(e) => setFontScale(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-[var(--border)] accent-[var(--primary)] cursor-pointer"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                عينة نصية: "تواصل، كل العراق بمكان واحد. واجهات عربية أصيلة تلبي احتياجات كافة المحافظات."
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--border)]">
              <span className="block text-xs font-semibold text-[var(--text)] mb-2">
                نظام كتابة الأرقام:
              </span>
              <SegmentedControl<NumeralSystem>
                options={[
                  { value: 'arabic-indic', label: 'أرقام مشرقية (١ ٢ ٣)' },
                  { value: 'western', label: 'أرقام مغربية (1 2 3)' },
                ]}
                value={numeralSystem}
                onChange={setNumeralSystem}
              />
            </div>
          </div>

          {/* 5. Accessibility Toggles */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col divide-y divide-[var(--border)]">
            <Switch
              checked={reduceMotion}
              onChange={setReduceMotion}
              label="تقليل الحركة (Reduce Motion)"
              description="إلغاء حركات الانتقال والتكبير واستبدالها بتلاشي ناعم."
            />
            <Switch
              checked={dataSaver}
              onChange={setDataSaver}
              label="وضع توفير البيانات (Data Saver)"
              description="تقليل دقة الصور وإيقاف التشغيل التلقائي للفيديوهات على شبكات الهاتف."
            />
          </div>
        </div>
      )}

      {/* TAB 2: UI COMPONENTS INVENTORY */}
      {activeTab === 'components' && (
        <div className="flex flex-col gap-6">
          {/* Buttons showcase */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)]">أزرار المنصة (Buttons)</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary-lg">زر أساسي كبير</Button>
              <Button variant="primary">زر أساسي عادي</Button>
              <Button variant="primary-sm">زر صغير</Button>
              <Button variant="secondary">زر ثانوي</Button>
              <Button variant="outline">زر مفرغ</Button>
              <Button variant="copper">زر تجاري (اطلب)</Button>
              <Button variant="danger">زر تحذيري</Button>
              <Button variant="ghost">زر شفاف</Button>
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex items-center gap-4">
              <span className="text-xs font-semibold text-[var(--text)]">زر المتابعة التفاعلي:</span>
              <FollowButton
                isFollowing={isFollowingDemo}
                onToggle={() => setIsFollowingDemo(!isFollowingDemo)}
              />
            </div>
          </div>

          {/* Avatars & Story Rings */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)]">
              الصور الرمزية وحلقات القصص (Avatars & Rings)
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  size={56}
                  hasStory={true}
                  hasUnseenStory={true}
                />
                <span className="text-[11px] text-[var(--text-muted)]">قصة جديدة</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  size={56}
                  hasStory={true}
                  hasUnseenStory={true}
                  isMerchant={true}
                />
                <span className="text-[11px] text-[var(--text-muted)]">متجر (نحاسي)</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  size={56}
                  hasStory={true}
                  isCloseFriend={true}
                  hasUnseenStory={true}
                />
                <span className="text-[11px] text-[var(--text-muted)]">أصدقاء مقربون</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  size={56}
                  hasStory={true}
                  isOwnStoryEmpty={true}
                />
                <span className="text-[11px] text-[var(--text-muted)]">قصتي (إضافة +)</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  size={56}
                  isOnline={true}
                />
                <span className="text-[11px] text-[var(--text-muted)]">متصل الآن</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <Avatar name="زينب كريم" size={56} />
                <span className="text-[11px] text-[var(--text-muted)]">بديل الحرف الأول</span>
              </div>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)]">حقول الإدخال (Form Inputs)</h2>
            <div className="flex flex-col gap-3">
              <TextField
                label="الاسم المعروض"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="أدخل اسمك الكامل..."
                maxLength={50}
                currentLength={testInput.length}
                helperText="يظهر هذا الاسم في حسابك ومنشوراتك لجميع المستخدمين."
              />

              <PasswordField
                label="كلمة المرور الآمنة"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
              />

              <SearchField placeholder="ابحث عن أصدقاء، وسوم، أو منتجات..." />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FORMATTERS */}
      {activeTab === 'formatters' && (
        <div className="flex flex-col gap-6">
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)]">
              أشهر التقويم العراقي المعتمدة (Iraqi Months)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {IRAQI_MONTHS.map((m, idx) => (
                <div
                  key={m}
                  className="p-2.5 rounded-xl bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)] flex items-center justify-between"
                >
                  <span>{m}</span>
                  <span className="text-[var(--text-muted)]">
                    {formatNumber(idx + 1, numeralSystem)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[var(--text)]">
              تنسيق العملة والأعداد المدمجة (IQD & Compact Numbers)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--surface-2)] flex flex-col gap-1">
                <span className="text-[var(--text-muted)]">سعر دينار عراقي (١٢٥ ألف):</span>
                <span className="text-base font-bold text-[var(--accent-text)]">
                  {formatPriceIQD(125000, numeralSystem)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] flex flex-col gap-1">
                <span className="text-[var(--text-muted)]">إعجابات مدمجة (١٥ ألف):</span>
                <span className="text-base font-bold text-[var(--text)]">
                  {formatCompactCount(15400, numeralSystem)} إعجاب
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] flex flex-col gap-1">
                <span className="text-[var(--text-muted)]">ملايين مدمجة (٣٫٢ مليون):</span>
                <span className="text-base font-bold text-[var(--text)]">
                  {formatCompactCount(3200000, numeralSystem)} مشاهدة
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] flex flex-col gap-1">
                <span className="text-[var(--text-muted)]">صيغ الوقت النسبي:</span>
                <span className="font-semibold text-[var(--text)]">
                  {formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000), undefined, numeralSystem)} ·{' '}
                  {formatRelativeTime(new Date(Date.now() - 2 * 3600 * 1000), undefined, numeralSystem)} ·{' '}
                  {formatRelativeTime(new Date(Date.now() - 3 * 86400 * 1000), undefined, numeralSystem)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LIVE PREVIEWS */}
      {activeTab === 'preview' && (
        <div className="flex flex-col gap-6">
          <h2 className="text-sm font-bold text-[var(--text)]">
            معاينة بطاقة منشور واقعية (Mobile Edge-to-Edge / Desktop Card)
          </h2>
          {posts[0] && <PostCard post={posts[0]} />}

          <h2 className="text-sm font-bold text-[var(--text)] mt-4">
            معاينة بطاقة منتج في السوق (Product Card)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.slice(0, 3).map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>

          <h2 className="text-sm font-bold text-[var(--text)] mt-4">
            معاينة سطر محادثة وفقاعات الرسائل (Chat Row & Bubbles)
          </h2>
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3">
            {conversations[0] && <ChatRow conversation={conversations[0]} onClick={() => {}} />}
            <DateChip label="اليوم — ١٥ تشرين الثاني" />
            {activeMessages.slice(0, 3).map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
