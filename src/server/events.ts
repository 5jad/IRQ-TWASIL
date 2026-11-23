import { EventEmitter } from 'node:events';
import type { Express, Request, Response, NextFunction } from 'express';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { Client } from 'pg';
import { getDb, hasDatabaseConfig } from '../db/index.ts';
import { conversationMembersTable, eventsTable, notificationsTable } from '../db/schema.ts';
import { getEnv } from './env.ts';
import { requireAuth, type AuthenticatedRequest } from './auth.ts';
import { logger } from './logger.ts';

export interface RealtimeEventPayload {
  id: number;
  recipientUserId: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

const localEmitter = new EventEmitter();
localEmitter.setMaxListeners(500);
const recentDispatchedIds = new Set<number>();

function markDispatched(id: number): boolean {
  if (recentDispatchedIds.has(id)) return false;
  recentDispatchedIds.add(id);
  if (recentDispatchedIds.size > 2000) {
    const first = recentDispatchedIds.values().next().value;
    if (first !== undefined) recentDispatchedIds.delete(first);
  }
  return true;
}

export async function emitUserEvent(
  recipientUserId: string,
  eventType: string,
  payload: unknown
): Promise<RealtimeEventPayload | null> {
  if (!hasDatabaseConfig()) return null;
  const db = getDb();

  const [inserted] = await db
    .insert(eventsTable)
    .values({
      recipientUserId,
      eventType,
      payloadJson: payload as Record<string, unknown>,
    })
    .returning();

  if (!inserted) return null;

  const evt: RealtimeEventPayload = {
    id: inserted.id,
    recipientUserId: inserted.recipientUserId,
    eventType: inserted.eventType,
    payload: inserted.payloadJson,
    createdAt: inserted.createdAt.toISOString(),
  };

  if (markDispatched(evt.id)) {
    localEmitter.emit(`u:${recipientUserId}`, evt);
  }

  // Notify across instances (keep payload tiny for PostgreSQL 8KB NOTIFY cap)
  const notifyPayload = JSON.stringify({
    id: evt.id,
    recipientUserId,
    eventType,
  });
  await db.execute(sql`SELECT pg_notify('tw_events', ${notifyPayload})`).catch(() => undefined);

  return evt;
}

export async function emitConversationEvent(
  conversationId: string,
  eventType: string,
  payload: unknown,
  options?: { excludeUserId?: string }
): Promise<void> {
  if (!hasDatabaseConfig()) return;
  const db = getDb();
  const members = await db
    .select({ userId: conversationMembersTable.userId })
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.conversationId, conversationId));

  await Promise.all(
    members
      .filter((m) => m.userId !== options?.excludeUserId)
      .map((m) => emitUserEvent(m.userId, eventType, payload))
  );
}

let listenClient: Client | null = null;
let listenStopped = false;

export async function startEventsListener(): Promise<void> {
  if (listenClient || !hasDatabaseConfig()) return;
  listenStopped = false;
  const env = getEnv();
  if (!env.DATABASE_URL) return;

  const ssl = env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT, rejectUnauthorized: true } : { rejectUnauthorized: true };
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl,
    connectionTimeoutMillis: 5000,
  });
  listenClient = client;

  client.on('error', (err) => {
    logger.warn({ err }, 'PostgreSQL LISTEN client error');
  });

  client.on('notification', async (msg) => {
    if (msg.channel !== 'tw_events' || !msg.payload) return;
    try {
      const parsed = JSON.parse(msg.payload) as { id?: number; recipientUserId?: string };
      if (!parsed.id || !parsed.recipientUserId) return;
      if (!markDispatched(parsed.id)) return;

      const db = getDb();
      const [row] = await db
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, parsed.id))
        .limit(1);
      if (!row) return;

      localEmitter.emit(`u:${row.recipientUserId}`, {
        id: row.id,
        recipientUserId: row.recipientUserId,
        eventType: row.eventType,
        payload: row.payloadJson,
        createdAt: row.createdAt.toISOString(),
      } satisfies RealtimeEventPayload);
    } catch {
      // Ignore malformed notification
    }
  });

  try {
    await client.connect();
    if (listenStopped) {
      await client.end().catch(() => undefined);
      return;
    }
    await client.query('LISTEN tw_events');
  } catch (err) {
    logger.warn({ err }, 'Could not start PostgreSQL LISTEN client');
    listenClient = null;
  }
}

