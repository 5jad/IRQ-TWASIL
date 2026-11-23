import { z, type ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
  retryAfterSec?: number;
}

export function sendApiError(
  res: Response,
  status: number,
  error: string,
  message: string,
  extra?: { details?: Array<{ path: string; message: string }>; retryAfterSec?: number }
): void {
  const body: ApiErrorBody = { error, message };
  if (extra?.details) body.details = extra.details;
  if (extra?.retryAfterSec !== undefined) body.retryAfterSec = extra.retryAfterSec;
  res.status(status).json(body);
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      sendApiError(res, 400, 'validation_error', 'البيانات المدخلة غير صالحة', { details });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

// Strict request schemas
export const CreatePostSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    text: z.string().max(4000).optional().default(''),
    mediaId: z.string().trim().min(1).max(64).optional(),
    mediaIds: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
    kind: z.enum(['media', 'text', 'video', 'reel']).optional(),
    audioTrack: z.string().trim().max(160).optional(),
    location: z.string().trim().max(120).optional(),
    audience: z.enum(['everyone', 'followers', 'friends']).optional(),
    aspectRatio: z.enum(['4/5', '1/1', '16/9', '9/16']).optional(),
    createdAt: z.string().datetime().optional(),
  })
  .strict()
  .refine((d) => d.text.trim().length > 0 || Boolean(d.mediaId) || Boolean(d.mediaIds && d.mediaIds.length > 0), {
    message: 'نص المنشور أو الوسائط مطلوب',
  });

export const VotePollSchema = z
  .object({
    optionIndex: z.number().int().min(0).max(20),
  })
  .strict();

export const CreateCommentSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    parentId: z.string().trim().min(1).max(64).optional(),
    text: z.string().trim().min(1).max(2000),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export const StoryOverlaySchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(['text', 'sticker']),
    text: z.string().max(300).optional(),
    colorToken: z.string().max(64).optional(),
    fontClass: z.string().max(64).optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    stickerKind: z.enum(['location', 'mention', 'poll', 'question', 'countdown', 'heritage']).optional(),
    motifId: z.string().max(64).optional(),
    pollOptions: z.array(z.string().max(120)).max(6).optional(),
    xPct: z.number().min(0).max(100),
    yPct: z.number().min(0).max(100),
    scale: z.number().min(0.2).max(5),
    rotation: z.number().min(-360).max(360),
  })
  .strict();

export const PublishStorySchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    kind: z.enum(['story', 'instant', 'note']).optional(),
    mediaId: z.string().trim().min(1).max(64).optional(),
    mediaType: z.enum(['image', 'video', 'text']),
    caption: z.string().max(500).optional(),
    soundId: z.string().max(64).optional(),
    soundTitle: z.string().max(120).optional(),
    videoVolume: z.number().min(0).max(100).optional(),
    musicVolume: z.number().min(0).max(100).optional(),
    soundStartSec: z.number().min(0).max(600).optional(),
    durationSec: z
      .number()
      .min(0.1)
      .max(60)
      .transform((n) => Math.max(1, Math.round(n)))
      .default(5),
    audience: z.enum(['everyone', 'close-friends', 'followers', 'custom']).default('everyone'),
    recipientIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    mode: z.enum(['story', 'instants', 'reel', 'live', 'post']).default('story'),
    bgGradient: z.string().max(240).optional(),
    overlays: z.array(StoryOverlaySchema).max(20).optional(),
  })
  .strict()
  .refine((d) => d.mediaType === 'text' || Boolean(d.mediaId), {
    message: 'الوسائط مطلوبة للقصص المصورة والمرئية',
  });

export const StartConversationSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    recipientId: z.string().trim().min(1).max(64),
  })
  .strict();

export const SendMessageSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    clientMsgId: z.string().trim().min(1).max(64).optional(),
    text: z.string().max(4000).optional().default(''),
    mediaId: z.string().trim().min(1).max(64).optional(),
    kind: z.enum(['text', 'image', 'voice', 'file']).default('text'),
    voiceDuration: z.string().max(16).optional(),
    replyToMessageId: z.string().max(64).optional(),
  })
  .strict()
  .refine((d) => d.text.trim().length > 0 || Boolean(d.mediaId), {
    message: 'محتوى الرسالة مطلوب',
  });

export const UpdateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    handle: z.string().trim().min(3).max(20).optional(),
    bio: z.string().max(300).optional(),
    province: z.string().trim().min(1).max(40).optional(),
    city: z.string().trim().max(40).optional(),
    avatarMediaId: z.string().trim().min(1).max(64).optional(),
    coverMediaId: z.string().trim().min(1).max(64).optional(),
    accountType: z.enum(['personal', 'creator', 'merchant']).optional(),
    canvasConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

export const CreateCommunitySchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(2).max(80),
    province: z.string().trim().min(1).max(40).default('بغداد'),
    category: z.string().trim().min(1).max(60).default('عام'),
    isPrivate: z.boolean().default(false),
    description: z.string().trim().max(500).default(''),
    icon: z.string().max(240).optional(),
  })
  .strict();

export const OtpRequestSchema = z
  .object({
    phone: z.string().trim().min(7).max(24),
    purpose: z.enum(['login', 'signup', 'delete-account']).default('login'),
  })
  .strict();

export const OtpVerifySchema = z
  .object({
    challengeId: z.string().trim().min(1).max(64),
    code: z.string().trim().min(6).max(6),
  })
  .strict();

