import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../index.ts';
import { ensureSeeded } from '../seed.ts';
import {
  reactionsTable,
  socialMomentsTable,
  storiesTable,
  storyViewsTable,
  usersTable,
} from '../schema.ts';
import { deleteMediaByIdOrUrl } from '../../server/media.ts';
import { DomainError, claimReadyMediaForUse } from './shared.ts';
import type { SocialMoment, StoryItem, StoryOverlayItem } from '../../types/index.ts';

export async function publishStoryInDb(
  actorId: string,
  input: {
    id: string;
    kind?: 'story' | 'instant' | 'note';
    mediaId?: string;
    mediaType: 'image' | 'video' | 'text';
    caption?: string;
    soundId?: string;
    soundTitle?: string;
    videoVolume?: number;
    musicVolume?: number;
    soundStartSec?: number;
    durationSec: number;
    audience: StoryItem['audience'];
    recipientIds?: string[];
    mode: StoryItem['mode'];
    bgGradient?: string;
    overlays?: StoryOverlayItem[];
  }
) {
  await ensureSeeded();
  const db = getDb();
  const nowTs = Date.now();
  const createdAt = new Date(nowTs).toISOString();
  const expiresAt = new Date(nowTs + 24 * 60 * 60 * 1000).toISOString();

  let mediaUrl = '';
  if (input.mediaType !== 'text') {
    if (!input.mediaId) {
      throw new DomainError(400, 'invalid_media', 'الوسائط مطلوبة');
    }
    const claimed = await claimReadyMediaForUse(
      input.mediaId,
      actorId,
      input.mode === 'instants' ? 'instant' : 'story',
      input.id
    );
    mediaUrl = claimed.publicUrl;
  }

  if (input.mode === 'instants' || input.kind === 'instant') {
    await db.insert(socialMomentsTable).values({
      id: input.id,
      kind: 'instant',
      authorId: actorId,
      text: input.caption ?? null,
      mediaId: input.mediaId ?? null,
      mediaUrl,
      mediaType: input.mediaType === 'video' ? 'video' : 'image',
      soundId: input.soundId ?? null,
      audience: input.audience,
      createdAt,
      expiresAt,
      sortTs: nowTs,
    });
    return { id: input.id, mediaUrl, createdAt, expiresAt };
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(storiesTable)
      .values({
        id: input.id,
        authorId: actorId,
        mediaId: input.mediaId ?? null,
        mediaUrl,
        mediaType: input.mediaType,
        caption: input.caption ?? null,
        soundTitle: input.soundTitle ?? null,
        durationSec: input.durationSec,
        audience: input.audience,
        mode: input.mode,
        createdAt,
        expiresAt,
        bgGradient: input.bgGradient ?? null,
        overlaysJson: {
          items: input.overlays ?? [],
          soundId: input.soundId,
          videoVolume: input.videoVolume,
          musicVolume: input.musicVolume,
          soundStartSec: input.soundStartSec,
          kind: input.kind ?? 'story',
          ...(input.recipientIds && input.recipientIds.length > 0
            ? { recipientIds: input.recipientIds }
            : {}),
        },
        sortTs: nowTs,
      })
      .onConflictDoNothing();

    await tx
      .update(usersTable)
      .set({ hasActiveStory: true })
      .where(eq(usersTable.id, actorId));
  });

  return { id: input.id, mediaUrl, createdAt, expiresAt };
}

export async function deleteStoryInDb(actorId: string, storyId: string, actorRole?: string) {
  await ensureSeeded();
  const db = getDb();
  const [story] = await db
    .select({
      id: storiesTable.id,
      authorId: storiesTable.authorId,
      mediaId: storiesTable.mediaId,
      mediaUrl: storiesTable.mediaUrl,
    })
    .from(storiesTable)
    .where(eq(storiesTable.id, storyId))
    .limit(1);

  if (!story) return null;
  if (story.authorId !== actorId && actorRole !== 'admin' && actorRole !== 'moderator') {
    throw new DomainError(403, 'forbidden', 'لا يمكنك حذف قصة لا تملكها');
  }

  await db.delete(storiesTable).where(eq(storiesTable.id, storyId));

  const nowIso = new Date().toISOString();
  const remaining = await db
    .select({ id: storiesTable.id })
    .from(storiesTable)
    .where(
      and(
        eq(storiesTable.authorId, story.authorId),
        sql`${storiesTable.mode} <> 'reel'`,
        sql`${storiesTable.expiresAt} >= ${nowIso}`
      )
    )
    .limit(1);

  if (remaining.length === 0) {
    await db
      .update(usersTable)
      .set({ hasActiveStory: false })
      .where(eq(usersTable.id, story.authorId));
  }

  await deleteMediaByIdOrUrl(story.mediaId, story.mediaUrl).catch(() => undefined);

  return { deleted: true };
}

