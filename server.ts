import fs from 'node:fs';
import path from 'node:path';
import type http from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { getEnv } from './src/server/env.ts';
import { createHttpLogger, logger } from './src/server/logger.ts';
import {
  sendApiError,
  validateBody,
  CreatePostSchema,
  VotePollSchema,
  CreateCommentSchema,
  PublishStorySchema,
  StartConversationSchema,
  SendMessageSchema,
  UpdateProfileSchema,
  CreateCommunitySchema,
  MarkNotificationsReadSchema,
  VoteStoryPollSchema,
  PublishNoteSchema,
  UpdateSettingsSchema,
  CreateSavedCollectionSchema,
  ToggleSavedCollectionItemSchema,
  CreateProductSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  WalletTopupSchema,
  WalletGiftSchema,
  CreateCommunityMessageSchema,
} from './src/server/schemas.ts';
import {
  attachSessionMiddleware,
  csrfProtectionMiddleware,
  registerAuthRoutes,
  requireAuth,
  type AuthenticatedRequest,
} from './src/server/auth.ts';
import { registerLocalMediaRoutes } from './src/server/storage.ts';
import {
  reconcileBrokenMediaAndOrphans,
  registerMediaRoutes,
  startMediaCleanupScheduler,
  stopMediaCleanupScheduler,
} from './src/server/media.ts';
import {
  authOtpRequestLimiter,
  authOtpVerifyLimiter,
  authSignupLimiter,
  chatWriteLimiter,
  contentWriteLimiter,
  duplicateSpamMiddleware,
  globalApiLimiter,
  mediaUploadLimiter,
  socialActionLimiter,
} from './src/server/rateLimit.ts';
import { registerReportAndAdminRoutes } from './src/server/reports.ts';
import { registerBotRoutes, routeUserMessageToBots } from './src/server/bots.ts';
import {
  emitConversationEvent,
  registerEventRoutes,
  startEventsListener,
  stopEventsListener,
} from './src/server/events.ts';
import {
  checkDbReady,
  closeDbPool,
  DatabaseUnavailableError,
  hasDatabaseConfig,
} from './src/db/index.ts';
import { runPendingMigrations } from './src/db/migrate.ts';
import {
  DomainError,
  getBootstrapData,
  getPaginatedPostsInDb,
  getPostByIdInDb,
  getPostCommentsInDb,
  getConversationMessagesInDb,
  searchPlatformInDb,
  createPostInDb,
  deletePostInDb,
  toggleLikePostInDb,
  toggleRepostPostInDb,
  toggleSavePostInDb,
  votePollInDb,
  addCommentToPostInDb,
  likeCommentInDb,
  publishStoryInDb,
  deleteStoryInDb,
  markStoryViewedInDb,
  voteStoryPollInDb,
  sendChatMessageInDb,
  markConversationReadInDb,
  startChatWithUserInDb,
  toggleFollowUserInDb,
  toggleCloseFriendInDb,
  blockUserInDb,
  unblockUserInDb,
  updateCurrentUserInDb,
  updateUserSettingsInDb,
  markNotificationsReadInDb,
  publishNoteInDb,
  deleteOwnNoteInDb,
  createSavedCollectionInDb,
  deleteSavedCollectionInDb,
  toggleSavedCollectionItemInDb,
  createProductInDb,
  deleteProductInDb,
  createOrderInDb,
  updateOrderStatusInDb,
  topupWalletInDb,
  spendCoinsForGiftInDb,
  toggleWishlistProductInDb,
  addCommunityInDb,
  joinCommunityInDb,
  leaveCommunityInDb,
  sendCommunityMessageInDb,
} from './src/db/repository.ts';

function isDbConnectionError(err: unknown): boolean {
  if (err instanceof DatabaseUnavailableError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code ?? '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === '57P01' ||
    msg.includes('DATABASE_URL') ||
    msg.includes('Connection terminated')
  );
}

