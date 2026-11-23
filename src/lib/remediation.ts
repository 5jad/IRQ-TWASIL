import type { AppNotification, PostComment, Product, User } from '../types/index.ts';
import { arabicTextMatches } from './arabicSearch.ts';

export interface StoryCanvasFormatResolution {
  skipCanvasRasterize: boolean;
  exportMime: 'image/gif' | 'image/png' | 'image/jpeg';
  ext: 'gif' | 'png' | 'jpg';
  preserveAlpha: boolean;
}

export function resolveStoryCanvasFormat(
  mime: string,
  hasTransparency = false
): StoryCanvasFormatResolution {
  const norm = mime.split(';')[0]!.trim().toLowerCase();
  if (norm === 'image/gif') {
    return {
      skipCanvasRasterize: true,
      exportMime: 'image/gif',
      ext: 'gif',
      preserveAlpha: true,
    };
  }
  if (norm === 'image/png' || hasTransparency) {
    return {
      skipCanvasRasterize: false,
      exportMime: 'image/png',
      ext: 'png',
      preserveAlpha: true,
    };
  }
  return {
    skipCanvasRasterize: false,
    exportMime: 'image/jpeg',
    ext: 'jpg',
    preserveAlpha: false,
  };
}

export type NotificationFilterTab = 'all' | 'likes' | 'orders' | 'system';

export function filterNotificationsByTab(
  notifications: AppNotification[],
  tab: NotificationFilterTab
): AppNotification[] {
  if (tab === 'all') return notifications;
  if (tab === 'likes') {
    return notifications.filter(
      (n) => n.kind === 'like' || n.kind === 'comment' || n.kind === 'follow'
    );
  }
  if (tab === 'orders') {
    return notifications.filter((n) => n.kind === 'order');
  }
  return notifications.filter((n) => n.kind === 'system');
}

export function buildCommentTree(flatComments: PostComment[]): PostComment[] {
  const byId = new Map<string, PostComment>();
  for (const c of flatComments) {
    byId.set(c.id, { ...c, replies: [] });
  }

  const roots: PostComment[] = [];
  for (const c of flatComments) {
    const node = byId.get(c.id)!;
    if (c.parentId && c.parentId !== c.id && byId.has(c.parentId)) {
      const parent = byId.get(c.parentId)!;
      parent.replies = parent.replies ?? [];
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function resolveConversationPeer(input: {
  viewerId: string;
  isGroup: boolean;
  memberUsers: User[];
  storedTitle: string;
  storedAvatarUrl: string;
  storedIsOnline: boolean;
  lastSeenMsByUserId?: Record<string, number>;
  onlineVisibilityByUserId?: Record<string, boolean>;
  nowMs?: number;
}): {
  peerId?: string;
  title: string;
  avatarUrl: string;
  isBot: boolean;
  botId?: string;
  isOnline: boolean;
} {
  if (!input.isGroup) {
    const peer = input.memberUsers.find((u) => u.id !== input.viewerId) ?? input.memberUsers[0];
    if (peer) {
      const isBot = peer.kind === 'bot';
      const nowMs = input.nowMs ?? Date.now();
      let isOnline = false;
      if (isBot) {
        isOnline = true;
      } else if (input.onlineVisibilityByUserId?.[peer.id] === false) {
        isOnline = false;
      } else if (typeof input.lastSeenMsByUserId?.[peer.id] === 'number') {
        isOnline = nowMs - input.lastSeenMsByUserId[peer.id]! <= 5 * 60 * 1000;
      } else {
        isOnline = Boolean(input.storedIsOnline);
      }

      return {
        peerId: peer.id,
        title: peer.displayName,
        avatarUrl: peer.avatarUrl,
        isBot,
        botId: isBot ? peer.id : undefined,
        isOnline,
      };
    }
  }

  return {
    peerId: undefined,
    title: input.storedTitle,
    avatarUrl: input.storedAvatarUrl,
    isBot: false,
    botId: undefined,
    isOnline: Boolean(input.storedIsOnline),
  };
}

export function canSendDirectMessage(input: {
  dmPermission?: 'everyone' | 'followers' | 'nobody';
  senderFollowsRecipient?: boolean;
  isBot?: boolean;
}): boolean {
  if (input.isBot) return true;
  const perm = input.dmPermission ?? 'everyone';
  if (perm === 'everyone') return true;
  if (perm === 'nobody') return false;
  return Boolean(input.senderFollowsRecipient);
}

export function filterProducts(
  products: Product[],
  query: string,
  category: string
): Product[] {
  const normCat = category.trim();
  return products.filter((p) => {
    if (normCat && normCat !== 'الكل') {
      const pCat = (p.category || 'أخرى').trim();
      if (pCat !== normCat) return false;
    }
    if (!query.trim()) return true;
    const hay = `${p.title} ${p.shopName} ${p.city} ${p.province} ${p.category ?? ''}`;
    return arabicTextMatches(hay, query);
  });
}
