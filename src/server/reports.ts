import crypto from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.ts';
import {
  blocksTable,
  commentsTable,
  postsTable,
  reportsTable,
  sessionsTable,
  storiesTable,
  usersTable,
} from '../db/schema.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from './auth.ts';
import { CreateReportSchema, sendApiError, validateBody } from './schemas.ts';
import { socialActionLimiter } from './rateLimit.ts';
import { deleteMediaByIdOrUrl } from './media.ts';

const ResolveReportSchema = z
  .object({
    action: z.enum(['ban', 'dismiss']),
  })
  .strict();

const SuspendUserSchema = z
  .object({
    status: z.enum(['suspended', 'active']).default('suspended'),
  })
  .strict();

async function resolveTargetUserId(targetType: string, targetId: string): Promise<string | null> {
  const db = getDb();
  if (targetType === 'user' || targetType === 'bot') {
    const [u] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1);
    return u?.id ?? null;
  }
  if (targetType === 'post') {
    const [p] = await db
      .select({ authorId: postsTable.authorId })
      .from(postsTable)
      .where(eq(postsTable.id, targetId))
      .limit(1);
    return p?.authorId ?? null;
  }
  if (targetType === 'comment') {
    const [c] = await db
      .select({ authorId: commentsTable.authorId })
      .from(commentsTable)
      .where(eq(commentsTable.id, targetId))
      .limit(1);
    return c?.authorId ?? null;
  }
  if (targetType === 'story') {
    const [s] = await db
      .select({ authorId: storiesTable.authorId })
      .from(storiesTable)
      .where(eq(storiesTable.id, targetId))
      .limit(1);
    return s?.authorId ?? null;
  }
  return null;
}

