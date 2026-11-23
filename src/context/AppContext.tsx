import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AppNotification,
  AppRoute,
  ChatConversation,
  ChatMessage,
  CreateMode,
  Product,
  StoryItem,
  User,
  UserSettings,
} from '../types';
import {
  emptyStoryStorage,
  filterActiveMoments,
  filterActiveStories,
  pruneStoryStorage,
  readStoryStorage,
  writeMomentsStorage,
  writeStoryStorage,
} from '../lib/storyUtils';
import { ProfileCanvasConfig, validateCanvasJson } from '../lib/canvasSchema';
import {
  ApiClientError,
  BootstrapResponse,
  apiFetch,
  getStoredSessionToken,
  setStoredSessionToken,
  uploadMediaSource,
} from '../lib/api';
import { isCrossOriginApi, resolveApiUrl } from '../lib/runtimeUrl';
import {
  applyDeltaConversationUnreads,
  inferChatMediaKind,
  mergeIncomingMessage,
  normalizeMediaMime,
} from '../lib/apiHelpers';
import { findDirectConversation } from '../lib/visibility';
import {
  AppContextType,
  GUEST_USER,
  SendMessageOptions,
  UpdateProfileMediaOptions,
  makeClientId,
  normalizeUserRecord,
  readStoredCanvas,
  writeStoredCanvas,
} from './contextHelpers';
import { UiPreferencesProvider, useUiPreferences } from './UiPreferencesContext';
import { useFeedState } from './useFeedState';
import { useStoriesAndMomentsState } from './useStoriesAndMomentsState';
import { useMarketWalletAndCommunitiesState } from './useMarketWalletAndCommunitiesState';

export { GUEST_USER };
export type { SendMessageOptions, UpdateProfileMediaOptions };
export { useUiPreferences };

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: React.ReactNode;
  initialRoute?: AppRoute;
  initialConversationId?: string | null;
  controlledRoute?: AppRoute;
  controlledConversationId?: string | null;
  onRouteChange?: (route: AppRoute) => void;
  onConversationChange?: (id: string | null) => void;
  onCreateOpen?: (mode?: CreateMode) => void;
}

