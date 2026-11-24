import React, { useEffect, useRef, useState } from 'react';
import { Home, Film, MessageCircle, Store, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { formatNumber } from '../../lib/formatters';
import {
  BOTTOM_BAR_DRAG_THRESHOLD_PX,
  clampBottomBarDragOffset,
  getBottomBarLeftCss,
  getBottomBarWidth,
  getBottomBarWidthCss,
  resolveBottomBarDrop,
} from '../../lib/bottomBarUtils';
import type { AppRoute } from '../../types';

type TabId = 'home' | 'reels' | 'chat' | 'market' | 'profile';

interface TabDef {
  id: TabId;
  route: AppRoute;
  label: string;
  Icon?: LucideIcon; // the profile tab renders the user's avatar instead of an icon
}

// All five tabs share ONE visual treatment. Order is from the start side (right in RTL).
const TABS: TabDef[] = [
  { id: 'home', route: 'home', label: 'الرئيسية', Icon: Home },
  { id: 'reels', route: 'reels', label: 'ريلز', Icon: Film },
  { id: 'chat', route: 'messages', label: 'المحادثات', Icon: MessageCircle },
  { id: 'market', route: 'market', label: 'السوق', Icon: Store },
  { id: 'profile', route: 'profile', label: 'الملف الشخصي' },
];

const LONG_PRESS_MS = 500;

export function BottomBar() {
  const {
    currentRoute,
    setCurrentRoute,
    handedness,
    setHandedness,
    currentUser,
    conversations,
    setIsRecentChatsOpen,
    isBottomBarVisible,
    numeralSystem,
  } = useApp();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const suppressNextClickRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    didDrag: boolean;
    lastDx: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  const handednessRef = useRef(handedness);
  handednessRef.current = handedness;

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (Math.hypot(dx, dy) >= BOTTOM_BAR_DRAG_THRESHOLD_PX) {
        clearPress();
      }

      if (!g.didDrag) {
        if (
          Math.abs(dx) >= BOTTOM_BAR_DRAG_THRESHOLD_PX &&
          Math.abs(dx) >= Math.abs(dy)
        ) {
          g.didDrag = true;
          setIsDragging(true);
        } else {
          return;
        }
      }

      g.lastDx = dx;
      const containerW =
        containerRef.current?.clientWidth ||
        (typeof document !== 'undefined' ? document.documentElement.clientWidth : 390) ||
        390;
      const barW = navRef.current?.offsetWidth || getBottomBarWidth(containerW);
      setDragOffsetX(
        clampBottomBarDragOffset(dx, handednessRef.current, containerW, barW)
      );
    };

    const finishGesture = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      gestureRef.current = null;

      if (g.didDrag) {
        const finalDx = e.clientX - g.startX;
        const durationMs = performance.now() - g.startTime;
        const current = handednessRef.current;
        const next = resolveBottomBarDrop(current, finalDx, durationMs);

        suppressNextClickRef.current = true;
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 80);

        if (next !== current) {
          setHandedness(next);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(12);
          }
        }
      }

      setIsDragging(false);
      setDragOffsetX(0);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', finishGesture);
    window.addEventListener('pointercancel', finishGesture);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishGesture);
      window.removeEventListener('pointercancel', finishGesture);
      clearPress();
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, [setHandedness]);

  // Routes where the bar is hidden (focused settings flow)
  if (currentRoute === 'settings') {
    return null;
  }

  const unreadChats = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Invisible shortcut kept from the spec: long-press the chat tab = recent chats sheet.
  const startChatPress = () => {
    longPressFired.current = false;
    clearPress();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setIsRecentChatsOpen(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    }, LONG_PRESS_MS);
  };

  const handleBarPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      didDrag: false,
      lastDx: 0,
    };
  };

  const handleTab = (tab: TabDef) => {
    if (tab.id === 'chat' && longPressFired.current) {
      longPressFired.current = false; // the long-press already handled this gesture
      return;
    }
    if (currentRoute === tab.route) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentRoute(tab.route);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  };

  return (
    <div
      ref={containerRef}
      aria-hidden={!isBottomBarVisible}
      className="fixed inset-x-0 pointer-events-none z-30 md:hidden transition-transform duration-200 ease-out motion-reduce:transition-none"
      style={{
        bottom: 'calc(16px + var(--sab))',
        height: '64px',
        transform: isBottomBarVisible ? 'translateY(0)' : 'translateY(calc(100% + 28px))',
      }}
    >
      <nav
        ref={navRef}
        data-testid="tw-bottombar"
        data-handedness={handedness}
        data-dragging={isDragging ? 'true' : 'false'}
        aria-label="شريط التنقل السفلي"
        onPointerDown={handleBarPointerDown}
        onClickCapture={(e) => {
          if (suppressNextClickRef.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressNextClickRef.current = false;
          }
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: getBottomBarLeftCss(handedness),
          height: '64px',
          width: getBottomBarWidthCss(),
          transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : undefined,
          touchAction: 'pan-y',
        }}
        className={`${
          isBottomBarVisible ? 'pointer-events-auto' : 'pointer-events-none'
        } rounded-[32px] bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-xl flex items-center px-[8px] select-none ${
          isDragging
            ? 'transition-none cursor-grabbing'
            : 'transition-[left,transform] duration-200 ease-out motion-reduce:transition-none cursor-grab'
        }`}
      >
      {/* Subtle swipe-to-dock indicator pill */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-[4px] left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-150 ${
          isDragging ? 'w-10 bg-[var(--primary)]' : 'w-7 bg-[var(--text-muted)]/35'
        }`}
      />

      {TABS.map((tab) => {
        const active = currentRoute === tab.route;
        const badge = tab.id === 'chat' ? unreadChats : 0;
        const badgeText = badge > 99 ? `${formatNumber(99, numeralSystem)}+` : formatNumber(badge, numeralSystem);
        const chatHandlers =
          tab.id === 'chat'
            ? {
                onPointerDown: startChatPress,
                onPointerUp: clearPress,
                onPointerLeave: clearPress,
                onPointerCancel: clearPress,
                onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
              }
            : {};

        return (
          <button
            key={tab.id}
            type="button"
            data-testid={`tw-bottombar-slot-${tab.id}`}
            aria-label={badge > 0 ? `${tab.label}، ${badgeText} غير مقروءة` : tab.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => handleTab(tab)}
            className="relative flex-1 h-[56px] flex items-center justify-center rounded-full active:scale-90 transition-transform"
            {...chatHandlers}
          >
            {tab.Icon ? (
              <span className="relative inline-flex">
                <tab.Icon
                  aria-hidden="true"
                  className={`w-[26px] h-[26px] transition-colors ${
                    active
                      ? 'text-[var(--primary)] stroke-[2.4]'
                      : 'text-[var(--text-muted)] stroke-[1.8]'
                  }`}
                />
                {badge > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-[9px] -end-[13px] min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-[11px] font-bold leading-none ring-2 ring-[var(--surface)] flex items-center justify-center"
                  >
                    {badgeText}
                  </span>
                )}
              </span>
            ) : (
              <span
                className={`rounded-full p-[2px] transition-all ${
                  active ? 'ring-2 ring-[var(--primary)]' : ''
                }`}
              >
                <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={28} />
              </span>
            )}
            {active && tab.Icon && (
              <span className="absolute bottom-[5px] w-1 h-1 rounded-full bg-[var(--primary)]" />
            )}
          </button>
        );
      })}
      </nav>
    </div>
  );
}