export const SignupSchema = z
  .object({
    signupToken: z.string().trim().min(16).max(1024),
    handle: z.string().trim().min(3).max(20),
    displayName: z.string().trim().min(1).max(60),
    province: z.string().trim().min(1).max(40).default('بغداد'),
    birthYear: z.number().int().min(1920).max(2025),
    accountType: z.enum(['personal', 'creator', 'merchant']).default('personal'),
    password: z.string().min(6).max(128).optional(),
    acceptedTerms: z.literal(true),
  })
  .strict();

export const PasswordLoginSchema = z
  .object({
    identifier: z.string().trim().min(2).max(120),
    password: z.string().min(1).max(128),
  })
  .strict();

export const DeleteAccountSchema = z.union([
  z
    .object({
      challengeId: z.string().trim().min(1).max(64),
      code: z.string().trim().min(6).max(6),
    })
    .strict(),
  z
    .object({
      password: z.string().min(1).max(128),
    })
    .strict(),
]);

export const MediaUploadInitSchema = z
  .object({
    kind: z.enum(['post-image', 'post-video', 'story-image', 'story-video', 'avatar', 'cover', 'chat-image', 'chat-file', 'bot-avatar']),
    mime: z.string().trim().min(3).max(120),
    sizeBytes: z.number().int().positive(),
    sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).optional(),
  })
  .strict();

export const ServerImageCropSchema = z
  .object({
    sx: z.number().int().min(0),
    sy: z.number().int().min(0),
    sw: z.number().int().min(1),
    sh: z.number().int().min(1),
    dx: z.number().int().min(0),
    dy: z.number().int().min(0),
    dw: z.number().int().min(1),
    dh: z.number().int().min(1),
    outputWidth: z.number().int().min(32).max(2048),
    outputHeight: z.number().int().min(32).max(2048),
    fitMode: z.enum(['cover', 'contain']),
  })
  .strict();

export const MediaUploadCompleteSchema = z
  .object({
    crop: ServerImageCropSchema.optional(),
  })
  .strict();

export const CreateReportSchema = z
  .object({
    targetType: z.enum(['post', 'comment', 'user', 'message', 'story', 'product', 'community', 'canvas', 'bot']),
    targetId: z.string().trim().min(1).max(64),
    reason: z.enum(['extortion', 'scam', 'harassment', 'self-harm', 'hate', 'spam']),
    details: z.string().trim().max(500).optional().default(''),
    alsoBlock: z.boolean().optional().default(false),
  })
  .strict();

export const SetEmailSchema = z
  .object({
    email: z.string().trim().email('البريد الإلكتروني غير صالح').max(120),
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .strict();

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: z.string().min(6, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل').max(128),
  })
  .strict();

export const RequestPhoneLinkSchema = z
  .object({
    phone: z.string().trim().min(7).max(24),
  })
  .strict();

export const VerifyPhoneLinkSchema = z
  .object({
    challengeId: z.string().trim().min(1).max(64),
    code: z.string().trim().min(6).max(6),
  })
  .strict();

export const UpdateSettingsSchema = z
  .object({
    dmPermission: z.enum(['everyone', 'followers', 'nobody']).optional(),
    commentPermission: z.enum(['everyone', 'followers', 'nobody']).optional(),
    onlineStatusVisibility: z.boolean().optional(),
    readReceipts: z.boolean().optional(),
    quietMode: z.boolean().optional(),
    sensitiveContentFilter: z.boolean().optional(),
    twoFactorEnabled: z.boolean().optional(),
    notifyLikes: z.boolean().optional(),
    notifyComments: z.boolean().optional(),
    notifyFollows: z.boolean().optional(),
    notifyMessages: z.boolean().optional(),
    notifyOrders: z.boolean().optional(),
  })
  .strict();

export const MarkNotificationsReadSchema = z
  .object({
    ids: z.array(z.string().trim().min(1).max(64)).max(200).optional(),
    all: z.boolean().optional(),
  })
  .strict();

export const VoteStoryPollSchema = z
  .object({
    optionIndex: z.number().int().min(0).max(10),
  })
  .strict();

export const PublishNoteSchema = z
  .object({
    text: z.string().trim().min(1).max(120),
    audience: z.enum(['everyone', 'close-friends', 'followers']).default('everyone'),
  })
  .strict();

export const CreateSavedCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
  })
  .strict();

export const ToggleSavedCollectionItemSchema = z
  .object({
    postId: z.string().trim().min(1).max(64),
  })
  .strict();

export const CreateProductSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    priceIqd: z.number().int().min(250).max(500_000_000),
    compareAtPriceIqd: z.number().int().min(250).max(500_000_000).optional(),
    category: z.string().trim().min(1).max(60).default('أخرى'),
    condition: z.enum(['new', 'used']).default('new'),
    city: z.string().trim().min(1).max(50),
    province: z.string().trim().min(1).max(50),
    mediaId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const CreateOrderSchema = z
  .object({
    productId: z.string().trim().min(1).max(64),
    note: z.string().trim().max(400).optional().default(''),
  })
  .strict();

export const UpdateOrderStatusSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
  })
  .strict();

export const WalletTopupSchema = z
  .object({
    amountCoins: z.number().int().min(10).max(100_000),
    targetUserId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const WalletGiftSchema = z
  .object({
    recipientId: z.string().trim().min(1).max(64),
    amountCoins: z.number().int().min(1).max(50_000),
    giftLabel: z.string().trim().min(1).max(80),
  })
  .strict();

export const CreateCommunityMessageSchema = z
  .object({
    channel: z.enum(['general', 'announcements']).default('general'),
    text: z.string().trim().min(1).max(2000),
  })
  .strict();