export async function stopEventsListener(): Promise<void> {
  listenStopped = true;
  if (listenClient) {
    const c = listenClient;
    listenClient = null;
    await c.end().catch(() => undefined);
  }
}

export function registerEventRoutes(app: Express): void {
  app.get('/api/events', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const writeEvent = (evt: RealtimeEventPayload) => {
        if (res.writableEnded) return;
        res.write(`id: ${evt.id}\nevent: ${evt.eventType}\ndata: ${JSON.stringify(evt.payload)}\n\n`);
      };

      // Replay missed events if Last-Event-ID is provided (max 100)
      const rawLastId =
        (typeof req.headers['last-event-id'] === 'string' && req.headers['last-event-id']) ||
        (typeof req.query.lastEventId === 'string' && req.query.lastEventId) ||
        '';
      const lastId = Number(rawLastId);
      if (Number.isInteger(lastId) && lastId > 0) {
        const db = getDb();
        const missed = await db
          .select()
          .from(eventsTable)
          .where(and(eq(eventsTable.recipientUserId, userId), gt(eventsTable.id, lastId)))
          .orderBy(asc(eventsTable.id))
          .limit(100);

        for (const row of missed) {
          writeEvent({
            id: row.id,
            recipientUserId: row.recipientUserId,
            eventType: row.eventType,
            payload: row.payloadJson,
            createdAt: row.createdAt.toISOString(),
          });
        }
      } else {
        res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      }

      const listener = (evt: RealtimeEventPayload) => writeEvent(evt);
      localEmitter.on(`u:${userId}`, listener);

      const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
          res.write(': keepalive\n\n');
        }
      }, 25_000);
      heartbeat.unref();

      req.on('close', () => {
        clearInterval(heartbeat);
        localEmitter.off(`u:${userId}`, listener);
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/bootstrap/delta', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;
      const rawSince = String(req.query.since ?? '0').trim();
      const db = getDb();

      let rows: Array<typeof eventsTable.$inferSelect> = [];
      if (/^\d+$/.test(rawSince)) {
        const sinceId = Number(rawSince);
        rows = await db
          .select()
          .from(eventsTable)
          .where(and(eq(eventsTable.recipientUserId, userId), gt(eventsTable.id, sinceId)))
          .orderBy(asc(eventsTable.id))
          .limit(100);
      } else {
        const sinceDate = new Date(rawSince);
        if (!Number.isNaN(sinceDate.getTime())) {
          rows = await db
            .select()
            .from(eventsTable)
            .where(and(eq(eventsTable.recipientUserId, userId), gt(eventsTable.createdAt, sinceDate)))
            .orderBy(asc(eventsTable.id))
            .limit(100);
        }
      }

      const unreadNotifs = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationsTable)
        .where(and(eq(notificationsTable.recipientId, userId), eq(notificationsTable.isRead, false)));

      const memberConvs = await db
        .select({
          conversationId: conversationMembersTable.conversationId,
          unreadCount: conversationMembersTable.unreadCount,
        })
        .from(conversationMembersTable)
        .where(eq(conversationMembersTable.userId, userId));

      const events = rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        payload: r.payloadJson,
        createdAt: r.createdAt.toISOString(),
      }));

      const lastEventId = events.length > 0 ? events[events.length - 1]!.id : null;

      res.json({
        lastEventId,
        events,
        unreadNotifications: unreadNotifs[0]?.count ?? 0,
        conversationUnreadById: Object.fromEntries(memberConvs.map((m) => [m.conversationId, m.unreadCount])),
      });
    } catch (err) {
      next(err);
    }
  });
}
