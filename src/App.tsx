/**
 * IRQ تواصل — Main Application Entry Point
 * Implements real routing with react-router-dom v7 (F3),
 * offline resilience banner (F1), and desktop shell adaptations (F8).
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar } from './components/shell/TopBar';
import { BottomBar } from './components/shell/BottomBar';
import { Sidebar } from './components/shell/Sidebar';
import { SideRail } from './components/shell/SideRail';
import { MobileNavDrawer } from './components/shell/MobileNavDrawer';
import { RightPanel } from './components/shell/RightPanel';
import { HomeView } from './components/views/HomeView';
import { PostCard } from './components/feed/PostCard';
import { RecentChatsSheet } from './components/modals/RecentChatsSheet';
import { GlobalComposerModal } from './components/modals/GlobalComposerModal';
import { AuthModal } from './components/modals/AuthModal';
import { ReportModal } from './components/modals/ReportModal';
import { ShareModal } from './components/modals/ShareModal';
import { CallModal } from './components/modals/CallModal';
import { PostCommentsSheet } from './components/modals/PostCommentsSheet';
import { WifiOff, RefreshCw, ShieldX } from 'lucide-react';
import { AppRoute, Post } from './types';
import { isCapacitorNative } from './lib/runtimeUrl';
import { registerAndroidBackButton, syncAndroidStatusBar } from './lib/nativeAndroid';

// Lazy-loaded routes (P2)
const ExploreView = lazy(() =>
  import('./components/views/ExploreView').then((m) => ({ default: m.ExploreView }))
);
const MessagesView = lazy(() =>
  import('./components/views/MessagesView').then((m) => ({ default: m.MessagesView }))
);
const MarketView = lazy(() =>
  import('./components/views/MarketView').then((m) => ({ default: m.MarketView }))
);
const ProfileView = lazy(() =>
  import('./components/views/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const SettingsView = lazy(() =>
  import('./components/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const NotificationsView = lazy(() =>
  import('./components/views/NotificationsView').then((m) => ({ default: m.NotificationsView }))
);
const AuthView = lazy(() =>
  import('./components/views/AuthView').then((m) => ({ default: m.AuthView }))
);
const SavedView = lazy(() =>
  import('./components/views/SavedView').then((m) => ({ default: m.SavedView }))
);
const ReelsView = lazy(() =>
  import('./components/views/ReelsView').then((m) => ({ default: m.ReelsView }))
);
const CommunitiesView = lazy(() =>
  import('./components/views/CommunitiesView').then((m) => ({ default: m.CommunitiesView }))
);
const WalletView = lazy(() =>
  import('./components/views/WalletView').then((m) => ({ default: m.WalletView }))
);
const CanvasEditorView = lazy(() =>
  import('./components/views/CanvasEditorView').then((m) => ({ default: m.CanvasEditorView }))
);
const AdminView = lazy(() =>
  import('./components/views/AdminView').then((m) => ({ default: m.AdminView }))
);
const ComponentGallery = lazy(() =>
  import('./components/gallery/ComponentGallery').then((m) => ({ default: m.ComponentGallery }))
);
const CreateView = lazy(() =>
  import('./components/views/CreateView').then((m) => ({ default: m.CreateView }))
);

// Lazy-loaded heavy modals (P2)
const ProductDetailModal = lazy(() =>
  import('./components/modals/ProductDetailModal').then((m) => ({ default: m.ProductDetailModal }))
);
const CreateCommunityModal = lazy(() =>
  import('./components/modals/CreateCommunityModal').then((m) => ({ default: m.CreateCommunityModal }))
);
const LiveStreamViewerModal = lazy(() =>
  import('./components/modals/LiveStreamViewerModal').then((m) => ({ default: m.LiveStreamViewerModal }))
);
const StoryViewerModal = lazy(() =>
  import('./components/modals/StoryViewerModal').then((m) => ({ default: m.StoryViewerModal }))
);

function RouteSkeletonFallback() {
  return (
    <div
      data-testid="tw-route-skeleton"
      className="w-full max-w-3xl mx-auto p-4 flex flex-col gap-4 animate-pulse"
      aria-busy="true"
      aria-label="جارٍ التحميل"
    >
      <div className="h-28 rounded-3xl bg-[var(--surface-2)] border border-[var(--border)]" />
      <div className="h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-36 rounded-2xl bg-[var(--surface)] border border-[var(--border)]" />
        <div className="h-36 rounded-2xl bg-[var(--surface)] border border-[var(--border)]" />
      </div>
    </div>
  );
}

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode; routeKey: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; routeKey: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { routeKey: string }) {
    if (prevProps.routeKey !== this.props.routeKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 my-auto text-center gap-3 min-h-[40vh]">
          <p className="text-sm font-bold text-[var(--text)]">تعذّر تحميل هذه الصفحة</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MessagesRouteWrapper() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { markConversationRead } = useApp();

  useEffect(() => {
    if (conversationId) {
      markConversationRead(conversationId);
    }
  }, [conversationId, markConversationRead]);

  return <MessagesView />;
}

function AdminRouteWrapper() {
  const { currentUser } = useApp();
  const canAccess = currentUser.role === 'admin' || currentUser.role === 'moderator';

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-8 my-auto text-center gap-4 min-h-[50vh]">
        <div className="w-16 h-16 rounded-full bg-[var(--danger-tint)] text-[var(--danger)] flex items-center justify-center">
          <ShieldX className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text)]">غير مصرّح بالدخول</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm leading-relaxed">
          هذه الصفحة مخصصة للمشرفين وإدارة المنصة فقط. ليس لديك الصلاحية الكافية لعرض لوحة الرقابة.
        </p>
      </div>
    );
  }

  return <AdminView />;
}

function GalleryRouteWrapper() {
  const isDevMode = Boolean(import.meta.env.DEV);

  if (!isDevMode) {
    return <Navigate to="/" replace />;
  }

  return <ComponentGallery />;
}

function SinglePostRouteWrapper() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { posts, fetchSinglePost } = useApp();
  const existingPost = posts.find((p) => p.id === postId);
  const [fetchedPost, setFetchedPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(postId && !existingPost));

  useEffect(() => {
    if (!postId || existingPost) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void fetchSinglePost(postId).then((res) => {
      if (!cancelled) {
        setFetchedPost(res);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [postId, existingPost, fetchSinglePost]);

  const post = existingPost ?? (fetchedPost?.id === postId ? fetchedPost : null);

  if (isLoading) {
    return <RouteSkeletonFallback />;
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center p-8 my-auto text-center gap-3 min-h-[50vh]">
        <p className="text-base font-bold text-[var(--text)]">المنشور غير موجود أو تم حذفه</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="w-full py-2 pb-24">
      <PostCard post={post} />
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    theme,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isRecentChatsOpen,
    setIsRecentChatsOpen,
    isComposerOpen,
    setIsComposerOpen,
    currentRoute,
    activeConversationId,
    setActiveConversationId,
    viewingUser,
    setViewingUser,
    isBottomBarVisible,
    setIsBottomBarVisible,
    isAuthModalOpen,
    setIsAuthModalOpen,
    reportModalData,
    closeReportModal,
    shareModalData,
    closeShareModal,
    callModalData,
    closeCallModal,
    activeStoryUser,
    closeStoryViewer,
    activeProductDetail,
    setActiveProductDetail,
    isCreateCommunityOpen,
    setIsCreateCommunityOpen,
    activeLiveStream,
    setActiveLiveStream,
    storyToast,
    undoLastStory,
    dismissStoryToast,
    appToast,
    dismissAppToast,
  } = useApp();

  // Offline detection banner (F1)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  });

  // Service worker update toast (F1)
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // SW update listener (skip inside Capacitor native shell)
    if (!isCapacitorNative() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setHasUpdate(true);
              }
            });
          }
        });
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    syncAndroidStatusBar(theme);
  }, [theme]);

  useEffect(() => {
    return registerAndroidBackButton(() => {
      if (activeStoryUser) {
        closeStoryViewer();
        return true;
      }
      if (activeLiveStream) {
        setActiveLiveStream(null);
        return true;
      }
      if (callModalData.isOpen) {
        closeCallModal();
        return true;
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        return true;
      }
      if (isRecentChatsOpen) {
        setIsRecentChatsOpen(false);
        return true;
      }
      if (isComposerOpen) {
        setIsComposerOpen(false);
        return true;
      }
      if (isAuthModalOpen) {
        setIsAuthModalOpen(false);
        return true;
      }
      if (reportModalData.isOpen) {
        closeReportModal();
        return true;
      }
      if (shareModalData.isOpen) {
        closeShareModal();
        return true;
      }
      if (activeProductDetail) {
        setActiveProductDetail(null);
        return true;
      }
      if (isCreateCommunityOpen) {
        setIsCreateCommunityOpen(false);
        return true;
      }
      if (currentRoute === 'messages' && activeConversationId) {
        setActiveConversationId(null);
        navigate('/messages');
        return true;
      }
      if (currentRoute === 'profile' && viewingUser) {
        setViewingUser(null);
        return true;
      }
      if (location.pathname !== '/') {
        navigate(-1);
        return true;
      }
      return false;
    });
  }, [
    activeConversationId,
    activeLiveStream,
    activeProductDetail,
    activeStoryUser,
    callModalData.isOpen,
    closeCallModal,
    closeReportModal,
    closeShareModal,
    closeStoryViewer,
    currentRoute,
    isAuthModalOpen,
    isComposerOpen,
    isCreateCommunityOpen,
    isMobileMenuOpen,
    isRecentChatsOpen,
    location.pathname,
    navigate,
    reportModalData.isOpen,
    setActiveConversationId,
    setActiveLiveStream,
    setActiveProductDetail,
    setIsAuthModalOpen,
    setIsComposerOpen,
    setIsCreateCommunityOpen,
    setIsMobileMenuOpen,
    setIsRecentChatsOpen,
    setViewingUser,
    shareModalData.isOpen,
    viewingUser,
  ]);

  const handleUpdateApp = () => {
    if (waitingWorker && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          window.location.reload();
        },
        { once: true }
      );
      waitingWorker.postMessage('SKIP_WAITING');
    } else {
      window.location.reload();
    }
  };

  // Scroll listener to hide/show mobile bottom bar on scroll
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let accumulatedDown = 0;
    let accumulatedUp = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;

      if (diff > 0) {
        accumulatedDown += diff;
        accumulatedUp = 0;
        if (accumulatedDown > 48) {
          setIsBottomBarVisible(false);
        }
      } else if (diff < 0) {
        accumulatedUp += Math.abs(diff);
        accumulatedDown = 0;
        if (accumulatedUp > 24 || currentScrollY <= 20) {
          setIsBottomBarVisible(true);
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [setIsBottomBarVisible]);

  // Reset chrome visibility when navigating to a new route
  useEffect(() => {
    setIsBottomBarVisible(true);
  }, [currentRoute, setIsBottomBarVisible]);

  // Sync top chrome & feed filter strip offsets on scroll (S1)
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--chrome-top', isBottomBarVisible ? 'var(--header-h)' : '0px');   // profile tabs stay pinned
    root.setProperty('--strip-top', isBottomBarVisible ? 'var(--header-h)' : '-80px');  // feed filter strip slides away
  }, [isBottomBarVisible]);

  // Handle back button for inner pages & history
  const handleBack = () => {
    if (currentRoute === 'messages' && activeConversationId) {
      setActiveConversationId(null);
      navigate('/messages');
    } else if (currentRoute === 'profile' && viewingUser) {
      setViewingUser(null);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const isCreateRoute = currentRoute === 'create';

  const isWideView =
    currentRoute === 'canvas' ||
    currentRoute === 'gallery' ||
    currentRoute === 'admin' ||
    currentRoute === 'communities' ||
    currentRoute === 'market' ||
    currentRoute === 'explore' ||
    currentRoute === 'auth' ||
    currentRoute === 'saved';

  return (
    <div
      className={`min-h-[100dvh] flex justify-center selection:bg-[var(--primary)] selection:text-[var(--primary-fg)] ${
        isCreateRoute ? 'bg-[var(--cam-bg)] text-[var(--cam-text)]' : 'bg-[var(--bg)] text-[var(--text)]'
      }`}
    >
      {/* 1. Desktop 264px Sidebar (>= 1280px) & Tablet 72px SideRail (768px..1279px) */}
      {!isCreateRoute && <Sidebar />}
      {!isCreateRoute && <SideRail />}

      {/* 2. Center Content Column (BottomBar + TopBar below 768px; SideRail 768..1279px; Sidebar >= 1280px) */}
      <main
        className={`flex-1 min-w-0 w-full min-h-[100dvh] flex flex-col relative ${
          isCreateRoute
            ? 'bg-[var(--cam-bg)]'
            : `${isWideView ? 'max-w-5xl' : 'max-w-[680px]'} border-e border-[var(--border)] bg-[var(--bg)]`
        }`}
      >
        {/* TopBar on mobile and inner pages */}
        {!isCreateRoute && (
          <TopBar
            onBack={
              (currentRoute === 'messages' && activeConversationId) ||
              (currentRoute === 'profile' && viewingUser) ||
              location.pathname.startsWith('/post/') ||
              currentRoute === 'settings' ||
              currentRoute === 'gallery' ||
              currentRoute === 'canvas' ||
              currentRoute === 'admin' ||
              currentRoute === 'communities' ||
              currentRoute === 'wallet' ||
              currentRoute === 'auth' ||
              currentRoute === 'saved'
                ? handleBack
                : undefined
            }
          />
        )}

        {/* Real Offline Banner (F1) */}
        {!isOnline && (
          <div
            data-testid="tw-offline-banner"
            className={`h-[36px] bg-[var(--warning-tint)] border-b border-[var(--warning)]/30 text-[var(--warning)] px-4 flex items-center justify-center gap-2 text-xs font-bold sticky top-[var(--header-h)] ${
              currentRoute === 'home' || currentRoute === 'profile' ? 'md:top-0' : ''
            } z-10`}
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>ما كو إنترنت، تشوف آخر ما انحفظ</span>
          </div>
        )}

        {/* Update Ready Toast (F1) */}
        {hasUpdate && (
          <div
            data-testid="tw-update-toast"
            className="fixed bottom-[calc(var(--bar-h)+24px)] inset-x-4 max-w-sm mx-auto z-40 bg-[var(--surface)] text-[var(--text)] p-3 rounded-2xl shadow-xl border border-[var(--primary)] flex items-center justify-between gap-3 animate-in slide-in-from-bottom"
          >
            <span className="text-xs font-bold">يوجد إصدار جديد، تحديث</span>
            <button
              type="button"
              onClick={handleUpdateApp}
              className="px-3 py-1 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </button>
          </div>
        )}

        {/* View Component via Real Routing (F3) & Lazy Chunks (P2) */}
        <div className="flex-1 flex flex-col">
          <RouteErrorBoundary routeKey={currentRoute}>
            <Suspense fallback={<RouteSkeletonFallback />}>
              <Routes>
                <Route path="/" element={<HomeView />} />
                <Route path="/home" element={<HomeView />} />
                <Route path="/explore" element={<ExploreView />} />
                <Route path="/reels" element={<ReelsView />} />
                <Route path="/video" element={<ReelsView />} />
                <Route path="/live" element={<ReelsView />} />
                <Route path="/messages" element={<MessagesView />} />
                <Route path="/messages/:conversationId" element={<MessagesRouteWrapper />} />
                <Route path="/market" element={<MarketView />} />
                <Route path="/wallet" element={<WalletView />} />
                <Route path="/profile" element={<ProfileView />} />
                <Route path="/u/me" element={<ProfileView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/settings/:tab" element={<SettingsView />} />
                <Route path="/canvas" element={<CanvasEditorView />} />
                <Route path="/communities" element={<CommunitiesView />} />
                <Route path="/notifications" element={<NotificationsView />} />
                <Route path="/auth" element={<AuthView />} />
                <Route path="/saved" element={<SavedView />} />
                <Route path="/create" element={<CreateView />} />
                <Route path="/post/:postId" element={<SinglePostRouteWrapper />} />
                <Route path="/admin" element={<AdminRouteWrapper />} />
                <Route path="/gallery" element={<GalleryRouteWrapper />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </div>

        {/* Global App Toast (API feedback / Bot callback answer) */}
        {appToast && !isCreateRoute && (
          <div
            data-testid="tw-app-toast"
            role="status"
            className={`fixed bottom-[calc(var(--bar-h)+72px)] inset-x-4 max-w-sm mx-auto z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center justify-between gap-3 bg-[var(--surface)] text-[var(--text)] ${
              appToast.tone === 'error'
                ? 'border-[var(--danger)]'
                : appToast.tone === 'success'
                ? 'border-[var(--success)]'
                : 'border-[var(--primary)]'
            }`}
          >
            <span className="text-xs font-bold leading-snug">{appToast.message}</span>
            <button
              type="button"
              onClick={dismissAppToast}
              className="text-xs text-[var(--text-muted)] px-1.5 py-1 shrink-0"
              aria-label="إغلاق التنبيه"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Story Published Toast with Undo */}
        {storyToast && !isCreateRoute && (
          <div
            data-testid="tw-story-toast"
            role="status"
            className="fixed bottom-[calc(var(--bar-h)+24px)] inset-x-4 max-w-sm mx-auto z-40 bg-[var(--surface)] text-[var(--text)] px-4 py-3 rounded-2xl shadow-xl border border-[var(--primary)] flex items-center justify-between gap-3"
          >
            <span className="text-xs font-bold">{storyToast.message}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="tw-story-toast-undo"
                onClick={undoLastStory}
                className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold active:scale-95"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={dismissStoryToast}
                className="text-xs text-[var(--text-muted)] px-1.5 py-1"
                aria-label="إغلاق الإشعار"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* Floating Glass BottomBar is mounted at root shell level below */}
      </main>

      {/* 4. Desktop 340px Right Panel (>= 1024px, hidden on wide-tooling views) */}
      {!isWideView && !isCreateRoute && <RightPanel />}

      {/* Floating Glass BottomBar (Mobile < 768px) — mounted outside <main> for identical geometry on all routes */}
      {!isCreateRoute && <BottomBar />}

      {/* Global Modals & Quick Sheets */}
      <MobileNavDrawer />
      <RecentChatsSheet />
      <GlobalComposerModal />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <ReportModal
        isOpen={reportModalData.isOpen}
        onClose={closeReportModal}
        targetType={reportModalData.targetType}
        targetTitle={reportModalData.targetTitle}
        targetId={reportModalData.targetId}
      />
      <ShareModal
        isOpen={shareModalData.isOpen}
        onClose={closeShareModal}
        title={shareModalData.title}
        url={shareModalData.url}
      />
      <CallModal
        isOpen={callModalData.isOpen}
        onClose={closeCallModal}
        user={callModalData.user}
        isVideoCall={callModalData.isVideoCall}
      />
      {activeStoryUser && (
        <Suspense fallback={null}>
          <StoryViewerModal
            isOpen={Boolean(activeStoryUser)}
            onClose={closeStoryViewer}
            user={activeStoryUser}
          />
        </Suspense>
      )}
      <PostCommentsSheet />
      {Boolean(activeProductDetail) && (
        <Suspense fallback={null}>
          <ProductDetailModal />
        </Suspense>
      )}
      {isCreateCommunityOpen && (
        <Suspense fallback={null}>
          <CreateCommunityModal />
        </Suspense>
      )}
      {Boolean(activeLiveStream) && (
        <Suspense fallback={null}>
          <LiveStreamViewerModal />
        </Suspense>
      )}
    </div>
  );
}

function deriveRouteFromPath(path: string): AppRoute {
  if (path === '/' || path === '/home') return 'home';
  if (path === '/explore') return 'explore';
  if (path.startsWith('/reels') || path === '/video' || path === '/live') return 'reels';
  if (path.startsWith('/messages')) return 'messages';
  if (path === '/market') return 'market';
  if (path === '/wallet') return 'wallet';
  if (path === '/profile' || path === '/u/me') return 'profile';
  if (path.startsWith('/settings')) return 'settings';
  if (path === '/canvas') return 'canvas';
  if (path === '/communities') return 'communities';
  if (path === '/notifications') return 'notifications';
  if (path === '/admin') return 'admin';
  if (path === '/gallery') return 'gallery';
  if (path === '/auth') return 'auth';
  if (path === '/saved') return 'saved';
  if (path.startsWith('/post/')) return 'home';
  if (path.startsWith('/create')) return 'create';
  return 'home';
}

function deriveConversationFromPath(path: string): string | null {
  const match = path.match(/^\/messages\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]!) : null;
}

function RouterBridge({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const controlledRoute = deriveRouteFromPath(location.pathname);
  const controlledConversationId = deriveConversationFromPath(location.pathname);

  const handleRouteChange = (route: AppRoute) => {
    switch (route) {
      case 'home':
        navigate('/');
        break;
      case 'profile':
        navigate('/profile');
        break;
      default:
        navigate(`/${route}`);
        break;
    }
  };

  const handleConversationChange = (id: string | null) => {
    if (id) {
      navigate(`/messages/${id}`);
    } else if (location.pathname.startsWith('/messages')) {
      navigate('/messages');
    }
  };

  return (
    <AppProvider
      controlledRoute={controlledRoute}
      controlledConversationId={controlledConversationId}
      onRouteChange={handleRouteChange}
      onConversationChange={handleConversationChange}
      onCreateOpen={(mode = 'story') => navigate(`/create?mode=${mode}`)}
    >
      {children}
    </AppProvider>
  );
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center p-6 text-center gap-4"
        >
          <p className="text-base font-bold">حدث خطأ غير متوقع أثناء عرض الصفحة</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-sm font-bold"
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <RouterBridge>
          <AppShell />
        </RouterBridge>
      </BrowserRouter>
    </RootErrorBoundary>
  );
}
