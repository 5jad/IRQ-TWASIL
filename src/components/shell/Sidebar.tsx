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
  User as UserIcon,
  Plus,
  Settings,
  Sparkles,
  ShieldAlert,
  Palette,
  LogIn,
  Bookmark,
} from 'lucide-react';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { LogoMark } from '../ui/LogoMark';
import { formatNumber } from '../../lib/formatters';
import { AppRoute } from '../../types';

export function Sidebar() {
  const {
    currentRoute,
    setCurrentRoute,
    currentUser,
    isAuthenticated,
    serverOnline,
    conversations,
    notifications,
    openCreate,
    numeralSystem,
  } = useApp();

  const unreadMessages = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  const isDevMode = Boolean(import.meta.env.DEV);
  const canAccessAdmin = currentUser.role === 'admin' || currentUser.role === 'moderator';

  const NAV_ITEMS: { route: AppRoute; label: string; icon: React.ElementType; badge?: number }[] = [
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
  ];

  return (
    <aside
      className="hidden xl:flex flex-col w-[264px] h-screen sticky top-0 bg-[var(--surface)] border-e border-[var(--border)] px-4 py-4 select-none shrink-0"
      aria-label="القائمة الجانبية الرئيسية"
    >
      {/* Brand Header */}
      <button
        type="button"
        onClick={() => setCurrentRoute('home')}
        className="w-full text-start flex items-center gap-3 px-2 mb-3 select-none shrink-0"
      >
        <LogoMark size={34} />
        <div>
          <span className="font-display font-bold text-2xl tracking-tight text-[var(--text)] leading-tight block">
            تواصل
          </span>
          <span className="block text-[11px] text-[var(--text-muted)] font-medium">
            كل العراق بمكان واحد
          </span>
        </div>
      </button>

      {/* Nav List (Scrollable if needed, compact height so all items fit at 1366x768 - P4) */}
      <nav className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto pe-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.route;

          return (
            <button
              key={item.route}
              type="button"
              onClick={() => setCurrentRoute(item.route)}
              className={`relative h-9 px-3 rounded-xl flex items-center justify-between text-sm font-semibold transition-colors duration-150 active:scale-[0.98] shrink-0 ${
                isActive
                  ? 'bg-[var(--primary-tint)] text-[var(--primary-text)]'
                  : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                {isActive && (
                  <span className="absolute start-0 top-1.5 bottom-1.5 w-1 rounded-e-full bg-[var(--primary)]" />
                )}
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive ? 'text-[var(--primary)] stroke-[2.4]' : 'text-[var(--text-muted)]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && item.badge > 0 ? (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold flex items-center justify-center shrink-0">
                  {item.badge > 99
                    ? `${formatNumber(99, numeralSystem)}+`
                    : formatNumber(item.badge, numeralSystem)}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Visual separator between primary navigation and utility shortcuts */}
        <div className="my-1.5 border-t border-[var(--border)]" />

        {/* Canvas Designer Shortcut (User feature, renamed to "تصميم ملفي" - F9) */}
        <button
          type="button"
          onClick={() => setCurrentRoute('canvas')}
          className={`h-9 px-3 mt-0.5 rounded-xl flex items-center gap-3 text-sm font-semibold shrink-0 ${
            currentRoute === 'canvas'
              ? 'bg-[var(--primary-tint)] text-[var(--primary-text)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
          }`}
        >
          <Palette className="w-[18px] h-[18px] text-[var(--accent)] shrink-0" />
          <span>تصميم ملفي</span>
        </button>

        {/* Admin & Moderation Shortcut (Role gated for moderator/admin only - F9) */}
        {canAccessAdmin && (
          <button
            type="button"
            onClick={() => setCurrentRoute('admin')}
            className={`h-9 px-3 mt-0.5 rounded-xl flex items-center gap-3 text-sm font-semibold shrink-0 ${
              currentRoute === 'admin'
                ? 'bg-[var(--primary-tint)] text-[var(--primary-text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <ShieldAlert className="w-[18px] h-[18px] text-[var(--warning)] shrink-0" />
            <span>الإدارة والرقابة والأمان</span>
          </button>
        )}

        {/* Gallery / Design System Shortcut (Developer only - F9) */}
        {isDevMode && (
          <button
            type="button"
            onClick={() => setCurrentRoute('gallery')}
            className={`h-9 px-3 mt-0.5 rounded-xl flex items-center gap-3 text-sm font-semibold shrink-0 ${
              currentRoute === 'gallery'
                ? 'bg-[var(--primary-tint)] text-[var(--primary-text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <Sparkles className="w-[18px] h-[18px] text-[var(--accent)] shrink-0" />
            <span>نظام التصميم والمكونات</span>
          </button>
        )}
      </nav>

      {/* Pinned Bottom Shell Controls (Never cut off at 1366x768 or 1440x900 - F8 & P4) */}
      <div className="pt-2.5 border-t border-[var(--border)] flex flex-col gap-2 shrink-0" data-testid="tw-sidebar-footer">
        {serverOnline && !isAuthenticated && (
          <button
            type="button"
            data-testid="tw-sidebar-login-btn"
            onClick={() => setCurrentRoute('auth')}
            className="w-full h-9 rounded-xl bg-[var(--primary-tint)] text-[var(--primary-text)] border border-[var(--primary)]/30 font-bold text-xs hover:brightness-95 transition-all flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول</span>
          </button>
        )}

        {/* New Post Button */}
        <button
          type="button"
          onClick={() => openCreate('post')}
          className="w-full h-10 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-semibold text-sm shadow-sm hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>منشور جديد</span>
        </button>

        {/* User Account / Profile Entry */}
        <div
          data-testid="tw-sidebar-account-row"
          className={`flex items-center justify-between p-2 rounded-2xl transition-colors ${
            currentRoute === 'profile'
              ? 'bg-[var(--primary-tint)]'
              : 'hover:bg-[var(--surface-2)]'
          }`}
        >
          <button
            type="button"
            onClick={() => setCurrentRoute(serverOnline && !isAuthenticated ? 'auth' : 'profile')}
            className="flex-1 text-start flex items-center gap-2.5 overflow-hidden min-w-0"
          >
            <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={36} />
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-[var(--text)] truncate">
                  {currentUser.displayName}
                </span>
                <VerifiedBadge kind={currentUser.verifiedKind} size={14} />
              </div>
              <span className="text-[11px] text-[var(--text-muted)] truncate" dir="ltr">
                @{currentUser.username}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCurrentRoute('settings')}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] shrink-0"
            title="الإعدادات"
            aria-label="الإعدادات"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
