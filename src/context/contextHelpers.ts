import type {
  AccentPreset,
  AppNotification,
  AppRoute,
  ChatConversation,
  ChatMessage,
  CommunityItem,
  CommunityMessage,
  CreateMode,
  Handedness,
  MarketOrder,
  NumeralSystem,
  Post,
  PostComment,
  Product,
  ReportTargetType,
  SavedCollection,
  SocialMoment,
  StoryAudience,
  StoryItem,
  StoryProgressEntry,
  Theme,
  User,
  UserSettings,
  WalletTransaction,
} from '../types';
import { getScopedStorageKey } from '../lib/storyUtils';
import { ProfileCanvasConfig, validateCanvasJson } from '../lib/canvasSchema';

export interface StoredPreferences {
  theme?: Theme;
  accent?: AccentPreset;
  handedness?: Handedness;
  fontScale?: number;
  numeralSystem?: NumeralSystem;
  reduceMotion?: boolean;
  dataSaver?: boolean;
}

export const PREFS_STORAGE_KEY = 'tw.prefs.v1';
export const CANVAS_STORAGE_KEY = 'tw.canvas.v1';

export const ALLOWED_THEMES: Theme[] = ['system', 'light', 'dark', 'calm', 'high-contrast'];
export const ALLOWED_ACCENTS: AccentPreset[] = ['teal', 'copper', 'indigo', 'green', 'rose', 'violet', 'slate', 'gold'];
export const ALLOWED_HANDEDNESS: Handedness[] = ['center', 'right', 'left'];
export const ALLOWED_NUMERALS: NumeralSystem[] = ['arabic-indic', 'western'];

export const GUEST_USER: User = {
  id: 'guest',
  username: 'guest',
  handle: 'guest',
  displayName: 'زائر تواصل',
  avatarUrl: '',
  bio: 'تصفح منصة تواصل كزائر. سجّل دخولك للمشاركة والتفاعل.',
  province: 'بغداد',
  isVerified: false,
  verifiedKind: 'none',
  accountType: 'personal',
  role: 'user',
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
};

export function readStoredPrefs(): StoredPreferences {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredPreferences) : {};
  } catch {
    return {};
  }
}

export function writeStoredPrefs(prefs: StoredPreferences) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch {}
}

export function readStoredCanvas(userId?: string | null): ProfileCanvasConfig | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    if (!userId || userId === 'guest') return null;
    const key = getScopedStorageKey(CANVAS_STORAGE_KEY, userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = validateCanvasJson(parsed);
    return result.valid && result.config ? result.config : null;
  } catch {
    return null;
  }
}

export function writeStoredCanvas(config: ProfileCanvasConfig | null, userId?: string | null) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (!userId || userId === 'guest') return;
      const key = getScopedStorageKey(CANVAS_STORAGE_KEY, userId);
      if (config) {
        window.localStorage.setItem(key, JSON.stringify(config));
      } else {
        window.localStorage.removeItem(key);
      }
      window.localStorage.removeItem(CANVAS_STORAGE_KEY);
    }
  } catch {}
}

export function makeClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeUserRecord(u: User): User {
  const handle = u.handle ?? u.username;
  return {
    ...u,
    username: handle || u.username,
    handle: handle || u.username,
  };
}

export function insertCommentInTree(
  list: PostComment[],
  comment: PostComment,
  parentId?: string
): PostComment[] {
  if (!parentId) return [comment, ...list];
  return list.map((item) => {
    if (item.id === parentId) {
      return { ...item, replies: [...(item.replies ?? []), comment] };
    }
    if (item.replies && item.replies.length > 0) {
      return { ...item, replies: insertCommentInTree(item.replies, comment, parentId) };
    }
    return item;
  });
}

export function toggleCommentLikeInTree(list: PostComment[], commentId: string): PostComment[] {
  return list.map((item) => {
    const updatedItem =
      item.id === commentId
        ? {
            ...item,
            isLiked: !item.isLiked,
            likesCount: item.isLiked ? Math.max(0, item.likesCount - 1) : item.likesCount + 1,
          }
        : item;
    if (updatedItem.replies && updatedItem.replies.length > 0) {
      return { ...updatedItem, replies: toggleCommentLikeInTree(updatedItem.replies, commentId) };
    }
    return updatedItem;
  });
}

export interface SendMessageOptions {
  mediaFile?: File | Blob | string;
  kind?: ChatMessage['kind'];
  voiceDuration?: string;
  replyToMessageId?: string;
}

