import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  Search,
  Bell,
  ChevronRight,
  Menu,
  Phone,
  Video,
  MoreVertical,
  Sparkles,
  Settings,
  Camera,
  SquarePen,
  User as UserIcon,
  Flag,
} from 'lucide-react';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { LogoMark } from '../ui/LogoMark';
import { formatNumber } from '../../lib/formatters';
import { resolveConversationPeer } from '../../lib/remediation';

export interface TopBarProps {
  title?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function TopBar({ title, onBack, rightAction }: TopBarProps) {
  const {
    currentRoute,
    setCurrentRoute,
    openCreate,
    currentUser,
    notifications,
    users,
    conversations,
    activeConversationId,
    openCallModal,
    openReportModal,
    setViewingUser,
    setIsMobileMenuOpen,
    setIsRecentChatsOpen,
    isBottomBarVisible,
    numeralSystem,
  } = useApp();
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;
  const unreadNotifDigits = formatNumber(unreadNotificationsCount, numeralSystem);

  const isDevMode = Boolean(import.meta.env.DEV);

  // Active chat partner details resolved dynamically via memberIds / peerId
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const convMemberIds = activeConv
    ? activeConv.memberIds ?? (activeConv.peerId ? [currentUser.id, activeConv.peerId] : [])
    : [];
  const convMembers = convMemberIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const resolvedPeer = activeConv
    ? resolveConversationPeer({
        viewerId: currentUser.id,
        isGroup: Boolean(activeConv.isGroup),
        memberUsers: convMembers,
        storedTitle: activeConv.title,
        storedAvatarUrl: activeConv.avatarUrl ?? '',
        storedIsOnline: Boolean(activeConv.isOnline),
      })
    : null;
  const peerUser = resolvedPeer?.peerId
    ? users.find((u) => u.id === resolvedPeer.peerId)
    : undefined;
  const fallbackPartner = users.find((u) => u.id !== currentUser.id) ?? currentUser;
  const activeChatPartner = peerUser ?? {
    ...fallbackPartner,
    id: resolvedPeer?.peerId ?? activeConv?.peerId ?? fallbackPartner.id,
    displayName: resolvedPeer?.title ?? activeConv?.title ?? fallbackPartner.displayName,
    avatarUrl: resolvedPeer?.avatarUrl ?? activeConv?.avatarUrl ?? '',
    kind: resolvedPeer?.isBot ? ('bot' as const) : undefined,
  };
  const isPeerOnline = resolvedPeer?.isOnline ?? activeConv?.isOnline ?? false;

  // 1. Root TopBar (for /home) - Visible below 768px only (md:hidden) and slides away on scroll down (S1 + P3)
  if (currentRoute === 'home') {
    return (
      <header
        data-testid="tw-topbar-root"
        style={{ transform: isBottomBarVisible ? 'translateY(0)' : 'translateY(-100%)' }}
        className="sticky top-0 z-20 h-[var(--header-h)] bg-[var(--bg)] border-b border-[var(--border)] px-3 flex items-center justify-between md:hidden transition-transform duration-200 motion-reduce:transition-none"
      >
        {/* Start side: Full menu drawer + Create + button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="tw-mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text)] active:scale-95 transition-transform"
            aria-label="القائمة الكاملة"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            data-testid="tw-home-create-button"
            onClick={() => openCreate('story')}
            className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text)] active:scale-95 transition-transform"
            aria-label="منشور جديد"
          >
            <Plus className="w-5 h-5 text-[var(--primary)] stroke-[2.5]" />
          </button>
        </div>

        {/* Center: Brand Mark & Logo (F15) */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="تواصل — العودة للأعلى"
          className="flex items-center gap-2 select-none"
        >
          <LogoMark size={28} />
          <span className="font-display font-bold text-xl tracking-tight text-[var(--text)]">
            تواصل
          </span>
        </button>

        {/* End side: Search & Notifications */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="tw-home-search-button"
            onClick={() => setCurrentRoute('explore')}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] active:scale-95 transition-transform"
            aria-label="بحث واستكشاف"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            data-testid="tw-home-notifications-button"
            onClick={() => setCurrentRoute('notifications')}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] active:scale-95 transition-transform"
            aria-label={
              unreadNotificationsCount > 0
                ? `الإشعارات، ${unreadNotifDigits} غير مقروءة`
                : 'الإشعارات'
            }
          >
            <span className="relative inline-flex">
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span
                  aria-hidden="true"
                  data-testid="tw-bell-unread-dot"
                  className="absolute -top-0.5 -end-0.5 w-[10px] h-[10px] rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg)]"
                />
              )}
            </span>
          </button>
        </div>
      </header>
    );
  }

  // 2. Chat thread TopBar (TB-CHAT)
  if (currentRoute === 'messages' && activeConversationId) {
    return (
      <header
        data-testid="tw-topbar-chat"
        className="sticky top-0 z-20 h-[var(--header-h)] bg-[var(--bg)] border-b border-[var(--border)] px-2 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              data-testid="tw-chat-back-button"
              onClick={onBack}
              className="p-2 rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)] active:scale-95"
              aria-label="رجوع"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!activeConv?.isGroup) {
                setViewingUser(activeChatPartner);
                setCurrentRoute('profile');
              }
            }}
            className="flex items-center gap-2 text-start"
          >
            <Avatar
              src={activeChatPartner.avatarUrl}
              name={activeChatPartner.displayName}
              size={36}
              isOnline={isPeerOnline}
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-[var(--text)]">
                  {activeChatPartner.displayName}
                </span>
                <VerifiedBadge kind={activeChatPartner.verifiedKind} size={14} />
              </div>
              <span
                className={`text-xs font-medium ${
                  isPeerOnline ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {resolvedPeer?.isBot ? 'بوت تفاعلي' : isPeerOnline ? 'متصل الآن' : 'غير متصل'}
              </span>
            </div>
          </button>
        </div>

        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => openCallModal(activeChatPartner, false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)]"
            aria-label="مكالمة صوتية"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => openCallModal(activeChatPartner, true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)]"
            aria-label="مكالمة فيديو"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setChatMenuOpen((v) => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="خيارات المحادثة"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {chatMenuOpen && (
            <div className="absolute end-0 top-10 w-44 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl py-1.5 z-30">
              {!activeConv?.isGroup && (
                <button
                  type="button"
                  onClick={() => {
                    setChatMenuOpen(false);
                    setViewingUser(activeChatPartner);
                    setCurrentRoute('profile');
                  }}
                  className="w-full px-3.5 py-2 text-start text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>عرض الملف الشخصي</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setChatMenuOpen(false);
                  openReportModal('user', activeChatPartner.displayName, activeChatPartner.id);
                }}
                className="w-full px-3.5 py-2 text-start text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>إبلاغ</span>
              </button>
            </div>
          )}
        </div>
      </header>
    );
  }

  // 3. Profile TopBar (TB-PROFILE) - Hidden from 768px up (md:hidden) and slides away on scroll down
  if (currentRoute === 'profile') {
    return (
      <header
        data-testid="tw-topbar-profile"
        style={{ transform: isBottomBarVisible ? 'translateY(0)' : 'translateY(-100%)' }}
        className="sticky top-0 z-20 h-[var(--header-h)] bg-[var(--bg)] border-b border-[var(--border)] px-3 flex items-center justify-between md:hidden transition-transform duration-200 motion-reduce:transition-none"
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="tw-mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text)] active:scale-95 transition-transform"
            aria-label="القائمة الكاملة"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => openCreate('story')}
            className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]"
            aria-label="منشور جديد"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex items-center gap-1 text-base font-bold text-[var(--text)]">
          <span dir="ltr">@{currentUser.username}</span>
          <VerifiedBadge kind={currentUser.verifiedKind} size={15} />
        </div>

        <button
          type="button"
          data-testid="tw-profile-settings-button"
          onClick={() => setCurrentRoute('settings')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text)] hover:bg-[var(--surface-2)]"
          aria-label="الإعدادات"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>
    );
  }

  // 4. Default Inner TopBar (TB-INNER / TB-TITLE)
  return (
    <header
      data-testid="tw-topbar-inner"
      className="sticky top-0 z-20 h-[var(--header-h)] bg-[var(--bg)] border-b border-[var(--border)] px-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)]"
            aria-label="رجوع"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        ) : (
          <button
            type="button"
            data-testid="tw-mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text)] md:hidden"
            aria-label="القائمة الكاملة"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-lg font-bold text-[var(--text)] font-display truncate">
          {title ?? getRouteTitle(currentRoute)}
        </h1>
      </div>

      <div className="flex items-center gap-1.5">
        {currentRoute === 'messages' && !activeConversationId && (
          <>
            <button
              type="button"
              data-testid="tw-messages-new-instant"
              onClick={() => openCreate('instants')}
              aria-label="لحظة جديدة"
              className="w-[44px] h-[44px] rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="button"
              data-testid="tw-messages-new-chat"
              onClick={() => setIsRecentChatsOpen(true)}
              aria-label="رسالة جديدة"
              className="w-[44px] h-[44px] rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center justify-center active:scale-95 transition-transform"
            >
              <SquarePen className="w-5 h-5" />
            </button>
          </>
        )}
        {rightAction}
        {isDevMode && currentRoute !== 'gallery' && (
          <button
            type="button"
            onClick={() => setCurrentRoute('gallery')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--primary-tint)] text-[var(--primary-text)] flex items-center gap-1"
            title="معرض التصميم والمكونات"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>نظام التصميم</span>
          </button>
        )}
      </div>
    </header>
  );
}

function getRouteTitle(route: string): string {
  switch (route) {
    case 'explore':
      return 'استكشاف';
    case 'reels':
      return 'ريلز تواصل';
    case 'video':
      return 'فيديو';
    case 'live':
      return 'البث المباشر';
    case 'messages':
      return 'المحادثات';
    case 'communities':
      return 'المجتمعات';
    case 'market':
      return 'سوق تواصل';
    case 'notifications':
      return 'الإشعارات';
    case 'wallet':
      return 'المحفظة الرقمية';
    case 'settings':
      return 'الإعدادات';
    case 'gallery':
      return 'دليل المكونات ونظام التصميم';
    case 'canvas':
      return 'تصميم ملفي';
    case 'admin':
      return 'الإدارة والرقابة';
    case 'saved':
      return 'المحفوظات';
    case 'auth':
      return 'تسجيل الدخول والحساب';
    default:
      return 'تواصل';
  }
}