export async function createAppServer() {
  const env = getEnv();
  const isProd = env.NODE_ENV === 'production';

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  const mediaOrigin = env.MEDIA_PUBLIC_BASE_URL ? new URL(env.MEDIA_PUBLIC_BASE_URL).origin : null;
  const appOrigin = new URL(env.APP_URL).origin;
  const allowedOriginSet = new Set<string>([
    appOrigin,
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    ...env.ALLOWED_ORIGINS,
  ]);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', ...(mediaOrigin ? [mediaOrigin] : [])],
          mediaSrc: ["'self'", 'blob:', ...(mediaOrigin ? [mediaOrigin] : [])],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            'blob:',
            'data:',
            ...(mediaOrigin ? [mediaOrigin] : []),
            ...(isProd ? [] : ['ws:', 'wss:']),
          ],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'", 'https:', 'http://localhost:*', 'http://127.0.0.1:*'],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      xFrameOptions: false,
      hsts: isProd ? undefined : false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Strict same-origin CORS unless ALLOWED_ORIGINS is explicitly configured
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      const hostOrigin = req.headers.host ? `${req.protocol}://${req.headers.host}` : null;
      if (allowedOriginSet.has(origin) || (hostOrigin && origin === hostOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-TW-CSRF,Authorization');
      } else if (req.method === 'OPTIONS') {
        res.status(403).end();
        return;
      }
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(
    compression({
      filter: (req, res) => {
        if (req.path === '/api/events' || req.headers.accept?.includes('text/event-stream')) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  app.use(createHttpLogger());

  app.use(express.json({ limit: '100kb' }));

  // Return clean 413 JSON for oversized JSON payloads
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const bodyErr = err as { type?: string; status?: number; statusCode?: number };
    if (bodyErr && (bodyErr.type === 'entity.too.large' || bodyErr.status === 413 || bodyErr.statusCode === 413)) {
      if (req.path.startsWith('/api')) {
        sendApiError(res, 413, 'payload_too_large', 'حجم البيانات يتجاوز الحد المسموح (١٠٠ كيلوبايت)');
        return;
      }
      res.status(413).send('Payload Too Large');
      return;
    }
    if (bodyErr && bodyErr.type === 'entity.parse.failed') {
      if (req.path.startsWith('/api')) {
        sendApiError(res, 400, 'invalid_json', 'صيغة JSON غير صالحة');
        return;
      }
    }
    next(err);
  });

  // Liveness & readiness probes (work even without database)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  app.get('/api/ready', async (_req: Request, res: Response) => {
    const dbOk = await checkDbReady();
    if (!dbOk) {
      res.status(503).json({ ok: false, db: false });
      return;
    }
    res.status(200).json({ ok: true, db: true });
  });

  // Fail fast with 503 JSON on other /api/* routes when DB is unconfigured
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health' || req.path === '/ready') {
      next();
      return;
    }
    if (!hasDatabaseConfig()) {
      sendApiError(res, 503, 'service_unavailable', 'الخدمة غير متاحة مؤقتاً');
      return;
    }
    next();
  });

  // CSRF protection and session resolution for /api routes
  app.use(csrfProtectionMiddleware);
  app.use(attachSessionMiddleware);
  app.use('/api', globalApiLimiter);

  // Route-group rate limiters
  app.use('/api/auth/otp/request', authOtpRequestLimiter);
  app.use('/api/auth/otp/verify', authOtpVerifyLimiter);
  app.use('/api/auth/password-login', authOtpVerifyLimiter);
  app.use('/api/auth/signup', authSignupLimiter);
  app.use('/api/auth/handle-available', authSignupLimiter);
  app.use('/api/media/uploads', mediaUploadLimiter);

  // Auth routes (OTP, signup, session, logout, devices, delete account)
  registerAuthRoutes(app);

  // Media signed upload & processing routes (+ local driver serving in dev/test)
  registerLocalMediaRoutes(app);
  registerMediaRoutes(app);

  // Reports & moderator/admin endpoints
  registerReportAndAdminRoutes(app);

  // Bot API, @botfactory_bot, and public bot directory
  registerBotRoutes(app);

  // Real-time SSE events and delta polling
  registerEventRoutes(app);

  app.get('/api/bootstrap', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const payload = await getBootstrapData(
        authReq.auth?.userId ?? null,
        authReq.auth?.decryptedPhone ?? null
      );
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/posts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
      const tabRaw = typeof req.query.tab === 'string' ? req.query.tab : 'all';
      const tab = (['all', 'following', 'province', 'merchants', 'reels'].includes(tabRaw)
        ? tabRaw
        : 'all') as 'all' | 'following' | 'province' | 'merchants' | 'reels';
      const authorId = typeof req.query.authorId === 'string' && req.query.authorId.trim()
        ? req.query.authorId.trim()
        : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;

      const result = await getPaginatedPostsInDb(authReq.auth?.userId ?? null, {
        cursor,
        limit,
        tab,
        authorId,
        q,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/posts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const post = await getPostByIdInDb(authReq.auth?.userId ?? null, String(req.params.id));
      if (!post) {
        sendApiError(res, 404, 'not_found', 'المنشور غير موجود');
        return;
      }
      res.json({ post });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/posts/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await getPostCommentsInDb(authReq.auth?.userId ?? null, String(req.params.id));
      if (!result) {
        sendApiError(res, 404, 'not_found', 'المنشور غير موجود');
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const typeRaw = typeof req.query.type === 'string' ? req.query.type : 'all';
      const type = (['all', 'users', 'posts', 'products', 'communities'].includes(typeRaw)
        ? typeRaw
        : 'all') as 'all' | 'users' | 'posts' | 'products' | 'communities';
      const result = await searchPlatformInDb(authReq.auth?.userId ?? null, q, type);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/posts',
    requireAuth,
    contentWriteLimiter,
    validateBody(CreatePostSchema),
    duplicateSpamMiddleware((req) => (req.body as { text?: string })?.text),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { id, text, mediaId, mediaIds, kind, audioTrack, location, audience, aspectRatio, createdAt } = req.body as {
          id?: string;
          text: string;
          mediaId?: string;
          mediaIds?: string[];
          kind?: 'media' | 'text' | 'video' | 'reel';
          audioTrack?: string;
          location?: string;
          audience?: 'everyone' | 'followers' | 'friends';
          aspectRatio?: '4/5' | '1/1' | '16/9' | '9/16';
          createdAt?: string;
        };
        const result = await createPostInDb(authReq.auth!.userId, {
          id: id || `post-${Date.now()}`,
          text,
          mediaId,
          mediaIds,
          kind,
          audioTrack,
          location,
          audience,
          aspectRatio,
          createdAt,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete('/api/posts/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await deletePostInDb(authReq.auth!.userId, String(req.params.id), authReq.auth!.role);
      if (!result) {
        sendApiError(res, 404, 'not_found', 'المنشور غير موجود');
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/posts/:id/like', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await toggleLikePostInDb(authReq.auth!.userId, String(req.params.id));
      if (!updated) {
        sendApiError(res, 404, 'not_found', 'المنشور غير موجود');
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/posts/:id/save', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await toggleSavePostInDb(authReq.auth!.userId, String(req.params.id));
      if (!updated) {
        sendApiError(res, 404, 'not_found', 'المنشور غير موجود');
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/posts/:id/repost', requireAuth, socialActionLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await toggleRepostPostInDb(authReq.auth!.userId, String(req.params.id));
      if (!updated) {
        sendApiError(res, 404, 'not_found', 'المنشور غير موجود');
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/posts/:id/vote',
    requireAuth,
    validateBody(VotePollSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { optionIndex } = req.body as { optionIndex: number };
        const updated = await votePollInDb(authReq.auth!.userId, String(req.params.id), optionIndex);
        if (!updated) {
          sendApiError(res, 404, 'not_found', 'الاستطلاع غير موجود');
          return;
        }
        res.json({ poll: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/posts/:id/comments',
    requireAuth,
    contentWriteLimiter,
    validateBody(CreateCommentSchema),
    duplicateSpamMiddleware((req) => (req.body as { text?: string })?.text),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { id, parentId, text, createdAt } = req.body as {
          id?: string;
          parentId?: string;
          text: string;
          createdAt?: string;
        };
        const result = await addCommentToPostInDb(authReq.auth!.userId, {
          id: id || `comm-${Date.now()}`,
          postId: String(req.params.id),
          parentId,
          text,
          createdAt,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/comments/:commentId/like', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await likeCommentInDb(authReq.auth!.userId, String(req.params.commentId));
      if (!updated) {
        sendApiError(res, 404, 'not_found', 'التعليق غير موجود');
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/stories',
    requireAuth,
    contentWriteLimiter,
    validateBody(PublishStorySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const story = req.body;
        const result = await publishStoryInDb(authReq.auth!.userId, {
          ...story,
          id: story.id || `story-${Date.now()}`,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete('/api/stories/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await deleteStoryInDb(
        authReq.auth!.userId,
        String(req.params.id),
        authReq.auth!.role
      );
      if (!result) {
        sendApiError(res, 404, 'not_found', 'القصة غير موجودة');
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/stories/:id/view', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await markStoryViewedInDb(authReq.auth!.userId, String(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/stories/:id/vote',
    requireAuth,
    socialActionLimiter,
    validateBody(VoteStoryPollSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { optionIndex } = req.body as { optionIndex: number };
        const result = await voteStoryPollInDb(authReq.auth!.userId, String(req.params.id), optionIndex);
        if (!result) {
          sendApiError(res, 404, 'not_found', 'القصة غير موجودة');
          return;
        }
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/moments/note',
    requireAuth,
    contentWriteLimiter,
    validateBody(PublishNoteSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await publishNoteInDb(authReq.auth!.userId, req.body);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete('/api/moments/note', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await deleteOwnNoteInDb(authReq.auth!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/conversations/start',
    requireAuth,
    chatWriteLimiter,
    validateBody(StartConversationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { recipientId } = req.body as { recipientId: string };
        const result = await startChatWithUserInDb(authReq.auth!.userId, recipientId);
        res.status(result.created ? 201 : 200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/conversations/:id/read', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const conversationId = String(req.params.id);
      const result = await markConversationReadInDb(authReq.auth!.userId, conversationId);
      await emitConversationEvent(
        conversationId,
        'chat:read',
        { conversationId, userId: authReq.auth!.userId },
        { excludeUserId: authReq.auth!.userId }
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/conversations/:id/messages', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const conversationId = String(req.params.id);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;
      const result = await getConversationMessagesInDb(
        authReq.auth!.userId,
        conversationId,
        cursor,
        limit
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/conversations/:id/messages',
    requireAuth,
    chatWriteLimiter,
    validateBody(SendMessageSchema),
    duplicateSpamMiddleware((req) => (req.body as { text?: string })?.text),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const conversationId = String(req.params.id);
        const { id, text, clientMsgId, mediaId, kind, voiceDuration, replyToMessageId } = req.body;
        const msgId = id || `msg-${Date.now()}`;
        const result = await sendChatMessageInDb(authReq.auth!.userId, {
          id: msgId,
          conversationId,
          clientMsgId,
          text,
          mediaId,
          kind,
          voiceDuration,
          replyToMessageId,
        });

        if (!(result as { deduplicated?: boolean }).deduplicated) {
          await emitConversationEvent(
            conversationId,
            'message:new',
            {
              conversationId,
              message: {
                id: result.id,
                senderId: authReq.auth!.userId,
                text,
                mediaUrl: result.mediaUrl,
                timestamp: result.lastMessageTime,
                isOwn: false,
                kind: kind ?? (result.mediaUrl ? 'image' : 'text'),
                status: 'sent',
                voiceDuration,
              },
            },
            { excludeUserId: authReq.auth!.userId }
          );

          await routeUserMessageToBots({
            actorId: authReq.auth!.userId,
            conversationId,
            messageId: result.id,
            text,
            mediaId,
            replyToMessageId,
          });
        }

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/users/:id/follow', requireAuth, socialActionLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await toggleFollowUserInDb(authReq.auth!.userId, String(req.params.id));
      if (!updated) {
        sendApiError(res, 404, 'not_found', 'المستخدم غير موجود');
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/users/:id/close-friend', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await toggleCloseFriendInDb(authReq.auth!.userId, String(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/users/:id/block', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await blockUserInDb(authReq.auth!.userId, String(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/users/:id/block', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await unblockUserInDb(authReq.auth!.userId, String(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.patch(
    '/api/users/me',
    requireAuth,
    validateBody(UpdateProfileSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await updateCurrentUserInDb(authReq.auth!.userId, req.body);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.patch(
    '/api/users/me/settings',
    requireAuth,
    validateBody(UpdateSettingsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await updateUserSettingsInDb(authReq.auth!.userId, req.body);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/notifications/read',
    requireAuth,
    validateBody(MarkNotificationsReadSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await markNotificationsReadInDb(authReq.auth!.userId, req.body);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/saved-collections',
    requireAuth,
    validateBody(CreateSavedCollectionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await createSavedCollectionInDb(authReq.auth!.userId, req.body.name);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete('/api/saved-collections/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await deleteSavedCollectionInDb(authReq.auth!.userId, String(req.params.id));
      if (!result) {
        sendApiError(res, 404, 'not_found', 'المجموعة غير موجودة');
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/saved-collections/:id/items',
    requireAuth,
    validateBody(ToggleSavedCollectionItemSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await toggleSavedCollectionItemInDb(
          authReq.auth!.userId,
          String(req.params.id),
          req.body.postId
        );
        if (!result) {
          sendApiError(res, 404, 'not_found', 'المجموعة غير موجودة');
          return;
        }
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/products',
    requireAuth,
    contentWriteLimiter,
    validateBody(CreateProductSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await createProductInDb(authReq.auth!.userId, req.body);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete('/api/products/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await deleteProductInDb(
        authReq.auth!.userId,
        String(req.params.id),
        authReq.auth!.role
      );
      if (!result) {
        sendApiError(res, 404, 'not_found', 'المنتج غير موجود');
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/products/:id/wishlist', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await toggleWishlistProductInDb(authReq.auth!.userId, String(req.params.id));
      if (!updated) {
        sendApiError(res, 404, 'not_found', 'المنتج غير موجود');
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/orders',
    requireAuth,
    contentWriteLimiter,
    validateBody(CreateOrderSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const order = await createOrderInDb(authReq.auth!.userId, req.body);
        res.status(201).json(order);
      } catch (err) {
        next(err);
      }
    }
  );

  app.patch(
    '/api/orders/:id',
    requireAuth,
    validateBody(UpdateOrderStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const updated = await updateOrderStatusInDb(
          authReq.auth!.userId,
          String(req.params.id),
          req.body.status
        );
        if (!updated) {
          sendApiError(res, 404, 'not_found', 'الطلب غير موجود');
          return;
        }
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/wallet/topup',
    requireAuth,
    validateBody(WalletTopupSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        if (authReq.auth!.role !== 'admin') {
          sendApiError(res, 403, 'forbidden', 'شحن المحفظة متاح للإدارة فقط حالياً');
          return;
        }
        const targetUserId = (req.body as { targetUserId?: string; amountCoins: number }).targetUserId ?? authReq.auth!.userId;
        const result = await topupWalletInDb(
          targetUserId,
          req.body.amountCoins,
          authReq.auth!.userId
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/wallet/gift',
    requireAuth,
    socialActionLimiter,
    validateBody(WalletGiftSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await spendCoinsForGiftInDb(authReq.auth!.userId, req.body);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/communities',
    requireAuth,
    validateBody(CreateCommunitySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { id, name, province, category, isPrivate, description, icon } = req.body;
        const result = await addCommunityInDb(authReq.auth!.userId, {
          id: id || `comm-${Date.now()}`,
          name,
          province,
          category,
          isPrivate,
          description,
          icon,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/communities/:id/join', requireAuth, socialActionLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await joinCommunityInDb(authReq.auth!.userId, String(req.params.id));
      if (!result) {
        sendApiError(res, 404, 'not_found', 'المجتمع غير موجود');
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/communities/:id/join', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await leaveCommunityInDb(authReq.auth!.userId, String(req.params.id));
      if (!result) {
        sendApiError(res, 404, 'not_found', 'المجتمع غير موجود');
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/communities/:id/messages',
    requireAuth,
    chatWriteLimiter,
    validateBody(CreateCommunityMessageSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const result = await sendCommunityMessageInDb(
          authReq.auth!.userId,
          String(req.params.id),
          req.body
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // Fail cleanly on unknown /api/* routes instead of serving HTML
  app.use('/api', (_req: Request, res: Response) => {
    sendApiError(res, 404, 'not_found', 'نقطة النهاية غير موجودة');
  });

  // Centralized API error handler
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (req.path.startsWith('/api')) {
      if (err instanceof DomainError) {
        sendApiError(res, err.status, err.code, err.message);
        return;
      }
      logger.error({ err, path: req.path }, 'Unhandled API error');
      if (isDbConnectionError(err)) {
        sendApiError(res, 503, 'service_unavailable', 'الخدمة غير متاحة مؤقتاً');
        return;
      }
      sendApiError(res, 500, 'internal_error', 'حدث خطأ غير متوقع، حاول مرة أخرى');
      return;
    }
    next(err);
  });

  if (env.NODE_ENV === 'production') {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else if (env.NODE_ENV !== 'test') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req: Request, res: Response, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      try {
        const indexPath = path.resolve(import.meta.dirname, 'index.html');
        const template = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  }

  return app;
}

const isEntrypoint = (() => {
  if (typeof process === 'undefined' || !Array.isArray(process.argv) || !process.argv[1]) {
    return false;
  }
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(import.meta.filename);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
  }
})();

if (isEntrypoint) {
  (async () => {
    const env = getEnv();
    if (env.NODE_ENV === 'production' && hasDatabaseConfig()) {
      try {
        await runPendingMigrations();
        logger.info('Pending database migrations verified');
      } catch (err) {
        logger.error({ err }, 'Startup migrations failed; server will boot in degraded mode');
      }
    }

    const app = await createAppServer();
    startMediaCleanupScheduler();
    if (hasDatabaseConfig()) {
      void reconcileBrokenMediaAndOrphans().catch((err) => {
        logger.warn({ err }, 'Startup media reconciliation failed');
      });
    }
    if (env.NODE_ENV === 'production' && env.USING_DERIVED_SECRETS) {
      logger.warn(
        'Starting production server with runtime-derived fallback secrets; configure explicit SESSION_SECRET/PHONE_ENC_KEY/PHONE_HMAC_KEY/OTP_PEPPER and STRICT_ENV=true for hardened self-hosted deployments'
      );
    }
    const server: http.Server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, `Server listening on http://0.0.0.0:${env.PORT}`);
      void startEventsListener();
    });

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, 'Graceful shutdown started');
      stopMediaCleanupScheduler();
      await stopEventsListener();
      server.close(async () => {
        await closeDbPool();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      });
      setTimeout(() => {
        logger.warn('Forced shutdown after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  })().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