export interface UpdateProfileMediaOptions {
  avatarFile?: File | Blob | string;
  coverFile?: File | Blob | string;
}

export interface AppContextType {
  // Navigation & Routing (F3)
  currentRoute: AppRoute;
  setCurrentRoute: (route: AppRoute) => void;
  exploreQuery: string;
  setExploreQuery: (q: string) => void;
  selectedPostId: string | null;
  setSelectedPostId: (id: string | null) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  markConversationRead: (id: string) => void;
  loadOlderMessages: (conversationId: string) => Promise<boolean>;

  // Appearance & Accessibility (F2)
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accent: AccentPreset;
  setAccent: (accent: AccentPreset) => void;
  handedness: Handedness;
  setHandedness: (handedness: Handedness) => void;
  fontScale: number;
  setFontScale: (scale: number) => void;
  numeralSystem: NumeralSystem;
  setNumeralSystem: (sys: NumeralSystem) => void;
  reduceMotion: boolean;
  setReduceMotion: (val: boolean) => void;
  dataSaver: boolean;
  setDataSaver: (val: boolean) => void;

  // Shell State
  isBottomBarVisible: boolean;
  setIsBottomBarVisible: (val: boolean) => void;
  isRecentChatsOpen: boolean;
  setIsRecentChatsOpen: (val: boolean) => void;
  isComposerOpen: boolean;
  setIsComposerOpen: (val: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;

  // Global Toast
  appToast: { message: string; tone: 'info' | 'error' | 'success' } | null;
  showAppToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
  dismissAppToast: () => void;

  // Global Modals State
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (val: boolean) => void;
  reportModalData: {
    isOpen: boolean;
    targetType: ReportTargetType;
    targetTitle?: string;
    targetId?: string;
  };
  openReportModal: (
    targetType: ReportTargetType,
    targetTitle?: string,
    targetId?: string
  ) => void;
  closeReportModal: () => void;
  shareModalData: { isOpen: boolean; title: string; url: string };
  openShareModal: (title: string, url: string) => void;
  closeShareModal: () => void;
  callModalData: { isOpen: boolean; user: User; isVideoCall: boolean };
  openCallModal: (user: User, isVideoCall: boolean) => void;
  closeCallModal: () => void;
  activeStoryUser: User | null;
  openStoryViewer: (user: User) => void;
  closeStoryViewer: () => void;

  // Deep Flow Modals
  viewingUser: User | null;
  setViewingUser: (user: User | null) => void;
  activePostComments: Post | null;
  setActivePostComments: (post: Post | null) => void;
  activeProductDetail: Product | null;
  setActiveProductDetail: (prod: Product | null) => void;
  isCreateCommunityOpen: boolean;
  setIsCreateCommunityOpen: (open: boolean) => void;
  activeLiveStream: { id: string; title: string; host: User; viewersCount: number } | null;
  setActiveLiveStream: (stream: { id: string; title: string; host: User; viewersCount: number } | null) => void;

  // Profile Canvas Configuration (F14)
  activeCanvasConfig: ProfileCanvasConfig | null;
  setActiveCanvasConfig: (config: ProfileCanvasConfig | null) => Promise<boolean>;

  // Auth & Session
  serverOnline: boolean;
  authBootstrapped: boolean;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  refreshBootstrap: () => Promise<void>;
  completeAuthSession: (user: User, redirectToHome?: boolean, sessionToken?: string) => Promise<void>;
  login: (user?: User) => void;
  logout: () => Promise<void>;
  requireAuthForWrite: () => boolean;

  // Data & Actions (F6)
  currentUser: User;
  updateCurrentUser: (updates: Partial<User>, media?: UpdateProfileMediaOptions) => Promise<boolean>;
  updateUserSettings: (partial: Partial<UserSettings>) => Promise<boolean>;
  users: User[];
  posts: Post[];
  postsNextCursor: string | null;
  postsHasMore: boolean;
  isLoadingMorePosts: boolean;
  loadMorePosts: () => Promise<void>;
  loadingCommentsByPostId: Record<string, boolean>;
  loadPostComments: (postId: string) => Promise<void>;
  fetchSinglePost: (postId: string) => Promise<Post | null>;
  conversations: ChatConversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
  activeMessages: ChatMessage[];
  products: Product[];
  orders: MarketOrder[];
  walletTransactions: WalletTransaction[];
  savedCollections: SavedCollection[];
  notifications: AppNotification[];
  communities: CommunityItem[];
  communityMessagesById: Record<string, CommunityMessage[]>;

  walletBalance: number;
  topupWallet: (amountCoins: number, targetUserId?: string) => Promise<boolean>;
  spendCoinsForGift: (giftName: string, coinsCost: number, recipientId?: string) => Promise<boolean>;

  toggleLikePost: (postId: string) => void;
  toggleRepostPost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  votePoll: (postId: string, optionIndex: number) => void;
  sendChatMessage: (text: string, options?: SendMessageOptions) => Promise<void>;
  toggleWishlistProduct: (productId: string) => void;
  createProduct: (
    input: {
      title: string;
      priceIqd: number;
      compareAtPriceIqd?: number;
      category: string;
      condition: 'new' | 'used';
      city: string;
      province: string;
    },
    mediaFile?: File | Blob | string
  ) => Promise<boolean>;
  deleteProduct: (productId: string) => Promise<boolean>;
  createOrder: (productId: string, note?: string) => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: MarketOrder['status']) => Promise<boolean>;
  createSavedCollection: (name: string) => Promise<SavedCollection | null>;
  deleteSavedCollection: (collectionId: string) => Promise<boolean>;
  toggleSavedCollectionItem: (collectionId: string, postId: string) => Promise<void>;
  markNotificationsRead: (opts: { ids?: string[]; all?: boolean }) => Promise<void>;
  toggleFollowUser: (userId: string) => void;
  toggleCloseFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  createPost: (
    text: string,
    mediaSource?: File | Blob | string | Array<File | Blob | string>,
    options?: {
      kind?: 'media' | 'text' | 'video' | 'reel';
      audioTrack?: string;
      location?: string;
      audience?: 'everyone' | 'followers' | 'friends';
      aspectRatio?: '4/5' | '1/1' | '16/9' | '9/16';
      isVideo?: boolean;
    }
  ) => Promise<boolean>;
  deletePost: (postId: string) => Promise<void>;
  addCommentToPost: (postId: string, text: string, parentId?: string) => void;
  likeComment: (postId: string, commentId: string) => void;
  addCommunity: (comm: {
    name: string;
    province: string;
    category?: string;
    isPrivate?: boolean;
    description: string;
    icon?: string;
  }) => void;
  joinCommunity: (communityId: string) => Promise<boolean>;
  leaveCommunity: (communityId: string) => Promise<boolean>;
  sendCommunityMessage: (communityId: string, channel: 'general' | 'announcements', text: string) => Promise<boolean>;
  startChatWithUser: (user: User) => Promise<void>;
  startBotChat: (bot: User | { id: string; displayName: string; avatarUrl: string; handle?: string }) => Promise<void>;
  blockBot: (botId: string) => Promise<void>;
  sendBotCallbackQuery: (conversationId: string, messageId: string, data: string) => Promise<void>;

