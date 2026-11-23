import type {
  CreateMode,
  PublishKind,
  SocialMoment,
  StoryItem,
  StoryProgressEntry,
  StoryProgressStorage,
  User,
} from '../types';

export const STORIES_STORAGE_KEY = 'tw.stories.v1';
export const STORY_MUTED_STORAGE_KEY = 'tw.story.muted';
export const MOMENTS_STORAGE_KEY = 'tw.moments.v1';

export function getScopedStorageKey(baseKey: string, userId?: string | null): string {
  const clean = typeof userId === 'string' ? userId.trim() : '';
  if (!clean || clean === 'guest') return baseKey;
  return `${baseKey}:${clean}`;
}

export const NOTE_MAX_CHARS = 60;
export const NOTE_COUNTER_THRESHOLD = 45;
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function inferPublishKindFromMode(mode: CreateMode): PublishKind {
  if (mode === 'instants') return 'instant';
  if (mode === 'post') return 'post';
  if (mode === 'reel') return 'reel';
  return 'story';
}

export function sortStoriesOldestFirst(items: StoryItem[]): StoryItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    if (Number.isFinite(ta)) return -1;
    if (Number.isFinite(tb)) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function appendStorySorted(list: StoryItem[], story: StoryItem): StoryItem[] {
  const deduped = list.filter((item) => item.id !== story.id);
  return sortStoriesOldestFirst([...deduped, story]);
}

export function isNotExpired(expiresAt: string | undefined, nowMs: number = Date.now()): boolean {
  if (!expiresAt) return true;
  const ts = Date.parse(expiresAt);
  if (!Number.isFinite(ts)) return true;
  return ts > nowMs;
}

export function filterActiveStories(items: StoryItem[], nowMs: number = Date.now()): StoryItem[] {
  return sortStoriesOldestFirst(items.filter((item) => isNotExpired(item.expiresAt, nowMs)));
}

export function emptyStoryStorage(): StoryProgressStorage {
  return { seen: {}, progress: {} };
}

export function readStoryStorage(
  activeStoryIds?: Set<string>,
  userId?: string | null
): StoryProgressStorage {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return emptyStoryStorage();
    }
    const key = getScopedStorageKey(STORIES_STORAGE_KEY, userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return emptyStoryStorage();
    const parsed = JSON.parse(raw) as Partial<StoryProgressStorage> | null;
    if (!parsed || typeof parsed !== 'object') return emptyStoryStorage();

    const seen: Record<string, string> = {};
    if (parsed.seen && typeof parsed.seen === 'object') {
      for (const [id, iso] of Object.entries(parsed.seen)) {
        if (typeof iso === 'string' && (!activeStoryIds || activeStoryIds.has(id))) {
          seen[id] = iso;
        }
      }
    }

    const progress: Record<string, StoryProgressEntry> = {};
    if (parsed.progress && typeof parsed.progress === 'object') {
      for (const [uid, entry] of Object.entries(parsed.progress)) {
        if (
          entry &&
          typeof entry.storyId === 'string' &&
          typeof entry.pct === 'number' &&
          Number.isFinite(entry.pct) &&
          (!activeStoryIds || activeStoryIds.has(entry.storyId))
        ) {
          progress[uid] = {
            storyId: entry.storyId,
            pct: Math.max(0, Math.min(100, entry.pct)),
          };
        }
      }
    }

    return { seen, progress };
  } catch {
    return emptyStoryStorage();
  }
}

export function writeStoryStorage(data: StoryProgressStorage, userId?: string | null): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = getScopedStorageKey(STORIES_STORAGE_KEY, userId);
      window.localStorage.setItem(key, JSON.stringify(data));
      if (userId && userId !== 'guest') {
        window.localStorage.removeItem(STORIES_STORAGE_KEY);
      }
    }
  } catch {}
}

export function pruneStoryStorage(
  data: StoryProgressStorage,
  storiesByUser: Record<string, StoryItem[]>,
  nowMs: number = Date.now()
): StoryProgressStorage {
  const activeIds = new Set<string>();
  for (const items of Object.values(storiesByUser)) {
    for (const item of items) {
      if (isNotExpired(item.expiresAt, nowMs)) {
        activeIds.add(item.id);
      }
    }
  }
  const seen: Record<string, string> = {};
  for (const [id, iso] of Object.entries(data.seen)) {
    if (activeIds.has(id)) seen[id] = iso;
  }
  const progress: Record<string, StoryProgressEntry> = {};
  for (const [uid, entry] of Object.entries(data.progress)) {
    if (activeIds.has(entry.storyId)) progress[uid] = entry;
  }
  return { seen, progress };
}

export function readStoryMuted(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(STORY_MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeStoryMuted(muted: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORY_MUTED_STORAGE_KEY, muted ? 'true' : 'false');
    }
  } catch {}
}

export function computeMomentExpiryIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + TWENTY_FOUR_HOURS_MS).toISOString();
}

export function filterActiveMoments(
  moments: SocialMoment[],
  nowMs: number = Date.now()
): SocialMoment[] {
  return moments.filter((m) => isNotExpired(m.expiresAt, nowMs));
}

