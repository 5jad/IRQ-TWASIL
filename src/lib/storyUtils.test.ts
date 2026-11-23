import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTE_COUNTER_THRESHOLD,
  NOTE_MAX_CHARS,
  appendStorySorted,
  buildStoryTrayUsers,
  computeMomentExpiryIso,
  filterActiveMoments,
  findNextUnseenUserIndex,
  getScopedStorageKey,
  inferPublishKindFromMode,
  pruneStoryStorage,
  readMomentsStorage,
  readStoryStorage,
  resolveStartStoryIndex,
  sortStoriesOldestFirst,
  upsertOwnNote,
  writeMomentsStorage,
  writeStoryStorage,
} from './storyUtils.ts';
import type { SocialMoment, StoryItem, User } from '../types/index.ts';

function makeUser(id: string, name: string): User {
  return {
    id,
    username: id,
    displayName: name,
    avatarUrl: '/seed/avatar-1.svg',
    bio: '',
    province: 'بغداد',
    isVerified: false,
    verifiedKind: 'none',
    accountType: 'personal',
    followersCount: 10,
    followingCount: 10,
    postsCount: 1,
  };
}

function makeStory(id: string, authorId: string, offsetMs: number, baseMs = 1_800_000_000_000): StoryItem {
  return {
    id,
    authorId,
    kind: 'story',
    mediaUrl: '/seed/post-1.svg',
    mediaType: 'image',
    durationSec: 5,
    audience: 'everyone',
    mode: 'story',
    createdAt: new Date(baseMs + offsetMs).toISOString(),
    expiresAt: new Date(baseMs + offsetMs + 86_400_000).toISOString(),
  };
}

describe('Part A — entry mode kind assignment', () => {
  it('sets publish kind strictly from entry mode, never file type', () => {
    assert.equal(inferPublishKindFromMode('story'), 'story');
    assert.equal(inferPublishKindFromMode('reel'), 'reel');
    assert.equal(inferPublishKindFromMode('instants'), 'instant');
    assert.equal(inferPublishKindFromMode('post'), 'post');
  });
});