function AppSessionProvider({
  children,
  initialRoute = 'home',
  initialConversationId = null,
  controlledRoute,
  controlledConversationId,
  onRouteChange,
  onConversationChange,
  onCreateOpen,
}: AppProviderProps) {
  const ui = useUiPreferences();
  const {
    showAppToast,
    setIsAuthModalOpen,
    setIsComposerOpen,
    setActiveStoryUser,
  } = ui;

  // Navigation
  const [internalRoute, setInternalRoute] = useState<AppRoute>(initialRoute);
  const [internalConversationId, setInternalConversationId] = useState<string | null>(initialConversationId);

  const currentRoute = controlledRoute !== undefined ? controlledRoute : internalRoute;
  const activeConversationId =
    controlledConversationId !== undefined ? controlledConversationId : internalConversationId;

  const setCurrentRoute = useCallback(
    (route: AppRoute) => {
      setInternalRoute(route);
      if (onRouteChange) {
        onRouteChange(route);
      }
    },
    [onRouteChange]
  );

  const openCreate = useCallback(
    (mode: CreateMode = 'story') => {
      if (onCreateOpen) {
        onCreateOpen(mode);
      } else {
        setCurrentRoute('create');
      }
    },
    [onCreateOpen, setCurrentRoute]
  );

  // Deep Flow Modals State
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [activeProductDetail, setActiveProductDetail] = useState<Product | null>(null);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState<boolean>(false);
  const [activeLiveStream, setActiveLiveStream] = useState<{
    id: string;
    title: string;
    host: User;
    viewersCount: number;
  } | null>(null);

  // Profile Canvas Configuration (F14 & F2 persistence)
  const [activeCanvasConfig, setActiveCanvasConfigState] = useState<ProfileCanvasConfig | null>(null);

  // Core Auth, Users, Chat & Notifications State
  const [exploreQuery, setExploreQuery] = useState<string>('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [authBootstrapped, setAuthBootstrapped] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const serverOnlineRef = useRef(serverOnline);
  serverOnlineRef.current = serverOnline;
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const lastBootstrappedUserIdRef = useRef<string | null | undefined>(undefined);
  const lastEventIdRef = useRef<number>(0);
  const messageCursorByConvRef = useRef<Record<string, { cursor: string | null; hasMore: boolean }>>({});

  const handleApiError = useCallback(
    (err: unknown, fallbackMessage = 'حدث خطأ غير متوقع') => {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setIsAuthenticated(false);
          setIsAuthModalOpen(true);
          showAppToast('يرجى تسجيل الدخول للمتابعة', 'info');
          return;
        }
        showAppToast(err.message || fallbackMessage, 'error');
        return;
      }
      showAppToast(fallbackMessage, 'error');
    },
    [setIsAuthModalOpen, showAppToast]
  );

  const requireAuthForWrite = useCallback((): boolean => {
    if (serverOnlineRef.current && !isAuthenticatedRef.current) {
      setIsAuthModalOpen(true);
      showAppToast('يرجى تسجيل الدخول للمتابعة', 'info');
      return false;
    }
    return true;
  }, [setIsAuthModalOpen, showAppToast]);

  const syncApi = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T | null> => {
      if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
      if (window.location.protocol === 'about:') return null;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
      try {
        return await apiFetch<T>(path, init);
      } catch (err) {
        if (err instanceof ApiClientError && err.status !== 503) {
          handleApiError(err);
        }
        return null;
      }
    },
    [handleApiError]
  );

  // Domain Hooks
  const feed = useFeedState({
    serverOnlineRef,
    currentUserRef,
    setCurrentUser,
    requireAuthForWrite,
    handleApiError,
    showAppToast,
  });

  const storiesAndMoments = useStoriesAndMomentsState({
    serverOnlineRef,
    isAuthenticatedRef,
    currentUserRef,
    conversationsRef,
    authBootstrapped,
    isAuthenticated,
    currentUser,
    users,
    setCurrentUser,
    setConversations,
    setMessagesByConversation,
    requireAuthForWrite,
    handleApiError,
    showAppToast,
    syncApi,
  });

  const marketWalletCommunities = useMarketWalletAndCommunitiesState({
    serverOnlineRef,
    currentUserRef,
    setCurrentUser,
    requireAuthForWrite,
    handleApiError,
    showAppToast,
  });

  const { setPosts, setPostsNextCursor, setPostsHasMore, setActivePostComments, setSavedCollections } = feed;
  const {
    setStoriesByUser,
    setStoryStorage,
    setSocialMoments,
    setSeenInstantIds,
    setStoryToast,
  } = storiesAndMoments;
  const {
    setProducts,
    setOrders,
    setWalletBalance,
    setWalletTransactions,
    setCommunities,
    setCommunityMessagesById,
  } = marketWalletCommunities;

  const setActiveCanvasConfig = useCallback(
    async (cfg: ProfileCanvasConfig | null): Promise<boolean> => {
      const prevCfg = activeCanvasConfig;
      const targetUserId = currentUserRef.current.id;
      setActiveCanvasConfigState(cfg);
      writeStoredCanvas(cfg, targetUserId);
      setCurrentUser((prev) => ({ ...prev, canvasConfig: cfg as Record<string, unknown> | null }));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId
            ? { ...u, canvasConfig: cfg as Record<string, unknown> | null }
            : u
        )
      );
      if (serverOnlineRef.current && isAuthenticatedRef.current) {
        try {
          await apiFetch('/api/users/me', {
            method: 'PATCH',
            body: JSON.stringify({ canvasConfig: cfg }),
          });
          return true;
        } catch (err) {
          setActiveCanvasConfigState(prevCfg);
          writeStoredCanvas(prevCfg, targetUserId);
          setCurrentUser((prev) => ({ ...prev, canvasConfig: prevCfg as Record<string, unknown> | null }));
          setUsers((prev) =>
            prev.map((u) =>
              u.id === targetUserId
                ? { ...u, canvasConfig: prevCfg as Record<string, unknown> | null }
                : u
            )
          );
          handleApiError(err, 'تعذّر حفظ تصميم اللوحة');
          return false;
        }
      }
      return true;
    },
    [activeCanvasConfig, handleApiError]
  );

  const applyBootstrapPayload = useCallback(
    (data: BootstrapResponse) => {
      setServerOnline(true);
      setAuthBootstrapped(true);

      const authed = Boolean(data.authenticated && data.currentUser);
      setIsAuthenticated(authed);

      const nextViewerId = authed && data.currentUser ? data.currentUser.id : null;
      const accountSwitched = lastBootstrappedUserIdRef.current !== nextViewerId;
      lastBootstrappedUserIdRef.current = nextViewerId;

      if (authed && data.currentUser) {
        const normalizedSelf = normalizeUserRecord(data.currentUser);
        setCurrentUser(normalizedSelf);
        setWalletBalance(typeof normalizedSelf.walletBalance === 'number' ? normalizedSelf.walletBalance : 0);
        if (normalizedSelf.canvasConfig !== undefined) {
          if (normalizedSelf.canvasConfig === null) {
            setActiveCanvasConfigState(null);
            writeStoredCanvas(null, normalizedSelf.id);
          } else {
            const parsedCanvas = validateCanvasJson(normalizedSelf.canvasConfig);
            const nextCanvas = parsedCanvas.valid && parsedCanvas.config ? parsedCanvas.config : null;
            setActiveCanvasConfigState(nextCanvas);
            writeStoredCanvas(nextCanvas, normalizedSelf.id);
          }
        } else if (accountSwitched) {
          setActiveCanvasConfigState(readStoredCanvas(normalizedSelf.id));
        }
      } else {
        setStoredSessionToken(null);
        setCurrentUser(GUEST_USER);
        setWalletBalance(0);
        setActiveCanvasConfigState(null);
      }

      if (accountSwitched) {
        lastEventIdRef.current = 0;
        messageCursorByConvRef.current = {};
        setSeenInstantIds([]);
        setViewingUser(null);
        setActivePostComments(null);
        setActiveProductDetail(null);
        setActiveStoryUser(null);
        setStoryToast(null);
        setIsComposerOpen(false);
        setIsCreateCommunityOpen(false);
        setActiveLiveStream(null);
        setInternalConversationId(null);
        if (onConversationChange) {
          onConversationChange(null);
        }
      }

      if (Array.isArray(data.users)) {
        setUsers(data.users.map(normalizeUserRecord));
      }
      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
        setPostsNextCursor(data.postsNextCursor ?? null);
        setPostsHasMore(Boolean(data.postsHasMore));
      }
      if (Array.isArray(data.conversations)) {
        setConversations(authed ? data.conversations : []);
      }
      if (data.messagesByConversation && typeof data.messagesByConversation === 'object') {
        setMessagesByConversation(authed ? data.messagesByConversation : {});
      }
      if (Array.isArray(data.products)) setProducts(data.products);
      setOrders(authed && Array.isArray(data.orders) ? data.orders : []);
      setWalletTransactions(authed && Array.isArray(data.walletTransactions) ? data.walletTransactions : []);
      setSavedCollections(authed && Array.isArray(data.savedCollections) ? data.savedCollections : []);
      if (Array.isArray(data.notifications)) {
        setNotifications(authed ? data.notifications : []);
      }
      if (Array.isArray(data.communities)) setCommunities(data.communities);
      setCommunityMessagesById(
        data.communityMessagesById && typeof data.communityMessagesById === 'object'
          ? data.communityMessagesById
          : {}
      );

      if (data.storiesByUser && typeof data.storiesByUser === 'object') {
        const merged: Record<string, StoryItem[]> = {};
        for (const [uid, items] of Object.entries(data.storiesByUser)) {
          const storyOnly = (items ?? []).filter((it) => it.mode !== 'instants' && it.kind !== 'instant');
          if (storyOnly.length > 0) {
            merged[uid] = filterActiveStories(storyOnly);
          }
        }
        setStoriesByUser(merged);
        if (nextViewerId) {
          setStoryStorage((prev) => {
            const base = accountSwitched ? readStoryStorage(undefined, nextViewerId) : prev;
            const pruned = pruneStoryStorage(base, merged);
            writeStoryStorage(pruned, nextViewerId);
            return pruned;
          });
        } else {
          setStoryStorage(emptyStoryStorage());
        }
      }

      if (Array.isArray(data.socialMoments)) {
        const activeServerMoments = filterActiveMoments(data.socialMoments);
        if (nextViewerId) {
          setSocialMoments(activeServerMoments);
          writeMomentsStorage(activeServerMoments, nextViewerId);
        } else {
          setSocialMoments(activeServerMoments);
        }
      }
    },
    [
      onConversationChange,
      setActivePostComments,
      setActiveStoryUser,
      setCommunities,
      setCommunityMessagesById,
      setIsComposerOpen,
      setOrders,
      setPosts,
      setPostsHasMore,
      setPostsNextCursor,
      setProducts,
      setSavedCollections,
      setSeenInstantIds,
      setSocialMoments,
      setStoriesByUser,
      setStoryStorage,
      setStoryToast,
      setWalletBalance,
      setWalletTransactions,
    ]
  );

  const refreshBootstrap = useCallback(async () => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    if (window.location.protocol === 'about:') return;
    try {
      const data = await apiFetch<BootstrapResponse>('/api/bootstrap');
      applyBootstrapPayload(data);
    } catch {
      setAuthBootstrapped(true);
    }
  }, [applyBootstrapPayload]);

  useEffect(() => {
    void refreshBootstrap();
  }, [refreshBootstrap]);

  const completeAuthSession = useCallback(
    async (user: User, redirectToHome = true, sessionToken?: string) => {
      if (sessionToken) {
        setStoredSessionToken(sessionToken);
      }
      const normalized = normalizeUserRecord(user);
      if (currentUserRef.current.id !== normalized.id) {
        lastEventIdRef.current = 0;
        messageCursorByConvRef.current = {};
        setConversations([]);
        setMessagesByConversation({});
        setNotifications([]);
        setSeenInstantIds([]);
        setViewingUser(null);
        setActivePostComments(null);
        setActiveProductDetail(null);
        setActiveStoryUser(null);
        setStoryToast(null);
        setIsComposerOpen(false);
        setIsCreateCommunityOpen(false);
        setActiveLiveStream(null);
        setInternalConversationId(null);
        if (onConversationChange) {
          onConversationChange(null);
        }
        setWalletBalance(0);
        setActiveCanvasConfigState(readStoredCanvas(normalized.id));
        setStoryStorage(readStoryStorage(undefined, normalized.id));
      }
      setCurrentUser(normalized);
      setIsAuthenticated(true);
      setServerOnline(true);
      setIsAuthModalOpen(false);
      await refreshBootstrap();
      if (redirectToHome) {
        setCurrentRoute('home');
      }
    },
    [
      onConversationChange,
      refreshBootstrap,
      setActivePostComments,
      setActiveStoryUser,
      setCurrentRoute,
      setIsAuthModalOpen,
      setIsComposerOpen,
      setSeenInstantIds,
      setStoryStorage,
      setStoryToast,
      setWalletBalance,
    ]
  );

  const login = useCallback(
    (user?: User) => {
      if (user) {
        setCurrentUser(normalizeUserRecord(user));
        setIsAuthenticated(true);
      }
      setCurrentRoute('home');
    },
    [setCurrentRoute]
  );

  const markConversationRead = useCallback(
    (id: string) => {
      const hadUnread = conversationsRef.current.some((c) => c.id === id && c.unreadCount > 0);
      if (!hadUnread) return;
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
      if (isAuthenticatedRef.current) {
        void syncApi(`/api/conversations/${encodeURIComponent(id)}/read`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      }
    },
    [syncApi]
  );

  const setActiveConversationId = useCallback(
    (id: string | null) => {
      setInternalConversationId(id);
      if (onConversationChange) {
        onConversationChange(id);
      }
      if (id) {
        markConversationRead(id);
      }
    },
    [onConversationChange, markConversationRead]
  );

  const loadOlderMessages = useCallback(
    async (conversationId: string): Promise<boolean> => {
      if (!serverOnlineRef.current || !isAuthenticatedRef.current) return false;
      const meta = messageCursorByConvRef.current[conversationId];
      if (meta && !meta.hasMore) return false;
      try {
        let cursor = meta?.cursor ?? null;
        if (!meta) {
          const initialPage = await apiFetch<{
            messages: ChatMessage[];
            nextCursor: string | null;
            hasMore: boolean;
          }>(`/api/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`);
          messageCursorByConvRef.current[conversationId] = {
            cursor: initialPage.nextCursor,
            hasMore: initialPage.hasMore,
          };
          if (!initialPage.hasMore || !initialPage.nextCursor) {
            return false;
          }
          cursor = initialPage.nextCursor;
        }
        const res = await apiFetch<{
          messages: ChatMessage[];
          nextCursor: string | null;
          hasMore: boolean;
        }>(
          `/api/conversations/${encodeURIComponent(conversationId)}/messages?limit=50&cursor=${encodeURIComponent(cursor!)}`
        );
        messageCursorByConvRef.current[conversationId] = {
          cursor: res.nextCursor,
          hasMore: res.hasMore,
        };
        setMessagesByConversation((prev) => {
          const existing = prev[conversationId] ?? [];
          const seenIds = new Set(existing.map((m) => m.id));
          const older = res.messages.filter((m) => !seenIds.has(m.id));
          return {
            ...prev,
            [conversationId]: [...older, ...existing],
          };
        });
        return res.hasMore;
      } catch (err) {
        handleApiError(err, 'تعذّر تحميل الرسائل الأقدم');
        return false;
      }
    },
    [handleApiError]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch {
      // Proceed cleanly even if already expired or offline
    }
    lastEventIdRef.current = 0;
    lastBootstrappedUserIdRef.current = null;
    messageCursorByConvRef.current = {};
    setStoredSessionToken(null);
    setIsAuthenticated(false);
    setCurrentUser(GUEST_USER);
    setConversations([]);
    setMessagesByConversation({});
    setNotifications([]);
    setSeenInstantIds([]);
    setViewingUser(null);
    setActivePostComments(null);
    setActiveProductDetail(null);
    setActiveStoryUser(null);
    setStoryToast(null);
    setIsComposerOpen(false);
    setIsCreateCommunityOpen(false);
    setActiveLiveStream(null);
    setWalletBalance(0);
    setActiveCanvasConfigState(null);
    setStoryStorage(emptyStoryStorage());
    setSocialMoments([]);
    setActiveConversationId(null);
    await refreshBootstrap();
    setCurrentRoute('auth');
  }, [
    refreshBootstrap,
    setActiveConversationId,
    setActivePostComments,
    setActiveStoryUser,
    setCurrentRoute,
    setIsComposerOpen,
    setSeenInstantIds,
    setSocialMoments,
    setStoryStorage,
    setStoryToast,
    setWalletBalance,
  ]);

  const updateCurrentUser = useCallback(
    async (updates: Partial<User>, media?: UpdateProfileMediaOptions): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;

      if (!serverOnlineRef.current) {
        setCurrentUser((prev) => normalizeUserRecord({ ...prev, ...updates }));
        setUsers((prev) =>
          prev.map((u) =>
            u.id === currentUserRef.current.id ? normalizeUserRecord({ ...u, ...updates }) : u
          )
        );
        return true;
      }

      try {
        let avatarMediaId: string | undefined;
        let coverMediaId: string | undefined;

        if (media?.avatarFile) {
          const uploaded = await uploadMediaSource(media.avatarFile, 'avatar');
          avatarMediaId = uploaded.mediaId;
        }
        if (media?.coverFile) {
          const uploaded = await uploadMediaSource(media.coverFile, 'cover');
          coverMediaId = uploaded.mediaId;
        }

        const currentHandle = (
          currentUserRef.current.handle ??
          currentUserRef.current.username ??
          ''
        ).toLowerCase();
        const requestedHandle = (updates.handle ?? updates.username)?.trim().toLowerCase();

        const payload: Record<string, unknown> = {};
        if (typeof updates.displayName === 'string') payload.displayName = updates.displayName;
        if (typeof updates.bio === 'string') payload.bio = updates.bio;
        if (typeof updates.province === 'string') payload.province = updates.province;
        if (typeof updates.city === 'string') payload.city = updates.city;
        if (updates.accountType) payload.accountType = updates.accountType;
        if (avatarMediaId) payload.avatarMediaId = avatarMediaId;
        if (coverMediaId) payload.coverMediaId = coverMediaId;
        if (requestedHandle && requestedHandle !== currentHandle) {
          payload.handle = requestedHandle;
        }

        const updatedSelf = await apiFetch<User>('/api/users/me', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        const normalized = normalizeUserRecord({
          ...currentUserRef.current,
          ...updatedSelf,
        });
        setCurrentUser(normalized);
        setUsers((prev) => prev.map((u) => (u.id === normalized.id ? { ...u, ...normalized } : u)));
        setViewingUser((prev) => (prev && prev.id === normalized.id ? { ...prev, ...normalized } : prev));
        setPosts((prev) =>
          prev.map((p) =>
            p.author.id === normalized.id ? { ...p, author: { ...p.author, ...normalized } } : p
          )
        );
        setNotifications((prev) =>
          prev.map((n) =>
            n.actor.id === normalized.id ? { ...n, actor: { ...n.actor, ...normalized } } : n
          )
        );
        if (media?.avatarFile) {
          showAppToast('تم تحديث الصورة الشخصية بنجاح', 'success');
        } else if (media?.coverFile) {
          showAppToast('تم تحديث صورة الغلاف بنجاح', 'success');
        }
        return true;
      } catch (err) {
        handleApiError(err, 'تعذّر حفظ التعديلات');
        return false;
      }
    },
    [handleApiError, requireAuthForWrite, setPosts, showAppToast]
  );

  const updateUserSettings = useCallback(
    async (partial: Partial<UserSettings>): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const prevSettings = currentUserRef.current.settings;
      const nextSettings = { ...(prevSettings ?? {}), ...partial } as UserSettings;
      setCurrentUser((prev) => ({ ...prev, settings: nextSettings }));
      if (!serverOnlineRef.current) return true;
      try {
        const res = await apiFetch<{ ok: boolean; settings: UserSettings }>('/api/users/me/settings', {
          method: 'PATCH',
          body: JSON.stringify(partial),
        });
        setCurrentUser((prev) => ({ ...prev, settings: res.settings }));
        return true;
      } catch (err) {
        setCurrentUser((prev) => ({ ...prev, settings: prevSettings }));
        handleApiError(err, 'تعذّر حفظ الإعدادات');
        return false;
      }
    },
    [handleApiError, requireAuthForWrite]
  );

  // Derived activeMessages based on currently selected conversation
  const activeMessages = activeConversationId
    ? messagesByConversation[activeConversationId] ?? []
    : [];

  // Real-time SSE events + delta sync fallback when authenticated
  useEffect(() => {
    if (!serverOnline || !isAuthenticated || !currentUser.id || currentUser.id === 'guest') return;
    if (typeof window === 'undefined' || window.location.protocol === 'about:') return;

    let closed = false;
    let es: EventSource | null = null;

    const processRealtimeEvent = (eventType: string, payload: Record<string, unknown>) => {
      if (eventType === 'message:new') {
        const conversationId =
          typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
        const message = payload.message as ChatMessage | undefined;
        if (!conversationId || !message) return;
        const incoming: ChatMessage = {
          ...message,
          isOwn: message.senderId === currentUserRef.current.id,
        };
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: mergeIncomingMessage(prev[conversationId] ?? [], incoming),
        }));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessage: incoming.text || 'رسالة جديدة',
                  lastMessageTime: incoming.timestamp,
                  unreadCount:
                    activeConversationIdRef.current === conversationId || incoming.isOwn
                      ? c.unreadCount
                      : c.unreadCount + 1,
                }
              : c
          )
        );
      } else if (eventType === 'message:edited') {
        const conversationId =
          typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
        const messageId = typeof payload.messageId === 'string' ? payload.messageId : undefined;
        if (!conversationId || !messageId) return;
        const nextText = typeof payload.text === 'string' ? payload.text : undefined;
        const replyMarkup = payload.replyMarkup as ChatMessage['replyMarkup'] | undefined;
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  text: nextText ?? m.text,
                  ...(replyMarkup !== undefined ? { replyMarkup } : {}),
                }
              : m
          ),
        }));
      } else if (eventType === 'message:deleted') {
        const conversationId =
          typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
        const messageId = typeof payload.messageId === 'string' ? payload.messageId : undefined;
        if (!conversationId || !messageId) return;
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).filter((m) => m.id !== messageId),
        }));
      } else if (eventType === 'chat:read') {
        const conversationId =
          typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
        const userId = typeof payload.userId === 'string' ? payload.userId : undefined;
        if (!conversationId || userId === currentUserRef.current.id) return;
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.isOwn ? { ...m, status: 'read' } : m
          ),
        }));
      } else if (eventType === 'bot:callback_answer') {
        const text = typeof payload.text === 'string' ? payload.text : undefined;
        const showAlert = Boolean(payload.showAlert);
        if (text) {
          showAppToast(text, showAlert ? 'info' : 'success');
        }
      } else if (eventType === 'notification:new') {
        const notif = payload as unknown as AppNotification;
        if (notif && notif.id && notif.actor) {
          setNotifications((prev) =>
            prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]
          );
        }
      }
    };

    const controller = new AbortController();

    if (isCrossOriginApi()) {
      const connectFetchSse = async () => {
        const sseUrl = resolveApiUrl(
          lastEventIdRef.current > 0
            ? `/api/events?lastEventId=${lastEventIdRef.current}`
            : '/api/events'
        );
        const token = getStoredSessionToken();
        try {
          const res = await fetch(sseUrl, {
            method: 'GET',
            headers: {
              Accept: 'text/event-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            signal: controller.signal,
          });
          if (!res.ok || !res.body) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = 'message';
          let currentData: string[] = [];

          while (!closed) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (line === '') {
                if (currentData.length > 0) {
                  try {
                    const parsed = JSON.parse(currentData.join('\n')) as Record<string, unknown>;
                    processRealtimeEvent(currentEvent, parsed);
                  } catch {}
                }
                currentEvent = 'message';
                currentData = [];
              } else if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('id:')) {
                const parsedId = Number(line.slice(3).trim());
                if (Number.isInteger(parsedId) && parsedId > lastEventIdRef.current) {
                  lastEventIdRef.current = parsedId;
                }
              } else if (line.startsWith('data:')) {
                currentData.push(line.slice(5).trimStart());
              }
            }
          }
        } catch {
          // Fallback delta timer keeps state synchronized
        }
      };
      void connectFetchSse();
    } else if (typeof EventSource !== 'undefined') {
      const sseUrl = resolveApiUrl(
        lastEventIdRef.current > 0
          ? `/api/events?lastEventId=${lastEventIdRef.current}`
          : '/api/events'
      );
      es = new EventSource(sseUrl);

      const trackEventId = (ev: MessageEvent) => {
        const parsedId = Number(ev.lastEventId);
        if (Number.isInteger(parsedId) && parsedId > lastEventIdRef.current) {
          lastEventIdRef.current = parsedId;
        }
      };

      const subscribedEvents = [
        'message:new',
        'message:edited',
        'message:deleted',
        'chat:read',
        'bot:callback_answer',
        'notification:new',
      ];
      for (const evtName of subscribedEvents) {
        es.addEventListener(evtName, (ev) => {
          trackEventId(ev as MessageEvent);
          try {
            const data = JSON.parse((ev as MessageEvent).data) as Record<string, unknown>;
            processRealtimeEvent(evtName, data);
          } catch {}
        });
      }
    }

    const deltaTimer = setInterval(() => {
      if (closed || !isAuthenticatedRef.current) return;
      apiFetch<{
        lastEventId: number | null;
        events: Array<{ id: number; eventType: string; payload: Record<string, unknown> }>;
        conversationUnreadById: Record<string, number>;
      }>(`/api/bootstrap/delta?since=${lastEventIdRef.current}`)
        .then((delta) => {
          if (closed) return;
          if (typeof delta.lastEventId === 'number' && delta.lastEventId > lastEventIdRef.current) {
            lastEventIdRef.current = delta.lastEventId;
          }
          if (Array.isArray(delta.events)) {
            for (const ev of delta.events) {
              processRealtimeEvent(ev.eventType, ev.payload ?? {});
            }
          }
          if (delta.conversationUnreadById) {
            setConversations((prev) =>
              applyDeltaConversationUnreads(prev, delta.conversationUnreadById)
            );
          }
        })
        .catch(() => {});
    }, 20_000);

    return () => {
      closed = true;
      controller.abort();
      clearInterval(deltaTimer);
      if (es) {
        es.close();
      }
    };
  }, [currentUser.id, isAuthenticated, serverOnline, showAppToast]);

  // Chat & Social Graph Actions
  const sendChatMessage = useCallback(
    async (text: string, options?: SendMessageOptions) => {
      const trimmed = text.trim();
      if ((!trimmed && !options?.mediaFile) || !activeConversationId) return;
      if (!requireAuthForWrite()) return;

      const convId = activeConversationId;
      const id = makeClientId('msg');
      const previewUrl =
        typeof options?.mediaFile === 'string'
          ? options.mediaFile
          : options?.mediaFile instanceof Blob
          ? URL.createObjectURL(options.mediaFile)
          : undefined;
      const inferredKind: ChatMessage['kind'] =
        options?.kind ??
        (options?.mediaFile instanceof Blob
          ? inferChatMediaKind(normalizeMediaMime(options.mediaFile.type || 'image/jpeg'))
          : previewUrl
          ? 'image'
          : 'text');

      const msgText =
        trimmed ||
        (inferredKind === 'voice' ? 'رسالة صوتية' : inferredKind === 'image' ? 'صورة مرفقة' : 'ملف مرفق');

      const newMsg: ChatMessage = {
        id,
        senderId: currentUser.id,
        text: msgText,
        timestamp: 'الآن',
        isOwn: true,
        kind: inferredKind,
        status: 'sent',
        mediaUrl: previewUrl,
        voiceDuration: options?.voiceDuration,
      };

      const prevConvSnapshot = conversationsRef.current.find((c) => c.id === convId);

      setMessagesByConversation((prev) => {
        const currentList = prev[convId] ?? [];
        return {
          ...prev,
          [convId]: [...currentList, newMsg],
        };
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, lastMessage: `أنت: ${msgText}`, lastMessageTime: new Date().toISOString() }
            : c
        )
      );

      if (!serverOnlineRef.current) return;

      try {
        let mediaId: string | undefined;
        if (options?.mediaFile) {
          const uploadKind = inferredKind === 'image' ? 'chat-image' : 'chat-file';
          const uploaded = await uploadMediaSource(options.mediaFile, uploadKind);
          mediaId = uploaded.mediaId;
        }

        const res = await apiFetch<{ id: string; lastMessageTime: string; mediaUrl?: string }>(
          `/api/conversations/${encodeURIComponent(convId)}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({
              id,
              clientMsgId: id,
              text: msgText,
              ...(mediaId ? { mediaId } : {}),
              kind: inferredKind,
              ...(options?.voiceDuration ? { voiceDuration: options.voiceDuration } : {}),
              ...(options?.replyToMessageId ? { replyToMessageId: options.replyToMessageId } : {}),
            }),
          }
        );

        if (res.mediaUrl) {
          setMessagesByConversation((prev) => ({
            ...prev,
            [convId]: (prev[convId] ?? []).map((m) =>
              m.id === id ? { ...m, mediaUrl: res.mediaUrl } : m
            ),
          }));
        }
      } catch (err) {
        setMessagesByConversation((prev) => ({
          ...prev,
          [convId]: (prev[convId] ?? []).filter((m) => m.id !== id),
        }));
        if (prevConvSnapshot) {
          setConversations((prev) => prev.map((c) => (c.id === convId ? prevConvSnapshot : c)));
        }
        handleApiError(err, 'تعذّر إرسال الرسالة');
      }
    },
    [activeConversationId, currentUser.id, handleApiError, requireAuthForWrite]
  );

  const toggleFollowUser = useCallback(
    (userId: string) => {
      if (!requireAuthForWrite()) return;
      let prevUserSnapshot: User | undefined;
      const applyFlip = (u: User): User => {
        const isFollowing = !u.isFollowing;
        return {
          ...u,
          isFollowing,
          followersCount: isFollowing ? u.followersCount + 1 : Math.max(0, u.followersCount - 1),
        };
      };
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          prevUserSnapshot = u;
          return applyFlip(u);
        })
      );
      setViewingUser((prev) => (prev && prev.id === userId ? applyFlip(prev) : prev));

      if (!serverOnlineRef.current) return;
      void apiFetch(`/api/users/${encodeURIComponent(userId)}/follow`, {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch((err) => {
        if (prevUserSnapshot) {
          const snap = prevUserSnapshot;
          setUsers((prev) => prev.map((u) => (u.id === userId ? snap : u)));
          setViewingUser((prev) => (prev && prev.id === userId ? snap : prev));
        }
        handleApiError(err, 'تعذّر تحديث المتابعة');
      });
    },
    [handleApiError, requireAuthForWrite]
  );

  const toggleCloseFriend = useCallback(
    async (userId: string) => {
      if (!requireAuthForWrite()) return;
      const res = await syncApi<{ isCloseFriend: boolean }>(
        `/api/users/${encodeURIComponent(userId)}/close-friend`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      if (res) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isCloseFriend: res.isCloseFriend } : u))
        );
        setViewingUser((prev) =>
          prev && prev.id === userId ? { ...prev, isCloseFriend: res.isCloseFriend } : prev
        );
        showAppToast(
          res.isCloseFriend ? 'تمت الإضافة للأصدقاء المقرّبين' : 'تمت الإزالة من الأصدقاء المقرّبين',
          'success'
        );
      }
    },
    [requireAuthForWrite, showAppToast, syncApi]
  );

  const blockUser = useCallback(
    async (userId: string) => {
      if (!requireAuthForWrite()) return;
      const res = await syncApi<{ blocked: boolean }>(`/api/users/${encodeURIComponent(userId)}/block`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res?.blocked || !serverOnlineRef.current) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setPosts((prev) => prev.filter((p) => p.author.id !== userId));
        setViewingUser((prev) => (prev?.id === userId ? null : prev));
        showAppToast('تم حظر الحساب بنجاح', 'success');
      }
    },
    [requireAuthForWrite, setPosts, showAppToast, syncApi]
  );

  const unblockUser = useCallback(
    async (userId: string) => {
      if (!requireAuthForWrite()) return;
      await syncApi<{ blocked: boolean }>(`/api/users/${encodeURIComponent(userId)}/block`, {
        method: 'DELETE',
      });
      await refreshBootstrap();
      showAppToast('تم إلغاء الحظر', 'success');
    },
    [refreshBootstrap, requireAuthForWrite, showAppToast, syncApi]
  );

  const markNotificationsRead = useCallback(
    async (opts: { ids?: string[]; all?: boolean }) => {
      if (!isAuthenticatedRef.current) return;
      const prevNotifs = notifications;
      setNotifications((list) =>
        list.map((n) => (opts.all || opts.ids?.includes(n.id) ? { ...n, isRead: true } : n))
      );
      if (!serverOnlineRef.current) return;
      try {
        await apiFetch('/api/notifications/read', {
          method: 'POST',
          body: JSON.stringify(opts),
        });
      } catch (err) {
        setNotifications(prevNotifs);
        handleApiError(err, 'تعذّر تحديث حالة الإشعارات');
      }
    },
    [handleApiError, notifications]
  );

  const startChatWithUser = useCallback(
    async (user: User) => {
      if (!requireAuthForWrite()) return;

      const existing = findDirectConversation(conversationsRef.current, user.id);
      if (existing) {
        setActiveConversationId(existing.id);
        setCurrentRoute('messages');
        return;
      }

      if (!serverOnlineRef.current) {
        const id = makeClientId('conv');
        const newConv: ChatConversation = {
          id,
          peerId: user.id,
          title: user.displayName,
          avatarUrl: user.avatarUrl,
          lastMessage: 'بدأت محادثة جديدة',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          isOnline: false,
        };
        setConversations((prev) => [newConv, ...prev]);
        setMessagesByConversation((prev) => ({ ...prev, [id]: [] }));
        setActiveConversationId(id);
        setCurrentRoute('messages');
        return;
      }

      try {
        const res = await apiFetch<{
          id: string;
          created: boolean;
          conversation: ChatConversation;
        }>('/api/conversations/start', {
          method: 'POST',
          body: JSON.stringify({ recipientId: user.id }),
        });

        setConversations((prev) =>
          prev.some((c) => c.id === res.id) ? prev : [res.conversation, ...prev]
        );
        setMessagesByConversation((prev) =>
          prev[res.id] ? prev : { ...prev, [res.id]: [] }
        );
        setActiveConversationId(res.id);
        setCurrentRoute('messages');
      } catch (err) {
        handleApiError(err, 'تعذّر بدء المحادثة');
      }
    },
    [handleApiError, requireAuthForWrite, setActiveConversationId, setCurrentRoute]
  );

  const startBotChat = useCallback(
    async (bot: User | { id: string; displayName: string; avatarUrl: string; handle?: string }) => {
      if (!requireAuthForWrite()) return;
      try {
        const res = await apiFetch<{ ok: boolean; conversationId: string }>(
          `/api/bots/${encodeURIComponent(bot.id)}/start`,
          { method: 'POST', body: JSON.stringify({}) }
        );
        await refreshBootstrap();
        setActiveConversationId(res.conversationId);
        setCurrentRoute('messages');
      } catch (err) {
        handleApiError(err, 'تعذّر تشغيل البوت');
      }
    },
    [handleApiError, refreshBootstrap, requireAuthForWrite, setActiveConversationId, setCurrentRoute]
  );

  const blockBot = useCallback(
    async (botId: string) => {
      if (!requireAuthForWrite()) return;
      try {
        await apiFetch(`/api/bots/${encodeURIComponent(botId)}/block`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        showAppToast('تم حظر البوت', 'success');
      } catch (err) {
        handleApiError(err, 'تعذّر حظر البوت');
      }
    },
    [handleApiError, requireAuthForWrite, showAppToast]
  );

  const sendBotCallbackQuery = useCallback(
    async (conversationId: string, messageId: string, data: string) => {
      if (!requireAuthForWrite()) return;
      try {
        await apiFetch(`/api/conversations/${encodeURIComponent(conversationId)}/callback-query`, {
          method: 'POST',
          body: JSON.stringify({ messageId, data }),
        });
        setTimeout(() => {
          void refreshBootstrap();
        }, 300);
      } catch (err) {
        handleApiError(err, 'تعذّر تنفيذ الإجراء');
      }
    },
    [handleApiError, refreshBootstrap, requireAuthForWrite]
  );

  const value: AppContextType = {
    currentRoute,
    setCurrentRoute,
    exploreQuery,
    setExploreQuery,
    selectedPostId,
    setSelectedPostId,
    openCreate,
    activeConversationId,
    setActiveConversationId,
    markConversationRead,
    loadOlderMessages,

    theme: ui.theme,
    setTheme: ui.setTheme,
    accent: ui.accent,
    setAccent: ui.setAccent,
    handedness: ui.handedness,
    setHandedness: ui.setHandedness,
    fontScale: ui.fontScale,
    setFontScale: ui.setFontScale,
    numeralSystem: ui.numeralSystem,
    setNumeralSystem: ui.setNumeralSystem,
    reduceMotion: ui.reduceMotion,
    setReduceMotion: ui.setReduceMotion,
    dataSaver: ui.dataSaver,
    setDataSaver: ui.setDataSaver,

    isBottomBarVisible: ui.isBottomBarVisible,
    setIsBottomBarVisible: ui.setIsBottomBarVisible,
    isRecentChatsOpen: ui.isRecentChatsOpen,
    setIsRecentChatsOpen: ui.setIsRecentChatsOpen,
    isComposerOpen: ui.isComposerOpen,
    setIsComposerOpen: ui.setIsComposerOpen,
    isMobileMenuOpen: ui.isMobileMenuOpen,
    setIsMobileMenuOpen: ui.setIsMobileMenuOpen,

    appToast: ui.appToast,
    showAppToast: ui.showAppToast,
    dismissAppToast: ui.dismissAppToast,

    isAuthModalOpen: ui.isAuthModalOpen,
    setIsAuthModalOpen: ui.setIsAuthModalOpen,
    reportModalData: ui.reportModalData,
    openReportModal: ui.openReportModal,
    closeReportModal: ui.closeReportModal,
    shareModalData: ui.shareModalData,
    openShareModal: ui.openShareModal,
    closeShareModal: ui.closeShareModal,
    callModalData: ui.callModalData,
    openCallModal: ui.openCallModal,
    closeCallModal: ui.closeCallModal,
    activeStoryUser: ui.activeStoryUser,
    openStoryViewer: ui.openStoryViewer,
    closeStoryViewer: ui.closeStoryViewer,

    viewingUser,
    setViewingUser,
    activePostComments: feed.activePostComments,
    setActivePostComments: feed.setActivePostComments,
    activeProductDetail,
    setActiveProductDetail,
    isCreateCommunityOpen,
    setIsCreateCommunityOpen,
    activeLiveStream,
    setActiveLiveStream,

    activeCanvasConfig,
    setActiveCanvasConfig,

    serverOnline,
    authBootstrapped,
    isAuthenticated,
    setIsAuthenticated,
    refreshBootstrap,
    completeAuthSession,
    login,
    logout,
    requireAuthForWrite,

    currentUser,
    updateCurrentUser,
    updateUserSettings,
    users,
    posts: feed.posts,
    postsNextCursor: feed.postsNextCursor,
    postsHasMore: feed.postsHasMore,
    isLoadingMorePosts: feed.isLoadingMorePosts,
    loadMorePosts: feed.loadMorePosts,
    loadingCommentsByPostId: feed.loadingCommentsByPostId,
    loadPostComments: feed.loadPostComments,
    fetchSinglePost: feed.fetchSinglePost,
    conversations,
    messagesByConversation,
    activeMessages,
    products: marketWalletCommunities.products,
    orders: marketWalletCommunities.orders,
    walletTransactions: marketWalletCommunities.walletTransactions,
    savedCollections: feed.savedCollections,
    notifications,
    communities: marketWalletCommunities.communities,
    communityMessagesById: marketWalletCommunities.communityMessagesById,

    walletBalance: marketWalletCommunities.walletBalance,
    topupWallet: marketWalletCommunities.topupWallet,
    spendCoinsForGift: marketWalletCommunities.spendCoinsForGift,

    toggleLikePost: feed.toggleLikePost,
    toggleRepostPost: feed.toggleRepostPost,
    toggleSavePost: feed.toggleSavePost,
    votePoll: feed.votePoll,
    sendChatMessage,
    toggleWishlistProduct: marketWalletCommunities.toggleWishlistProduct,
    createProduct: marketWalletCommunities.createProduct,
    deleteProduct: marketWalletCommunities.deleteProduct,
    createOrder: marketWalletCommunities.createOrder,
    updateOrderStatus: marketWalletCommunities.updateOrderStatus,
    createSavedCollection: feed.createSavedCollection,
    deleteSavedCollection: feed.deleteSavedCollection,
    toggleSavedCollectionItem: feed.toggleSavedCollectionItem,
    markNotificationsRead,
    toggleFollowUser,
    toggleCloseFriend,
    blockUser,
    unblockUser,
    createPost: feed.createPost,
    deletePost: feed.deletePost,
    addCommentToPost: feed.addCommentToPost,
    likeComment: feed.likeComment,
    addCommunity: marketWalletCommunities.addCommunity,
    joinCommunity: marketWalletCommunities.joinCommunity,
    leaveCommunity: marketWalletCommunities.leaveCommunity,
    sendCommunityMessage: marketWalletCommunities.sendCommunityMessage,
    startChatWithUser,
    startBotChat,
    blockBot,
    sendBotCallbackQuery,

    storiesByUser: storiesAndMoments.storiesByUser,
    storyTrayUsers: storiesAndMoments.storyTrayUsers,
    storySeenMap: storiesAndMoments.storyStorage.seen,
    storyResumeMap: storiesAndMoments.storyStorage.progress,
    storyMuted: storiesAndMoments.storyMuted,
    setStoryMuted: storiesAndMoments.setStoryMuted,
    hasUserUnseenStory: storiesAndMoments.hasUserUnseenStory,
    markStorySeen: storiesAndMoments.markStorySeen,
    saveStoryProgress: storiesAndMoments.saveStoryProgress,
    clearUserStoryProgress: storiesAndMoments.clearUserStoryProgress,
    publishStory: storiesAndMoments.publishStory,
    deleteStory: storiesAndMoments.deleteStory,
    voteStoryPoll: storiesAndMoments.voteStoryPoll,
    undoLastStory: storiesAndMoments.undoLastStory,
    storyToast: storiesAndMoments.storyToast,
    dismissStoryToast: storiesAndMoments.dismissStoryToast,
    socialMoments: storiesAndMoments.socialMoments,
    publishNote: storiesAndMoments.publishNote,
    deleteOwnNote: storiesAndMoments.deleteOwnNote,
    publishInstantMoment: storiesAndMoments.publishInstantMoment,
    replyToMoment: storiesAndMoments.replyToMoment,
    seenInstantIds: storiesAndMoments.seenInstantIds,
    markInstantSeen: storiesAndMoments.markInstantSeen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider(props: AppProviderProps) {
  return (
    <UiPreferencesProvider>
      <AppSessionProvider {...props} />
    </UiPreferencesProvider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