  // Create Screen & Stories / Notes + Instants Publishing
  openCreate: (mode?: CreateMode) => void;
  storiesByUser: Record<string, StoryItem[]>;
  storyTrayUsers: User[];
  storySeenMap: Record<string, string>;
  storyResumeMap: Record<string, StoryProgressEntry>;
  storyMuted: boolean;
  setStoryMuted: (val: boolean) => void;
  hasUserUnseenStory: (userId: string) => boolean;
  markStorySeen: (storyId: string) => void;
  saveStoryProgress: (userId: string, storyId: string, pct: number) => void;
  clearUserStoryProgress: (userId: string) => void;
  publishStory: (story: StoryItem, mediaSource?: File | Blob) => Promise<boolean>;
  deleteStory: (storyId: string) => Promise<boolean>;
  voteStoryPoll: (storyId: string, optionIndex: number) => Promise<void>;
  undoLastStory: () => void;
  storyToast: { storyId: string; message: string } | null;
  dismissStoryToast: () => void;

  // Unified Notes + Instants Store (tw.moments.v1)
  socialMoments: SocialMoment[];
  publishNote: (input: { text: string; soundId?: string; audience: StoryAudience }) => SocialMoment;
  deleteOwnNote: () => void;
  publishInstantMoment: (input: {
    mediaUrl: string;
    mediaSource?: File | Blob;
    mediaType?: 'image' | 'video';
    audience: StoryAudience;
    caption?: string;
  }) => Promise<SocialMoment | null>;
  replyToMoment: (targetUser: User, quotedText: string | undefined, replyText: string) => void;
  seenInstantIds: string[];
  markInstantSeen: (id: string) => void;
}
