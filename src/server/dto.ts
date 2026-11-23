import type { usersTable } from '../db/schema.ts';
import type { User } from '../types/index.ts';

export type DbUserRow = typeof usersTable.$inferSelect;

export interface ViewerUserFlags {
  hasUnseenStory: boolean;
  isCloseFriend: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
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

export const DEFAULT_USER_SETTINGS: UserSettings = {
  dmPermission: 'everyone',
  commentPermission: 'everyone',
  onlineStatusVisibility: true,
  readReceipts: true,
  quietMode: false,
  sensitiveContentFilter: true,
  twoFactorEnabled: false,
  notifyLikes: true,
  notifyComments: true,
  notifyFollows: true,
  notifyMessages: true,
  notifyOrders: true,
};

export function parseUserSettings(raw: unknown): UserSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_USER_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  const dm =
    obj.dmPermission === 'followers' || obj.dmPermission === 'nobody' || obj.dmPermission === 'everyone'
      ? obj.dmPermission
      : DEFAULT_USER_SETTINGS.dmPermission;
  const cm =
    obj.commentPermission === 'followers' ||
    obj.commentPermission === 'nobody' ||
    obj.commentPermission === 'everyone'
      ? obj.commentPermission
      : DEFAULT_USER_SETTINGS.commentPermission;

  return {
    dmPermission: dm,
    commentPermission: cm,
    onlineStatusVisibility:
      typeof obj.onlineStatusVisibility === 'boolean'
        ? obj.onlineStatusVisibility
        : DEFAULT_USER_SETTINGS.onlineStatusVisibility,
    readReceipts:
      typeof obj.readReceipts === 'boolean' ? obj.readReceipts : DEFAULT_USER_SETTINGS.readReceipts,
    quietMode: typeof obj.quietMode === 'boolean' ? obj.quietMode : DEFAULT_USER_SETTINGS.quietMode,
    sensitiveContentFilter:
      typeof obj.sensitiveContentFilter === 'boolean'
        ? obj.sensitiveContentFilter
        : DEFAULT_USER_SETTINGS.sensitiveContentFilter,
    twoFactorEnabled:
      typeof obj.twoFactorEnabled === 'boolean'
        ? obj.twoFactorEnabled
        : DEFAULT_USER_SETTINGS.twoFactorEnabled,
    notifyLikes:
      typeof obj.notifyLikes === 'boolean' ? obj.notifyLikes : DEFAULT_USER_SETTINGS.notifyLikes,
    notifyComments:
      typeof obj.notifyComments === 'boolean'
        ? obj.notifyComments
        : DEFAULT_USER_SETTINGS.notifyComments,
    notifyFollows:
      typeof obj.notifyFollows === 'boolean'
        ? obj.notifyFollows
        : DEFAULT_USER_SETTINGS.notifyFollows,
    notifyMessages:
      typeof obj.notifyMessages === 'boolean'
        ? obj.notifyMessages
        : DEFAULT_USER_SETTINGS.notifyMessages,
    notifyOrders:
      typeof obj.notifyOrders === 'boolean' ? obj.notifyOrders : DEFAULT_USER_SETTINGS.notifyOrders,
  };
}

export interface PublicUserDto extends User {
  handle?: string;
  kind?: 'person' | 'bot';
  status?: 'active' | 'suspended' | 'deleted';
  createdAt?: string;
  canvasConfig?: Record<string, unknown> | null;
  botDescription?: string;
  botShortDescription?: string;
  botPrivacyMode?: boolean;
  botCanJoinGroups?: boolean;
  botIsListed?: boolean;
}

export interface SelfUserDto extends PublicUserDto {
  email?: string;
  maskedPhone?: string;
  hasPassword?: boolean;
  settings?: UserSettings;
  walletBalance?: number;
  birthYear?: number;
  phoneVerifiedAt?: string;
  createdAt?: string;
}

export function maskE164Phone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 6) return '+964 ••••••';
  const last2 = digits.slice(-2);
  if (digits.startsWith('964') && digits.length >= 12) {
    return `+964 ${digits[3]}•• ••• ••${last2}`;
  }
  return `+${digits.slice(0, 3)} •••••${last2}`;
}

export function toPublicUser(
  row: DbUserRow,
  flags: Partial<ViewerUserFlags> = {}
): PublicUserDto {
  const canonicalHandle = row.handle ?? row.username;
  return {
    id: row.id,
    username: canonicalHandle,
    handle: canonicalHandle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    coverUrl: row.coverUrl ?? undefined,
    bio: row.bio,
    province: row.province,
    city: row.city ?? undefined,
    isVerified: row.isVerified,
    verifiedKind: row.verifiedKind as User['verifiedKind'],
    accountType: row.accountType as User['accountType'],
    role: row.role as User['role'],
    kind: (row.kind as 'person' | 'bot') ?? 'person',
    status: (row.status as 'active' | 'suspended' | 'deleted') ?? 'active',
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    canvasConfig: (row.canvasConfigJson as Record<string, unknown> | null) ?? null,
    followersCount: row.followersCount,
    followingCount: row.followingCount,
    postsCount: row.postsCount,
    hasActiveStory: row.hasActiveStory,
    hasUnseenStory: Boolean(flags.hasUnseenStory),
    isCloseFriend: Boolean(flags.isCloseFriend),
    isFollowing: Boolean(flags.isFollowing),
    isFollowedBy: Boolean(flags.isFollowedBy),
    ...(row.kind === 'bot'
      ? {
          botDescription: row.botDescription ?? undefined,
          botShortDescription: row.botShortDescription ?? undefined,
          botPrivacyMode: row.botPrivacyMode,
          botCanJoinGroups: row.botCanJoinGroups,
          botIsListed: row.botIsListed,
        }
      : {}),
  };
}

export function toSelfUser(
  row: DbUserRow,
  flags: Partial<ViewerUserFlags> = {},
  decryptedPhone?: string | null
): SelfUserDto {
  const pub = toPublicUser(row, flags);
  return {
    ...pub,
    email: row.email ?? undefined,
    maskedPhone: decryptedPhone ? maskE164Phone(decryptedPhone) : undefined,
    hasPassword: Boolean(row.passwordHash),
    settings: parseUserSettings(row.settingsJson),
    walletBalance: row.walletBalance ?? 0,
    birthYear: row.birthYear ?? undefined,
    phoneVerifiedAt: row.phoneVerifiedAt ? row.phoneVerifiedAt.toISOString() : undefined,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
  };
}
