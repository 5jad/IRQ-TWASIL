import React, { useRef } from 'react';
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
  Settings,
  LogIn,
  ShieldAlert,
  Sparkles,
  Plus,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../ui/Modal';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { LogoMark } from '../ui/LogoMark';
import { PWAInstallButton } from '../ui/PWAInstallButton';
import { formatNumber } from '../../lib/formatters';
import type { AppRoute } from '../../types';

export function MobileNavDrawer() {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const {
    isMobileMenuOpen,
    setIsMobileMenuOpen,
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
    { route: 'canvas', label: 'تصميم ملفي', icon: Palette },
    { route: 'settings', label: 'الإعدادات', icon: Settings },
    { route: 'auth', label: 'تسجيل الدخول / الحساب', icon: LogIn },
  ];

  const handleNavigate = (route: AppRoute) => {
    setIsMobileMenuOpen(false);
    setCurrentRoute(route);
  };

  return (
    <Modal
      isOpen={isMobileMenuOpen}
      onClose={() => setIsMobileMenuOpen(false)}
      title="القائمة الكاملة"
      testId="tw-mobile-nav-drawer"
      initialFocusRef={closeBtnRef}
      className="!p-0 !items-stretch !justify-start"
      contentClassName="!max-h-screen h-full !w-[min(320px,86vw)] max-w-[320px] bg-[var(--surface)] border-e border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => handleNavigate('home')}
          className="flex items-center gap-2.5 text-start p-1 rounded-xl"
        >
          <LogoMark size={30} />
          <div>
            <span className="font-display font-bold text-xl tracking-tight text-[var(--text)] block leading-tight">
              تواصل
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-medium block">
              كل العراق بمكان واحد
            </span>
          </div>
        </button>

        <button
          ref={closeBtnRef}
          type="button"
          onClick={() => setIsMobileMenuOpen(false)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label="إغلاق القائمة"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Navigation Links */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-1" aria-label="قائمة التنقل الكاملة">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.route;

          return (
            <button
              key={item.route}
              type="button"
              data-testid={`tw-drawer-nav-${item.route}`}
              onClick={() => handleNavigate(item.route)}
              className={`relative min-h-[var(--tap)] px-3 rounded-xl flex items-center justify-between text-sm font-semibold transition-colors shrink-0 ${
                isActive
                  ? 'bg-[var(--primary-tint)] text-[var(--primary-text)]'
                  : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                {isActive && (
                  <span className="absolute start-0 top-2 bottom-2 w-1 rounded-e-full bg-[var(--primary)]" />
                )}
                <Icon
                  className={`w-5 h-5 shrink-0 ${
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

        {canAccessAdmin && (
          <button
            type="button"
            data-testid="tw-drawer-nav-admin"
            onClick={() => handleNavigate('admin')}
            className={`min-h-[var(--tap)] px-3 mt-1 rounded-xl flex items-center gap-3 text-sm font-semibold shrink-0 ${
              currentRoute === 'admin'
                ? 'bg-[var(--primary-tint)] text-[var(--primary-text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <ShieldAlert className="w-5 h-5 text-[var(--warning)] shrink-0" />
            <span>الإدارة والرقابة والأمان</span>
          </button>
        )}

        {isDevMode && (
          <button
            type="button"
            data-testid="tw-drawer-nav-gallery"
            onClick={() => handleNavigate('gallery')}
            className={`min-h-[var(--tap)] px-3 mt-1 rounded-xl flex items-center gap-3 text-sm font-semibold shrink-0 ${
              currentRoute === 'gallery'
                ? 'bg-[var(--primary-tint)] text-[var(--primary-text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <Sparkles className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <span>نظام التصميم والمكونات</span>
          </button>
        )}
      </nav>

      {/* Footer: New Post + User Summary */}
      <div className="p-3 border-t border-[var(--border)] flex flex-col gap-2 shrink-0">
        <PWAInstallButton compact />

        {serverOnline && !isAuthenticated && (
          <button
            type="button"
            data-testid="tw-drawer-login-btn"
            onClick={() => handleNavigate('auth')}
            className="w-full h-10 rounded-xl bg-[var(--primary-tint)] text-[var(--primary-text)] border border-[var(--primary)]/30 font-bold text-xs flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setIsMobileMenuOpen(false);
            openCreate('post');
          }}
          className="w-full h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-semibold text-sm shadow-xs hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>منشور جديد</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate(serverOnline && !isAuthenticated ? 'auth' : 'profile')}
          className="flex items-center gap-2.5 p-2 rounded-2xl hover:bg-[var(--surface-2)] text-start transition-colors"
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
      </div>
    </Modal>
  );
}