describe('Part B — Notes & Moments lifecycle and 24h expiry', () => {
  it('replaces existing note on upsert and enforces 60 char max', () => {
    const longText = 'أ'.repeat(85);
    const first = upsertOwnNote([], 'u-me', { text: longText, audience: 'everyone' }, 1000);
    assert.equal(first.length, 1);
    assert.equal(first[0]!.text?.length, NOTE_MAX_CHARS);
    assert.equal(NOTE_COUNTER_THRESHOLD, 45);

    const second = upsertOwnNote(first, 'u-me', { text: 'ملاحظة محدثة', soundId: 'snd-2', audience: 'close-friends' }, 2000);
    assert.equal(second.length, 1);
    assert.equal(second[0]!.text, 'ملاحظة محدثة');
    assert.equal(second[0]!.soundId, 'snd-2');
    assert.equal(second[0]!.audience, 'close-friends');
  });

  it('drops notes and instants expired after 24h using Date.now', () => {
    const now = 1_800_000_000_000;
    const moments: SocialMoment[] = [
      {
        id: 'm-fresh',
        kind: 'note',
        authorId: 'u-1',
        text: 'طازج',
        audience: 'everyone',
        createdAt: new Date(now).toISOString(),
        expiresAt: computeMomentExpiryIso(now),
      },
      {
        id: 'm-stale',
        kind: 'instant',
        authorId: 'u-2',
        mediaUrl: '/seed/post-2.svg',
        audience: 'everyone',
        createdAt: new Date(now - 25 * 3600 * 1000).toISOString(),
        expiresAt: new Date(now - 3600 * 1000).toISOString(),
      },
    ];

    const activeAtNow = filterActiveMoments(moments, now);
    assert.deepEqual(
      activeAtNow.map((m) => m.id),
      ['m-fresh']
    );

    // Advance mock clock 24h + 1s: fresh note is now expired
    const after24h = now + 24 * 3600 * 1000 + 1000;
    const realNow = Date.now;
    mock.method(Date, 'now', () => after24h);
    try {
      const activeAfter24h = filterActiveMoments(moments, Date.now());
      assert.equal(activeAfter24h.length, 0);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('Part D — Story ordering, tray queue, resume, and storage resilience', () => {
  it('sorts stories oldest to newest and appends new stories at the end', () => {
    const s3 = makeStory('s3', 'u-1', -3600_000);
    const s1 = makeStory('s1', 'u-1', -9 * 3600_000);
    const s2 = makeStory('s2', 'u-1', -5 * 3600_000);

    const sorted = sortStoriesOldestFirst([s3, s1, s2]);
    assert.deepEqual(
      sorted.map((s) => s.id),
      ['s1', 's2', 's3']
    );

    const s4 = makeStory('s4', 'u-1', 0);
    const appended = appendStorySorted(sorted, s4);
    assert.deepEqual(
      appended.map((s) => s.id),
      ['s1', 's2', 's3', 's4']
    );
  });

  it('orders tray unseen users newest-first, then all-seen users newest-first', () => {
    const u1 = makeUser('u-1', 'سارة');
    const u2 = makeUser('u-2', 'حرفيات');
    const u3 = makeUser('u-3', 'عمر');

    const map: Record<string, StoryItem[]> = {
      'u-1': [makeStory('s1a', 'u-1', -9000), makeStory('s1b', 'u-1', -1000)],
      'u-2': [makeStory('s2a', 'u-2', -4000)],
      'u-3': [makeStory('s3a', 'u-3', -500)],
    };

    // Suppose u-3's only story is seen; u-1 and u-2 have unseen stories; u-1's newest (-1000) > u-2's (-4000)
    const seen = { s3a: new Date().toISOString() };
    const tray = buildStoryTrayUsers('u-me', [makeUser('u-me', 'أنا'), u1, u2, u3], map, seen, 1_800_000_000_000);
    assert.deepEqual(
      tray.map((u) => u.id),
      ['u-1', 'u-2', 'u-3']
    );
  });

  it('resolves start index: first unseen, resume mid-way, replay from 0, or jump to newly added unseen', () => {
    const items = [
      makeStory('a', 'u-1', -9000),
      makeStory('b', 'u-1', -5000),
      makeStory('c', 'u-1', -1000),
    ];

    // All unseen -> index 0
    assert.equal(resolveStartStoryIndex(items, {}), 0);

    // First seen, left mid-way on 'b' -> resumes at 1
    assert.equal(
      resolveStartStoryIndex(items, { a: '2026-01-01T00:00:00Z' }, { storyId: 'b', pct: 45 }),
      1
    );

    // All seen -> replay from 0
    assert.equal(
      resolveStartStoryIndex(items, { a: 't', b: 't', c: 't' }),
      0
    );

    // User saw all 3, then 'd' is published later -> lands on index 3 ('d')
    const withNew = [...items, makeStory('d', 'u-1', 0)];
    assert.equal(
      resolveStartStoryIndex(withNew, { a: 't', b: 't', c: 't' }),
      3
    );
  });

  it('skips fully-seen users when advancing to next unseen user in queue', () => {
    const u1 = makeUser('u-1', 'سارة');
    const u2 = makeUser('u-2', 'حرفيات');
    const u3 = makeUser('u-3', 'عمر');
    const map: Record<string, StoryItem[]> = {
      'u-1': [makeStory('s1', 'u-1', -3000)],
      'u-2': [makeStory('s2', 'u-2', -2000)],
      'u-3': [makeStory('s3', 'u-3', -1000)],
    };
    const seen = { s2: '2026-01-01T00:00:00Z' };
    const queue = [u1, u2, u3];

    assert.equal(findNextUnseenUserIndex(queue, 0, map, seen, 1_800_000_000_000), 2);
    assert.equal(findNextUnseenUserIndex(queue, 2, map, seen, 1_800_000_000_000), -1);
  });

  it('prunes expired or missing story IDs and survives blocked localStorage', () => {
    const activeStory = makeStory('live-1', 'u-1', -1000, 1_800_000_000_000);
    const pruned = pruneStoryStorage(
      {
        seen: { 'live-1': 't', 'expired-9': 't' },
        progress: { 'u-1': { storyId: 'live-1', pct: 50 }, 'u-2': { storyId: 'expired-9', pct: 20 } },
      },
      { 'u-1': [activeStory] },
      1_800_000_000_000
    );
    assert.deepEqual(Object.keys(pruned.seen), ['live-1']);
    assert.deepEqual(Object.keys(pruned.progress), ['u-1']);

    // Simulate throwing localStorage
    const origWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: {
        get localStorage() {
          throw new Error('SecurityError');
        },
      },
      configurable: true,
    });
    try {
      assert.deepEqual(readStoryStorage(), { seen: {}, progress: {} });
      assert.doesNotThrow(() => writeStoryStorage({ seen: {}, progress: {} }));
      assert.doesNotThrow(() => writeMomentsStorage([]));
      assert.equal(readMomentsStorage([], 1_800_000_000_000).length, 0);
    } finally {
      Object.defineProperty(globalThis, 'window', { value: origWindow, configurable: true });
    }
  });

  it('isolates stories and moments storage per userId and removes legacy unscoped keys', () => {
    const store = new Map<string, string>([
      ['tw.stories.v1', JSON.stringify({ seen: { 'old-story': '2026-01-01T00:00:00Z' }, progress: {} })],
      ['tw.moments.v1', JSON.stringify([])],
    ]);
    const origWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => {
            store.set(k, v);
          },
          removeItem: (k: string) => {
            store.delete(k);
          },
        },
      },
      configurable: true,
    });

    try {
      assert.equal(getScopedStorageKey('tw.stories.v1', 'u-new'), 'tw.stories.v1:u-new');
      assert.equal(getScopedStorageKey('tw.stories.v1', 'guest'), 'tw.stories.v1');

      writeStoryStorage({ seen: { s1: '2026-01-02T00:00:00Z' }, progress: {} }, 'u-a');
      assert.equal(store.has('tw.stories.v1'), false);
      assert.deepEqual(Object.keys(readStoryStorage(undefined, 'u-a').seen), ['s1']);
      assert.deepEqual(readStoryStorage(undefined, 'u-b'), { seen: {}, progress: {} });

      const now = 1_800_000_000_000;
      const momentA: SocialMoment = {
        id: 'note-a',
        kind: 'note',
        authorId: 'u-a',
        text: 'ملاحظة أ',
        audience: 'everyone',
        createdAt: new Date(now).toISOString(),
        expiresAt: computeMomentExpiryIso(now),
      };
      writeMomentsStorage([momentA], 'u-a');
      assert.equal(store.has('tw.moments.v1'), false);
      assert.equal(readMomentsStorage([], now, 'u-a').length, 1);
      assert.equal(readMomentsStorage([], now, 'u-b').length, 0);
    } finally {
      Object.defineProperty(globalThis, 'window', { value: origWindow, configurable: true });
    }
  });
});
