import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  Compass,
  Film,
  Video,
  Radio,
  MessageCircle,
  Users,
  Store,
  Bell,
  Wallet,
  Bookmark,
  User as UserIcon,
  Palette,
  ShieldAlert,
  Sparkles,
  Plus,
  Settings,
  LogIn,
} from 'lucide-react';
import { LogoMark } from '../ui/LogoMark';
import { AppRoute } from '../../types';

export function SideRail() {
  const {
    currentRoute,
    setCurrentRoute,
    currentUser,
    conversations,
    notifications,
    openCreate,
  } = useApp();

  const unreadMessages = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  const isDevMode = Boolean(import.meta.env.DEV);
  const canAccessAdmin = currentUser.role === 'admin' || currentUser.role === 'moderator';

  const RAIL_ITEMS: { route: AppRoute; label: string; icon: React.ElementType; badge?: number }[] = [
    { route: 'home', label: 'الرئيسية', icon: Home },
    { route: 'explore', label: 'استكشاف', icon: Compass },
    { route: 'reels', label: 'ريلز', icon: Film },
    { route: 'video', label: 'فيديو', icon: Video },
    { route: 'live', label: 'مباشر', icon: Radio },
    { route: 'messages', label: 'المحادثات', icon: MessageCircle, badge: unreadMessages },
    { route: 'communities', label: 'المجتمعات', icon: Users },
    { route: 'market', label: 'السوق', icon: Store },
    { route: 'notifications', label: 'الإشعارات', icon: Bell, badge: unreadNotifications },
    { route: 'wallet', label: 'المحفظة', icon: Wallet },
    { route: 'saved', label: 'المحفوظات', icon: Bookmark },
    { route: 'profile', label: 'الملف الشخصي', icon: UserIcon },
    { route: 'canvas', label: 'تصميم ملفي', icon: Palette },
    ...(canAccessAdmin
      ? [{ route: 'admin' as AppRoute, label: 'الإدارة والرقابة والأمان', icon: ShieldAlert }]
      : []),
    ...(isDevMode
      ? [{ route: 'gallery' as AppRoute, label: 'نظام التصميم والمكونات', icon: Sparkles }]
      : []),
  ];

  return (
    <aside
      data-testid="tw-siderail"
      className="hidden md:flex xl:hidden flex-col items-center w-[72px] h-screen sticky top-0 bg-[var(--surface)] border-e border-[var(--border)] py-3 select-none shrink-0"
      aria-label="القائمة الجانبية اللوحية"
    >
      {/* Brand Icon (F15) */}
      <button
        type="button"
        onClick={() => setCurrentRoute('home')}
        className="w-11 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mb-3 shadow-xs active:scale-95 shrink-0"
        title="تواصل"
        aria-label="تواصل"
      >
        <LogoMark size={28} />
      </button>

      {/* Nav Icons (matching Sidebar routes, scrollable if compact viewport height) */}
      <nav className="flex flex-col items-center gap-1 flex-1 min-h-0 overflow-y-auto w-full px-2 scrollbar-none">
        {RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.route;

          return (
            <button
              key={item.route}
              type="button"
              data-testid={`tw-rail-nav-${item.route}`}
              onClick={() => setCurrentRoute(item.route)}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative w-11 h-9 rounded-xl flex items-center justify-center transition-colors active:scale-95 shrink-0 ${
                isActive
                  ? 'bg-[var(--primary-tint)] text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`}
            >
              <span className="relative inline-flex">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Pinned Bottom Actions */}
      <div className="pt-2 border-t border-[var(--border)] flex flex-col items-center gap-1.5 shrink-0 w-full">
        <button
          type="button"
          onClick={() => openCreate('post')}
          className="w-11 h-10 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shadow-sm active:scale-95"
          title="منشور جديد"
          aria-label="منشور جديد"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        <button
          type="button"
          data-testid="tw-rail-nav-auth"
          onClick={() => setCurrentRoute('auth')}
          title="تسجيل الدخول / الحساب"
          aria-label="تسجيل الدخول / الحساب"
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            currentRoute === 'auth'
              ? 'bg-[var(--primary-tint)] text-[var(--primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-2)]'
          }`}
        >
          <LogIn className="w-5 h-5" />
        </button>

        <button
          type="button"
          data-testid="tw-rail-nav-settings"
          onClick={() => setCurrentRoute('settings')}
          title="الإعدادات"
          aria-label="الإعدادات"
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            currentRoute === 'settings'
              ? 'bg-[var(--primary-tint)] text-[var(--primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