export async function markStoryViewedInDb(viewerId: string, storyId: string) {
  const db = getDb();
  await db
    .insert(storyViewsTable)
    .values({ storyId, viewerId })
    .onConflictDoNothing();
  return { ok: true };
}

export async function voteStoryPollInDb(actorId: string, storyId: string, optionIndex: number) {
  await ensureSeeded();
  const db = getDb();
  const [story] = await db
    .select({ id: storiesTable.id, overlaysJson: storiesTable.overlaysJson })
    .from(storiesTable)
    .where(eq(storiesTable.id, storyId))
    .limit(1);
  if (!story) return null;

  const meta = (story.overlaysJson as { items?: StoryOverlayItem[] } | null) ?? {};
  const pollSticker = (meta.items ?? []).find((item) => item.kind === 'sticker' && item.stickerKind === 'poll');
  const options = pollSticker?.pollOptions?.length ? pollSticker.pollOptions : ['نعم', 'لا'];
  if (optionIndex < 0 || optionIndex >= options.length) {
    throw new DomainError(400, 'invalid_poll_option', 'خيار التصويت غير موجود');
  }

  const [existing] = await db
    .select()
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.userId, actorId),
        eq(reactionsTable.targetType, 'story_poll_vote'),
        eq(reactionsTable.targetId, storyId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(reactionsTable)
      .set({ value: String(optionIndex) })
      .where(
        and(
          eq(reactionsTable.userId, actorId),
          eq(reactionsTable.targetType, 'story_poll_vote'),
          eq(reactionsTable.targetId, storyId)
        )
      );
  } else {
    await db.insert(reactionsTable).values({
      userId: actorId,
      targetType: 'story_poll_vote',
      targetId: storyId,
      value: String(optionIndex),
    });
  }

  const allVotes = await db
    .select({ value: reactionsTable.value })
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.targetType, 'story_poll_vote'),
        eq(reactionsTable.targetId, storyId)
      )
    );

  const pollVotes = options.map(() => 0);
  for (const v of allVotes) {
    const idx = Number(v.value);
    if (Number.isInteger(idx) && idx >= 0 && idx < pollVotes.length) {
      pollVotes[idx] += 1;
    }
  }

  return { pollVotes, userVotedOptionIndex: optionIndex };
}

export async function publishNoteInDb(
  actorId: string,
  input: { text: string; audience?: StoryItem['audience'] }
): Promise<SocialMoment> {
  await ensureSeeded();
  const db = getDb();
  const nowTs = Date.now();
  const id = `note-${nowTs}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date(nowTs).toISOString();
  const expiresAt = new Date(nowTs + 24 * 60 * 60 * 1000).toISOString();
  const audience = input.audience ?? 'everyone';

  await db.transaction(async (tx) => {
    await tx
      .delete(socialMomentsTable)
      .where(and(eq(socialMomentsTable.authorId, actorId), eq(socialMomentsTable.kind, 'note')));
    await tx.insert(socialMomentsTable).values({
      id,
      kind: 'note',
      authorId: actorId,
      text: input.text,
      audience,
      createdAt,
      expiresAt,
      sortTs: nowTs,
    });
  });

  return {
    id,
    kind: 'note',
    authorId: actorId,
    text: input.text,
    audience,
    createdAt,
    expiresAt,
  };
}

export async function deleteOwnNoteInDb(actorId: string) {
  const db = getDb();
  await db
    .delete(socialMomentsTable)
    .where(and(eq(socialMomentsTable.authorId, actorId), eq(socialMomentsTable.kind, 'note')));
  return { deleted: true };
}