export function registerReportAndAdminRoutes(app: Express): void {
  app.post(
    '/api/reports',
    requireAuth,
    socialActionLimiter,
    validateBody(CreateReportSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { targetType, targetId, reason, details, alsoBlock } = req.body as {
          targetType: string;
          targetId: string;
          reason: string;
          details: string;
          alsoBlock: boolean;
        };

        const urgent = reason === 'extortion' || reason === 'self-harm';
        const reportId = `rep-${crypto.randomUUID()}`;
        const db = getDb();

        await db.insert(reportsTable).values({
          id: reportId,
          reporterId: authReq.auth!.userId,
          targetType,
          targetId,
          reason,
          details,
          urgent,
          status: 'pending',
        });

        if (alsoBlock) {
          const targetOwnerId = await resolveTargetUserId(targetType, targetId);
          if (targetOwnerId && targetOwnerId !== authReq.auth!.userId) {
            await db
              .insert(blocksTable)
              .values({ blockerId: authReq.auth!.userId, blockedId: targetOwnerId })
              .onConflictDoNothing();
          }
        }

        res.status(201).json({ id: reportId, status: 'pending', urgent });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    '/api/admin/reports',
    requireRole('moderator', 'admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const db = getDb();
        const rows = await db
          .select({
            id: reportsTable.id,
            reporterId: reportsTable.reporterId,
            targetType: reportsTable.targetType,
            targetId: reportsTable.targetId,
            reason: reportsTable.reason,
            details: reportsTable.details,
            urgent: reportsTable.urgent,
            status: reportsTable.status,
            resolvedBy: reportsTable.resolvedBy,
            resolvedAt: reportsTable.resolvedAt,
            createdAt: reportsTable.createdAt,
            reporterDisplayName: usersTable.displayName,
            reporterHandle: usersTable.handle,
          })
          .from(reportsTable)
          .leftJoin(usersTable, eq(reportsTable.reporterId, usersTable.id))
          .orderBy(desc(reportsTable.urgent), desc(reportsTable.createdAt));

        res.json({
          reports: rows.map((r) => ({
            ...r,
            resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
          })),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/admin/reports/:id/resolve',
    requireRole('moderator', 'admin'),
    validateBody(ResolveReportSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const reportId = String(req.params.id);
        const { action } = req.body as { action: 'ban' | 'dismiss' };
        const db = getDb();

        const [report] = await db
          .select()
          .from(reportsTable)
          .where(eq(reportsTable.id, reportId))
          .limit(1);

        if (!report) {
          sendApiError(res, 404, 'not_found', 'البلاغ غير موجود');
          return;
        }

        const nextStatus = action === 'ban' ? 'banned' : 'dismissed';
        const now = new Date();
        const targetOwnerId =
          action === 'ban'
            ? await resolveTargetUserId(report.targetType, report.targetId)
            : null;

        await db.transaction(async (tx) => {
          await tx
            .update(reportsTable)
            .set({
              status: nextStatus,
              resolvedBy: authReq.auth!.userId,
              resolvedAt: now,
            })
            .where(eq(reportsTable.id, reportId));

          if (action === 'ban') {
            if (report.targetType === 'post') {
              const [postRow] = await tx
                .select({
                  authorId: postsTable.authorId,
                  mediaId: postsTable.mediaId,
                  mediaJson: postsTable.mediaJson,
                })
                .from(postsTable)
                .where(eq(postsTable.id, report.targetId))
                .limit(1);
              await tx.delete(postsTable).where(eq(postsTable.id, report.targetId));
              if (postRow) {
                await tx
                  .update(usersTable)
                  .set({ postsCount: sql`GREATEST(0, ${usersTable.postsCount} - 1)` })
                  .where(eq(usersTable.id, postRow.authorId));
                if (postRow.mediaId) {
                  void deleteMediaByIdOrUrl(postRow.mediaId, null).catch(() => undefined);
                }
                const mediaArr = postRow.mediaJson as Array<{ url?: string }> | null;
                if (Array.isArray(mediaArr)) {
                  for (const m of mediaArr) {
                    if (m?.url) void deleteMediaByIdOrUrl(null, m.url).catch(() => undefined);
                  }
                }
              }
            } else if (report.targetType === 'comment') {
              await tx.delete(commentsTable).where(eq(commentsTable.id, report.targetId));
            } else if (report.targetType === 'story') {
              const [storyRow] = await tx
                .select({
                  authorId: storiesTable.authorId,
                  mediaId: storiesTable.mediaId,
                  mediaUrl: storiesTable.mediaUrl,
                })
                .from(storiesTable)
                .where(eq(storiesTable.id, report.targetId))
                .limit(1);
              await tx.delete(storiesTable).where(eq(storiesTable.id, report.targetId));
              if (storyRow) {
                if (storyRow.mediaId || storyRow.mediaUrl) {
                  void deleteMediaByIdOrUrl(storyRow.mediaId, storyRow.mediaUrl).catch(() => undefined);
                }
                const remaining = await tx
                  .select({ id: storiesTable.id })
                  .from(storiesTable)
                  .where(eq(storiesTable.authorId, storyRow.authorId))
                  .limit(1);
                if (remaining.length === 0) {
                  await tx
                    .update(usersTable)
                    .set({ hasActiveStory: false })
                    .where(eq(usersTable.id, storyRow.authorId));
                }
              }
            }

            if (targetOwnerId && targetOwnerId !== authReq.auth!.userId) {
              await tx
                .update(usersTable)
                .set({ status: 'suspended' })
                .where(eq(usersTable.id, targetOwnerId));
              await tx
                .update(sessionsTable)
                .set({ revokedAt: now })
                .where(eq(sessionsTable.userId, targetOwnerId));
            }
          }
        });

        res.json({ ok: true, id: reportId, status: nextStatus });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get(
    '/api/admin/kpis',
    requireRole('moderator', 'admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const db = getDb();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [
          usersCount,
          active24hCount,
          postsCount,
          storiesCount,
          botsCount,
          pendingReportsCount,
          urgentReportsCount,
        ] = await Promise.all([
          db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(usersTable)
            .where(gte(usersTable.lastSeenAt, oneDayAgo)),
          db.select({ count: sql<number>`count(*)::int` }).from(postsTable),
          db.select({ count: sql<number>`count(*)::int` }).from(storiesTable),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(usersTable)
            .where(eq(usersTable.kind, 'bot')),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(reportsTable)
            .where(eq(reportsTable.status, 'pending')),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(reportsTable)
            .where(sql`${reportsTable.status} = 'pending' AND ${reportsTable.urgent} = true`),
        ]);

        res.json({
          totalUsers: usersCount[0]?.count ?? 0,
          activeUsers24h: active24hCount[0]?.count ?? 0,
          totalPosts: postsCount[0]?.count ?? 0,
          totalStories: storiesCount[0]?.count ?? 0,
          totalBots: botsCount[0]?.count ?? 0,
          pendingReports: pendingReportsCount[0]?.count ?? 0,
          urgentReports: urgentReportsCount[0]?.count ?? 0,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/admin/users/:id/suspend',
    requireRole('moderator', 'admin'),
    validateBody(SuspendUserSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const targetId = String(req.params.id);
        const { status } = req.body as { status: 'suspended' | 'active' };
        const db = getDb();

        const [target] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.id, targetId))
          .limit(1);

        if (!target) {
          sendApiError(res, 404, 'not_found', 'المستخدم غير موجود');
          return;
        }

        await db.transaction(async (tx) => {
          await tx.update(usersTable).set({ status }).where(eq(usersTable.id, targetId));
          if (status === 'suspended') {
            await tx
              .update(sessionsTable)
              .set({ revokedAt: new Date() })
              .where(eq(sessionsTable.userId, targetId));
          }
        });

        res.json({ ok: true, userId: targetId, status });
      } catch (err) {
        next(err);
      }
    }
  );
}