export function readMomentsStorage(
  fallbackSeed: SocialMoment[],
  nowMs: number = Date.now(),
  userId?: string | null
): SocialMoment[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return filterActiveMoments(fallbackSeed, nowMs);
    }
    const key = getScopedStorageKey(MOMENTS_STORAGE_KEY, userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return filterActiveMoments(fallbackSeed, nowMs);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return filterActiveMoments(fallbackSeed, nowMs);
    const valid = parsed.filter(
      (m): m is SocialMoment =>
        Boolean(m) &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        (m.kind === 'note' || m.kind === 'instant') &&
        typeof m.authorId === 'string' &&
        typeof m.createdAt === 'string' &&
        typeof m.expiresAt === 'string'
    );
    return filterActiveMoments(valid, nowMs);
  } catch {
    return filterActiveMoments(fallbackSeed, nowMs);
  }
}

export function writeMomentsStorage(moments: SocialMoment[], userId?: string | null): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = getScopedStorageKey(MOMENTS_STORAGE_KEY, userId);
      window.localStorage.setItem(key, JSON.stringify(moments));
      if (userId && userId !== 'guest') {
        window.localStorage.removeItem(MOMENTS_STORAGE_KEY);
      }
    }
  } catch {}
}

export function hasUserUnseenStories(
  userStories: StoryItem[],
  seenMap: Record<string, string>,
  nowMs: number = Date.now()
): boolean {
  const active = filterActiveStories(userStories, nowMs);
  return active.some((st) => !seenMap[st.id]);
}

export function latestStoryTs(items: StoryItem[]): number {
  let max = 0;
  for (const s of items) {
    const t = Date.parse(s.createdAt);
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max;
}

/**
 * Tray & Queue order:
 * - Other users who currently have active stories:
 *   unseen first (sorted by latest story timestamp desc),
 *   then all-seen (sorted by latest story timestamp desc).
 *   Own user ("قصتك") is always rendered separately first in the tray.
 */
export function buildStoryTrayUsers(
  currentUserId: string,
  users: User[],
  storiesByUser: Record<string, StoryItem[]>,
  seenMap: Record<string, string>,
  nowMs: number = Date.now()
): User[] {
  const candidates = users
    .filter((u) => u.id !== currentUserId)
    .map((u) => {
      const items = filterActiveStories(storiesByUser[u.id] ?? [], nowMs);
      return {
        user: u,
        items,
        unseen: items.some((s) => !seenMap[s.id]),
        newestTs: latestStoryTs(items),
      };
    })
    .filter((entry) => entry.items.length > 0);

  candidates.sort((a, b) => {
    if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;
    return b.newestTs - a.newestTs;
  });

  return candidates.map((c) => c.user);
}

/**
 * Resolve starting story index when opening a user's stories:
 * 1. If there are unseen stories:
 *    - If savedProgress points to an unseen story with pct < 100, resume at that index.
 *    - Otherwise start at the first unseen story index.
 * 2. If all stories are already seen:
 *    - If savedProgress points to a valid story and it is not finished (<100), resume it.
 *    - Otherwise replay from index 0.
 */
export function resolveStartStoryIndex(
  userStories: StoryItem[],
  seenMap: Record<string, string>,
  savedProgress?: StoryProgressEntry
): number {
  if (userStories.length === 0) return 0;

  const firstUnseenIdx = userStories.findIndex((s) => !seenMap[s.id]);
  if (firstUnseenIdx !== -1) {
    if (savedProgress && savedProgress.pct > 0 && savedProgress.pct < 100) {
      const savedIdx = userStories.findIndex((s) => s.id === savedProgress.storyId);
      if (savedIdx !== -1 && !seenMap[userStories[savedIdx]!.id]) {
        return savedIdx;
      }
    }
    return firstUnseenIdx;
  }

  if (savedProgress && savedProgress.pct > 0 && savedProgress.pct < 100) {
    const savedIdx = userStories.findIndex((s) => s.id === savedProgress.storyId);
    if (savedIdx !== -1) return savedIdx;
  }

  return 0;
}

/**
 * Finds the next user in `queue` strictly after `afterIndex` who has at least one unseen story.
 * Returns -1 when no unseen user remains (viewer should close).
 */
export function findNextUnseenUserIndex(
  queue: User[],
  afterIndex: number,
  storiesByUser: Record<string, StoryItem[]>,
  seenMap: Record<string, string>,
  nowMs: number = Date.now()
): number {
  for (let i = afterIndex + 1; i < queue.length; i += 1) {
    const uid = queue[i]!.id;
    if (hasUserUnseenStories(storiesByUser[uid] ?? [], seenMap, nowMs)) {
      return i;
    }
  }
  return -1;
}

export function upsertOwnNote(
  moments: SocialMoment[],
  authorId: string,
  input: { text: string; soundId?: string; audience: StoryItem['audience'] },
  nowMs: number = Date.now()
): SocialMoment[] {
  const withoutOwnNote = moments.filter((m) => !(m.kind === 'note' && m.authorId === authorId));
  const note: SocialMoment = {
    id: `note-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'note',
    authorId,
    text: input.text.trim().slice(0, NOTE_MAX_CHARS),
    soundId: input.soundId || undefined,
    audience: input.audience,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: computeMomentExpiryIso(nowMs),
  };
  return [note, ...withoutOwnNote];
}
