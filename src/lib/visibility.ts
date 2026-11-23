import type { ChatConversation, StoryAudience } from '../types';

export interface VisibilityContext {
  viewerId: string | null;
  followingSet: ReadonlySet<string>;
  closeFriendOfSet: ReadonlySet<string>;
  blockedIds: ReadonlySet<string>;
}

export function canViewerSeePost(
  authorId: string,
  audience: string | null | undefined,
  ctx: VisibilityContext
): boolean {
  if (ctx.blockedIds.has(authorId)) return false;
  if (!audience || audience === 'everyone') return true;
  if (!ctx.viewerId) return false;
  if (authorId === ctx.viewerId) return true;
  if (audience === 'followers') {
    return ctx.followingSet.has(authorId);
  }
  if (audience === 'friends' || audience === 'close-friends') {
    return ctx.closeFriendOfSet.has(authorId);
  }
  return false;
}

export function canViewerSeeStory(
  authorId: string,
  audience: StoryAudience | string,
  recipientIds: readonly string[] | undefined,
  ctx: VisibilityContext
): boolean {
  if (ctx.blockedIds.has(authorId)) return false;
  if (audience === 'everyone') return true;
  if (!ctx.viewerId) return false;
  if (authorId === ctx.viewerId) return true;
  if (audience === 'close-friends') {
    return ctx.closeFriendOfSet.has(authorId);
  }
  if (audience === 'followers') {
    return ctx.followingSet.has(authorId);
  }
  if (audience === 'custom') {
    if (recipientIds && recipientIds.length > 0) {
      return recipientIds.includes(ctx.viewerId);
    }
    // Fail closed to author + close friends if no explicit recipients were stored
    return ctx.closeFriendOfSet.has(authorId);
  }
  return false;
}

export function canViewerSeeMoment(
  authorId: string,
  audience: StoryAudience | string,
  ctx: VisibilityContext
): boolean {
  if (ctx.blockedIds.has(authorId)) return false;
  if (audience === 'everyone') return true;
  if (!ctx.viewerId) return false;
  if (authorId === ctx.viewerId) return true;
  if (audience === 'close-friends' || audience === 'custom') {
    return ctx.closeFriendOfSet.has(authorId);
  }
  if (audience === 'followers') {
    return ctx.followingSet.has(authorId);
  }
  return false;
}

export function shouldRequireTwoFactorLogin(params: {
  twoFactorEnabled: boolean;
  phoneHmac: string | null | undefined;
  phoneEnc: string | null | undefined;
}): boolean {
  return Boolean(params.twoFactorEnabled && params.phoneHmac && params.phoneEnc);
}

export function findDirectConversation(
  conversations: readonly ChatConversation[],
  targetUserId: string
): ChatConversation | undefined {
  return conversations.find(
    (c) =>
      c.peerId === targetUserId ||
      (!c.isGroup && Array.isArray(c.memberIds) && c.memberIds.includes(targetUserId))
  );
}
