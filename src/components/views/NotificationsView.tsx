import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { SmartImage } from '../ui/SmartImage';
import { Heart, MessageCircle, UserPlus, ShoppingBag, CheckCheck, Bell } from 'lucide-react';
import { filterNotificationsByTab, type NotificationFilterTab } from '../../lib/remediation';
import { formatTimeSafe } from '../../lib/formatters';

export function NotificationsView() {
  const {
    notifications,
    markNotificationsRead,
    setViewingUser,
    setCurrentRoute,
    numeralSystem,
  } = useApp();
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');

  const filteredNotifs = filterNotificationsByTab(notifications, activeTab);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getBadgeIcon = (kind: string) => {
    switch (kind) {
      case 'like':
        return <Heart className="w-3 h-3 text-[var(--danger-fg)] fill-[var(--danger-fg)]" />;
      case 'comment':
        return <MessageCircle className="w-3 h-3 text-[var(--primary-fg)] fill-[var(--primary-fg)]" />;
      case 'order':
        return <ShoppingBag className="w-3 h-3 text-[var(--accent-fg)]" />;
      default:
        return <UserPlus className="w-3 h-3 text-[var(--primary-fg)]" />;
    }
  };

  const getBadgeColor = (kind: string) => {
    switch (kind) {
      case 'like':
        return 'bg-[var(--danger)]';
      case 'order':
        return 'bg-[var(--accent)]';
      default:
        return 'bg-[var(--primary)]';
    }
  };

  const handleNotificationClick = (notif: (typeof notifications)[number]) => {
    if (!notif.isRead) {
      void markNotificationsRead({ ids: [notif.id] });
    }
    if (notif.kind === 'order') {
      setCurrentRoute('market');
    } else if (notif.kind === 'follow') {
      setViewingUser(notif.actor);
      setCurrentRoute('profile');
    } else {
      setCurrentRoute('home');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col pb-[calc(var(--bar-h)+32px+env(safe-area-inset-bottom,0px))] md:pb-12 bg-[var(--surface)] min-h-[calc(100vh-var(--header-h))] border-x border-[var(--border)]">
      {/* Filter Tabs & Mark All Read */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)] select-none">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'likes', label: 'التفاعلات' },
            { id: 'orders', label: 'الطلبات' },
            { id: 'system', label: 'النظام' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as NotificationFilterTab)}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markNotificationsRead({ all: true })}
            className="h-8 px-2.5 rounded-lg text-[11px] font-bold text-[var(--primary-text)] hover:bg-[var(--primary-tint)] flex items-center gap-1 shrink-0 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تحديد الكل كمقروء</span>
          </button>
        )}
      </div>

      {/* Notifications Rows */}
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {filteredNotifs.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-2 text-[var(--text-muted)]">
            <Bell className="w-8 h-8 opacity-40" />
            <span className="text-sm font-semibold">لا توجد إشعارات في هذا التصنيف حالياً</span>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <button
              key={notif.id}
              type="button"
              onClick={() => handleNotificationClick(notif)}
              className={`w-full text-start p-3.5 px-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--surface-2)] transition-colors ${
                !notif.isRead ? 'bg-[var(--primary-tint)]/40' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar with type badge */}
                <div className="relative shrink-0">
                  <Avatar src={notif.actor.avatarUrl} name={notif.actor.displayName} size={44} />
                  <span
                    className={`absolute -bottom-1 -end-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-[var(--surface)] ${getBadgeColor(
                      notif.kind
                    )}`}
                  >
                    {getBadgeIcon(notif.kind)}
                  </span>
                </div>

                {/* Text & Time */}
                <div className="flex flex-col min-w-0">
                  <p className="text-xs text-[var(--text)] leading-relaxed">
                    <span className="font-bold text-[var(--text)] me-1">
                      {notif.actor.displayName}
                    </span>
                    <span>{notif.targetText}</span>
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {formatTimeSafe(notif.time, numeralSystem)}
                  </span>
                </div>
              </div>

              {/* End Thumbnail or Dot */}
              <div className="flex items-center gap-2 shrink-0">
                {notif.mediaThumbnailUrl && (
                  <SmartImage
                    src={notif.mediaThumbnailUrl}
                    alt="منشور"
                    containerClassName="w-10 h-10 rounded-lg"
                  />
                )}
                {!notif.isRead && (
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
