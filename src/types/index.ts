/**
 * IRQ تواصل — Type Definitions
 */

export type Theme = 'system' | 'light' | 'dark' | 'calm' | 'high-contrast';
export type AccentPreset = 'teal' | 'copper' | 'indigo' | 'green' | 'rose' | 'violet' | 'slate' | 'gold';
export type Handedness = 'center' | 'right' | 'left';
export type NumeralSystem = 'arabic-indic' | 'western';

export type AppRoute =
  | 'home'
  | 'explore'
  | 'reels'
  | 'video'
  | 'live'
  | 'messages'
  | 'communities'
  | 'market'
  | 'notifications'
  | 'wallet'
  | 'profile'
  | 'canvas'
  | 'admin'
  | 'settings'
  | 'gallery'
  | 'auth'
  | 'saved'
  | 'create';

export type CreateMode = 'post' | 'story' | 'instants' | 'reel' | 'live';
export type PublishKind = 'story' | 'instant' | 'note' | 'post' | 'reel';
export type CameraFilterId = 'none' | 'tigris' | 'palms' | 'sun' | 'vintage' | 'baghdad-night';
export type StoryAudience = 'everyone' | 'close-friends' | 'followers' | 'custom';

export interface StoryOverlayItem {
  id: string;
  kind: 'text' | 'sticker';
  text?: string;
  colorToken?: string;
  fontClass?: string;
  align?: 'start' | 'center' | 'end';
  stickerKind?: 'location' | 'mention' | 'poll' | 'question' | 'countdown' | 'heritage';
  motifId?: string;
  pollOptions?: string[];
  xPct: number;
  yPct: number;
  scale: number;
  rotation: number;
}

export interface StoryItem {
  id: string;
  authorId: string;
  kind?: PublishKind;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'text';
  caption?: string;
  soundId?: string;
  soundTitle?: string;
  videoVolume?: number;
  musicVolume?: number;
  soundStartSec?: number;
  durationSec: number;
  audience: StoryAudience;
  recipientIds?: string[];
  mode: CreateMode;
  createdAt: string;
  expiresAt: string;
  expiresHint?: string;
  bgGradient?: string;
  overlays?: StoryOverlayItem[];
  pollVotes?: number[];
  userVotedOptionIndex?: number;
}

export interface SocialMoment {
  id: string;
  kind: 'note' | 'instant';
  authorId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  soundId?: string;
  audience: StoryAudience;
  createdAt: string;
  expiresAt: string;
}

export interface StoryProgressEntry {
  storyId: string;
  pct: number;
}

export interface StoryProgressStorage {
  seen: Record<string, string>;
  progress: Record<string, StoryProgressEntry>;
}

export interface PostComment {
  id: string;
  parentId?: string;
  author: User;
  text: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
  replies?: PostComment[];
}

export interface UserSettings {
  dmPermission: 'everyone' | 'followers' | 'nobody';
  commentPermission: 'everyone' | 'followers' | 'nobody';
  onlineStatusVisibility: boolean;
  readReceipts: boolean;
  quietMode: boolean;
  sensitiveContentFilter: boolean;
  twoFactorEnabled: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyMessages: boolean;
  notifyOrders: boolean;
}

export interface User {
  id: string;
  username: string;
  handle?: string;
  email?: string;
  displayName: string;
  avatarUrl: string;
  coverUrl?: string;
  bio: string;
  province: string;
  city?: string;
  isVerified: boolean;
  verifiedKind: 'none' | 'identity' | 'merchant' | 'official';
  accountType: 'personal' | 'creator' | 'merchant';
  role?: 'user' | 'moderator' | 'admin';
  kind?: 'person' | 'bot';
  status?: 'active' | 'suspended' | 'deleted';
  phoneMasked?: string;
  maskedPhone?: string;
  hasPassword?: boolean;
  settings?: UserSettings;
  walletBalance?: number;
  canvasConfig?: Record<string, unknown> | null;
  createdAt?: string;
  birthYear?: number;
  botCount?: number;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  hasActiveStory?: boolean;
  hasUnseenStory?: boolean;
  isCloseFriend?: boolean;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  botDescription?: string;
  botShortDescription?: string;
  botPrivacyMode?: boolean;
  botCanJoinGroups?: boolean;
  botIsListed?: boolean;
}

export type ReportTargetType =
  | 'post'
  | 'comment'
  | 'user'
  | 'message'
  | 'story'
  | 'product'
  | 'community'
  | 'canvas'
  | 'bot';

export interface PostProduct {
  id: string;
  title: string;
  priceIqd: number;
  shopName: string;
}

export interface Post {
  id: string;
  author: User;
  kind: 'media' | 'text' | 'video' | 'reel' | 'poll';
  text: string;
  media?: {
    url: string;
    aspectRatio: string; // e.g. '4/5', '1/1', '16/9'
    alt?: string;
  }[];
  poll?: {
    question: string;
    options: { text: string; votes: number }[];
    totalVotes: number;
    userVotedIndex?: number;
    expiresInHours: number;
  };
  likesCount: number;
  commentsCount: number;
  comments?: PostComment[];
  repostsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  taggedProducts?: PostProduct[];
  createdAt: string;
  location?: string;
  audioTrack?: string;
  audience?: 'everyone' | 'followers' | 'friends';
  isSponsored?: boolean;
}

export interface ChatConversation {
  id: string;
  peerId?: string;
  memberIds?: string[];
  title: string;
  avatarUrl: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isGroup?: boolean;
  isBot?: boolean;
  botId?: string;
  orderNumber?: string;
}

export interface BotButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface BotReplyMarkup {
  inline_keyboard?: BotButton[][];
  keyboard?: Array<Array<{ text: string } | string>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  remove_keyboard?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  kind: 'text' | 'image' | 'voice' | 'file';
  status: 'sent' | 'delivered' | 'read';
  voiceDuration?: string;
  reaction?: string;
  mediaUrl?: string;
  replyMarkup?: BotReplyMarkup;
}

export interface Product {
  id: string;
  sellerId?: string;
  title: string;
  priceIqd: number;
  compareAtPriceIqd?: number;
  shopName: string;
  shopVerified: boolean;
  city: string;
  province: string;
  category?: string;
  condition: 'new' | 'used';
  imageUrl: string;
  inStock: boolean;
  ratingAvg: number;
  reviewCount: number;
  isWishlisted?: boolean;
}

export interface MarketOrder {
  id: string;
  buyerId: string;
  sellerId?: string;
  productId: string;
  productTitle: string;
  productImageUrl: string;
  priceIqd: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  kind: 'topup' | 'gift_sent' | 'gift_received';
  amountCoins: number;
  description: string;
  relatedUserId?: string;
  createdAt: string;
}

export interface SavedCollection {
  id: string;
  userId: string;
  name: string;
  postIds: string[];
  createdAt: string;
}

export interface CommunityItem {
  id: string;
  creatorId?: string;
  name: string;
  membersCount: number;
  province: string;
  category?: string;
  isPrivate?: boolean;
  isJoined?: boolean;
  description: string;
  icon: string;
}

export interface CommunityMessage {
  id: string;
  communityId: string;
  senderId: string;
  sender?: User;
  channel: 'general' | 'announcements';
  text: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  actor: User;
  kind: 'like' | 'comment' | 'follow' | 'order' | 'system';
  targetText: string;
  time: string;
  isRead: boolean;
  mediaThumbnailUrl?: string;
}
