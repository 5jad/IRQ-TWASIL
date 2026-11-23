import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Express, Request, Response, NextFunction } from 'express';
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { encode as encodeBlurhash } from 'blurhash';
import { getDb, hasDatabaseConfig } from '../db/index.ts';
import {
  mediaJobsTable,
  mediaTable,
  postsTable,
  productsTable,
  socialMomentsTable,
  storiesTable,
  usersTable,
} from '../db/schema.ts';
import { getEnv } from './env.ts';
import { requireAuth, type AuthenticatedRequest } from './auth.ts';
import { MediaUploadCompleteSchema, MediaUploadInitSchema, sendApiError, validateBody } from './schemas.ts';
import type { ServerCropSpec } from '../lib/cropUtils.ts';
import { getMediaStorage } from './storage.ts';
import { logger } from './logger.ts';

const execFileAsync = promisify(execFile);

export type MediaKind =
  | 'post-image'
  | 'post-video'
  | 'story-image'
  | 'story-video'
  | 'avatar'
  | 'cover'
  | 'chat-image'
  | 'chat-file'
  | 'bot-avatar';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const CHAT_FILE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'application/zip',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const KIND_CONFIG: Record<
  MediaKind,
  { maxBytes: number; mimes: Set<string>; category: 'image' | 'video' | 'file' }
> = {
  avatar: { maxBytes: 5 * 1024 * 1024, mimes: IMAGE_MIMES, category: 'image' },
  cover: { maxBytes: 5 * 1024 * 1024, mimes: IMAGE_MIMES, category: 'image' },
  'bot-avatar': { maxBytes: 5 * 1024 * 1024, mimes: IMAGE_MIMES, category: 'image' },
  'post-image': { maxBytes: 10 * 1024 * 1024, mimes: IMAGE_MIMES, category: 'image' },
  'story-image': { maxBytes: 10 * 1024 * 1024, mimes: IMAGE_MIMES, category: 'image' },
  'chat-image': { maxBytes: 10 * 1024 * 1024, mimes: IMAGE_MIMES, category: 'image' },
  'post-video': { maxBytes: 50 * 1024 * 1024, mimes: VIDEO_MIMES, category: 'video' },
  'story-video': { maxBytes: 50 * 1024 * 1024, mimes: VIDEO_MIMES, category: 'video' },
  'chat-file': { maxBytes: 20 * 1024 * 1024, mimes: CHAT_FILE_MIMES, category: 'file' },
};

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/zip': '.zip',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
};

export function inspectMagicBytes(head: Buffer, declaredMime: string): boolean {
  if (head.length < 4) {
    return declaredMime === 'text/plain' && head.length > 0 && !head.includes(0);
  }

  // Always reject active content / executables (SVG, HTML, PE/ELF/shebang)
  const textSample = head.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (
    textSample.startsWith('<svg') ||
    textSample.startsWith('<?xml') ||
    textSample.startsWith('<!doctype html') ||
    textSample.startsWith('<html') ||
    textSample.startsWith('<script') ||
    (head[0] === 0x4d && head[1] === 0x5a) || // MZ
    (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46) // ELF
  ) {
    return false;
  }

  switch (declaredMime) {
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'image/png':
      return (
        head.length >= 8 &&
        head[0] === 0x89 &&
        head[1] === 0x50 &&
        head[2] === 0x4e &&
        head[3] === 0x47 &&
        head[4] === 0x0d &&
        head[5] === 0x0a &&
        head[6] === 0x1a &&
        head[7] === 0x0a
      );
    case 'image/webp':
      return (
        head.length >= 12 &&
        head.subarray(0, 4).toString('ascii') === 'RIFF' &&
        head.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'image/gif': {
      const sig = head.subarray(0, 6).toString('ascii');
      return sig === 'GIF87a' || sig === 'GIF89a';
    }
    case 'video/mp4':
    case 'video/quicktime':
    case 'audio/mp4':
      return head.length >= 12 && head.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'video/webm':
    case 'audio/webm':
      return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    case 'application/pdf':
      return head.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'application/zip':
      return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05);
    case 'audio/ogg':
      return head.subarray(0, 4).toString('ascii') === 'OggS';
    case 'audio/mpeg':
      return (
        head.subarray(0, 3).toString('ascii') === 'ID3' ||
        (head[0] === 0xff && (head[1]! & 0xe0) === 0xe0)
      );
    case 'text/plain':
      return !head.includes(0);
    default:
      return false;
  }
}

async function computeBlurhash(imageBuf: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(imageBuf)
      .resize(32, 32, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return encodeBlurhash(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  } catch {
    return null;
  }
}

async function cropAnimatedGifToWebp(
  rawBuf: Buffer,
  crop: ServerCropSpec
): Promise<{ mainBuf: Buffer; width: number; height: number } | null> {
  const meta = await sharp(rawBuf, { limitInputPixels: 160_000_000, animated: true }).metadata();
  const natW = meta.width ?? 0;
  const natH = meta.pageHeight ?? meta.height ?? 0;
  if (natW <= 0 || natH <= 0) return null;

  const sx = Math.max(0, Math.min(natW - 1, Math.round(crop.sx)));
  const sy = Math.max(0, Math.min(natH - 1, Math.round(crop.sy)));
  const sw = Math.max(1, Math.min(natW - sx, Math.round(crop.sw)));
  const sh = Math.max(1, Math.min(natH - sy, Math.round(crop.sh)));

  const outW = Math.max(32, Math.min(960, Math.round(crop.outputWidth)));
  const outH = Math.max(32, Math.min(960, Math.round(crop.outputHeight)));
  const scaleX = outW / Math.max(1, crop.outputWidth);
  const scaleY = outH / Math.max(1, crop.outputHeight);

  const dx = Math.max(0, Math.min(outW - 1, Math.round(crop.dx * scaleX)));
  const dy = Math.max(0, Math.min(outH - 1, Math.round(crop.dy * scaleY)));
  const dw = Math.max(2, Math.min(outW - dx, Math.round(crop.dw * scaleX)));
  const dh = Math.max(2, Math.min(outH - dy, Math.round(crop.dh * scaleY)));

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tawasul-gif-'));
  const inputPath = path.join(tmpDir, 'input.gif');
  const outputPath = path.join(tmpDir, 'output.webp');

  try {
    await fs.writeFile(inputPath, rawBuf);
    const isFullCover = crop.fitMode === 'cover' && dx === 0 && dy === 0 && dw === outW && dh === outH;

    if (isFullCover) {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputPath,
          '-vf',
          `crop=${sw}:${sh}:${sx}:${sy},scale=${outW}:${outH}:flags=lanczos`,
          '-c:v',
          'libwebp',
          '-loop',
          '0',
          '-q:v',
          '80',
          '-an',
          outputPath,
        ],
        { timeout: 30_000 }
      );
    } else {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputPath,
          '-filter_complex',
          `[0:v]split[bg][src];[bg]scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH},boxblur=16:1,eq=brightness=-0.12[b];[src]crop=${sw}:${sh}:${sx}:${sy},scale=${dw}:${dh}:flags=lanczos[f];[b][f]overlay=${dx}:${dy}`,
          '-c:v',
          'libwebp',
          '-loop',
          '0',
          '-q:v',
          '80',
          '-an',
          outputPath,
        ],
        { timeout: 30_000 }
      );
    }

    const mainBuf = await fs.readFile(outputPath);
    if (mainBuf.length === 0) return null;
    return { mainBuf, width: outW, height: outH };
  } catch (err) {
    logger.warn({ err }, 'Animated GIF ffmpeg crop failed, falling back to sharp animated resize');
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function processImageBuffer(rawBuf: Buffer, mime: string, crop?: ServerCropSpec) {
  let mainBuf: Buffer;
  let width: number;
  let height: number;

  if (mime === 'image/gif' && crop) {
    const cropped = await cropAnimatedGifToWebp(rawBuf, crop);
    if (cropped) {
      mainBuf = cropped.mainBuf;
      width = cropped.width;
      height = cropped.height;
    } else {
      const fallback = await sharp(rawBuf, { limitInputPixels: 160_000_000, animated: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      mainBuf = fallback.data;
      width = fallback.info.width;
      height = fallback.info.pageHeight ?? fallback.info.height;
    }
  } else {
    // .rotate() applies EXIF orientation then sharp strips all EXIF/GPS/XMP metadata automatically
    const base = sharp(rawBuf, {
      limitInputPixels: mime === 'image/gif' ? 160_000_000 : 40_000_000,
      animated: mime === 'image/gif',
    });
    const mainPipe =
      mime === 'image/gif'
        ? base.webp({ quality: 82 })
        : base.rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 });

    const out = await mainPipe.toBuffer({ resolveWithObject: true });
    mainBuf = out.data;
    width = out.info.width;
    height = out.info.pageHeight ?? out.info.height;
  }

  const thumbBuf = await sharp(mainBuf, { limitInputPixels: 160_000_000 })
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  const blurhash = await computeBlurhash(thumbBuf);
  return {
    mainBuf,
    mainMime: 'image/webp',
    mainExt: '.webp',
    thumbBuf,
    width,
    height,
    blurhash,
  };
}

function parseFfprobeDurationSec(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return 0;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const parts = trimmed.split(':');
  if (parts.length === 3) {
    const secs = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    return Number.isFinite(secs) && secs > 0 ? secs : 0;
  }
  return 0;
}

async function processVideoBuffer(rawBuf: Buffer, origExt: string) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tawasul-vid-'));
  const inputPath = path.join(tmpDir, `input${origExt}`);
  const outputPath = path.join(tmpDir, 'output.mp4');
  const posterPath = path.join(tmpDir, 'poster.png');

  try {
    await fs.writeFile(inputPath, rawBuf);

    const { stdout: probeOut } = await execFileAsync(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
      { timeout: 15_000 }
    );
    const probe = JSON.parse(probeOut) as {
      format?: { duration?: string; tags?: Record<string, string> };
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
        duration?: string;
        tags?: Record<string, string>;
      }>;
    };
    const videoStream = probe.streams?.find((s) => s.codec_type === 'video');
    if (!videoStream) {
      throw new Error('ملف الفيديو لا يحتوي على مسار مرئي صالح');
    }

    const inputDurationSec =
      parseFfprobeDurationSec(probe.format?.duration) ||
      parseFfprobeDurationSec(videoStream.duration) ||
      parseFfprobeDurationSec(videoStream.tags?.DURATION) ||
      parseFfprobeDurationSec(probe.format?.tags?.DURATION);

    if (inputDurationSec > 60.5) {
      throw new Error('مدة الفيديو تتجاوز ٦٠ ثانية');
    }

    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-t',
        '61',
        '-map_metadata',
        '-1',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '24',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        "scale='trunc(min(1280,iw)/2)*2':-2",
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      { timeout: 30_000 }
    );

    let durationSec = inputDurationSec;
    if (durationSec <= 0) {
      const { stdout: outProbeRaw } = await execFileAsync(
        'ffprobe',
        ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', outputPath],
        { timeout: 15_000 }
      ).catch(() => ({ stdout: '{}' }));
      const outProbe = JSON.parse(outProbeRaw) as {
        format?: { duration?: string };
        streams?: Array<{ duration?: string }>;
      };
      durationSec =
        parseFfprobeDurationSec(outProbe.format?.duration) ||
        parseFfprobeDurationSec(outProbe.streams?.[0]?.duration) ||
        1;
    }

    if (durationSec > 60.5) {
      throw new Error('مدة الفيديو تتجاوز ٦٠ ثانية');
    }

    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', outputPath, '-ss', '00:00:00.5', '-frames:v', '1', posterPath],
      { timeout: 15_000 }
    ).catch(() => undefined);

    const mainBuf = await fs.readFile(outputPath);
    let thumbBuf: Buffer | null = null;
    let blurhash: string | null = null;
    try {
      const posterRaw = await fs.readFile(posterPath);
      thumbBuf = await sharp(posterRaw)
        .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
      blurhash = await computeBlurhash(thumbBuf);
    } catch {
      // Optional poster if very short video
    }

    return {
      mainBuf,
      mainMime: 'video/mp4',
      mainExt: '.mp4',
      thumbBuf,
      width: videoStream.width ?? null,
      height: videoStream.height ?? null,
      durationSec: Math.round(durationSec * 10) / 10,
      blurhash,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function processAndFinalizeMedia(
  mediaRow: typeof mediaTable.$inferSelect,
  crop?: ServerCropSpec
): Promise<{
  publicUrl: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  blurhash: string | null;
  mime: string;
}> {
  const storage = getMediaStorage();
  const cfg = KIND_CONFIG[mediaRow.kind as MediaKind];
  if (!cfg) {
    throw new Error('نوع الوسائط غير صالح');
  }

  const head = await storage.headObject(mediaRow.stagingKey);
  if (!head || head.contentLength <= 0) {
    throw new Error('لم يتم رفع الملف إلى التخزين المؤقت');
  }
  if (head.contentLength > cfg.maxBytes) {
    await storage.deleteObject(mediaRow.stagingKey);
    throw new Error('حجم الملف يتجاوز الحد المسموح');
  }

  const firstBytes = await storage.readRange(mediaRow.stagingKey, 0, 4095);
  if (!inspectMagicBytes(firstBytes, mediaRow.mime)) {
    await storage.deleteObject(mediaRow.stagingKey);
    throw new Error('محتوى الملف لا يطابق الصيغة المصرّح بها أو يحتوي محتوى غير آمن');
  }

  const rawBuf = await storage.readAll(mediaRow.stagingKey);
  if (!inspectMagicBytes(rawBuf.subarray(0, 4096), mediaRow.mime)) {
    await storage.deleteObject(mediaRow.stagingKey);
    throw new Error('محتوى الملف غير صالح');
  }

  let publicKey = '';
  let thumbKey: string | null = null;
  let publicUrl = '';
  let thumbUrl: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let durationSec: number | null = null;
  let blurhash: string | null = null;
  let finalMime = mediaRow.mime;
  let actualSizeBytes = rawBuf.length;

  if (cfg.category === 'image') {
    const processed = await processImageBuffer(rawBuf, mediaRow.mime, crop);
    publicKey = `public/${mediaRow.id}/main${processed.mainExt}`;
    thumbKey = `public/${mediaRow.id}/thumb.webp`;
    publicUrl = await storage.putPublicObject(publicKey, processed.mainBuf, processed.mainMime);
    thumbUrl = await storage.putPublicObject(thumbKey, processed.thumbBuf, 'image/webp');
    width = processed.width;
    height = processed.height;
    blurhash = processed.blurhash;
    finalMime = processed.mainMime;
    actualSizeBytes = processed.mainBuf.length;
  } else if (cfg.category === 'video') {
    const origExt = EXT_BY_MIME[mediaRow.mime] ?? '.mp4';
    const processed = await processVideoBuffer(rawBuf, origExt);
    publicKey = `public/${mediaRow.id}/main${processed.mainExt}`;
    publicUrl = await storage.putPublicObject(publicKey, processed.mainBuf, processed.mainMime);
    if (processed.thumbBuf) {
      thumbKey = `public/${mediaRow.id}/thumb.webp`;
      thumbUrl = await storage.putPublicObject(thumbKey, processed.thumbBuf, 'image/webp');
    }
    width = processed.width;
    height = processed.height;
    durationSec = processed.durationSec;
    blurhash = processed.blurhash;
    finalMime = processed.mainMime;
    actualSizeBytes = processed.mainBuf.length;
  } else {
    const ext = EXT_BY_MIME[mediaRow.mime] ?? '.bin';
    publicKey = `public/${mediaRow.id}/file${ext}`;
    publicUrl = await storage.putPublicObject(publicKey, rawBuf, mediaRow.mime, {
      contentDisposition: `attachment; filename="tawasul-${mediaRow.id}${ext}"`,
    });
  }

  await storage.deleteObject(mediaRow.stagingKey);

  const db = getDb();
  await db
    .update(mediaTable)
    .set({
      status: 'ready',
      publicKey,
      thumbKey,
      publicUrl,
      thumbUrl,
      mime: finalMime,
      actualSizeBytes,
      width,
      height,
      durationSec,
      blurhash,
    })
    .where(eq(mediaTable.id, mediaRow.id));

  return {
    publicUrl,
    thumbUrl,
    width,
    height,
    durationSec,
    blurhash,
    mime: finalMime,
  };
}

export function registerMediaRoutes(app: Express): void {
  app.post(
    '/api/media/uploads',
    requireAuth,
    validateBody(MediaUploadInitSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { kind, mime, sizeBytes, sha256 } = req.body as {
          kind: MediaKind;
          mime: string;
          sizeBytes: number;
          sha256?: string;
        };

        const cfg = KIND_CONFIG[kind];
        if (!cfg) {
          sendApiError(res, 400, 'invalid_media_kind', 'نوع الوسائط غير مدعوم');
          return;
        }
        const normalizedMime = mime.split(';')[0]!.trim().toLowerCase();
        if (!cfg.mimes.has(normalizedMime)) {
          sendApiError(res, 400, 'unsupported_mime', 'صيغة الملف غير مدعومة لهذا النوع');
          return;
        }
        if (sizeBytes > cfg.maxBytes) {
          sendApiError(res, 400, 'file_too_large', 'حجم الملف يتجاوز الحد المسموح');
          return;
        }

        const mediaId = `med-${crypto.randomUUID()}`;
        const stagingKey = `staging/${authReq.auth!.userId}/${mediaId}`;
        const storage = getMediaStorage();
        const target = await storage.createSignedUploadUrl(stagingKey, normalizedMime, cfg.maxBytes, 900);

        const db = getDb();
        await db.insert(mediaTable).values({
          id: mediaId,
          ownerId: authReq.auth!.userId,
          kind,
          status: 'pending',
          stagingKey,
          mime: normalizedMime,
          declaredSizeBytes: sizeBytes,
          sha256: sha256 ?? null,
        });

        res.status(201).json({
          mediaId,
          ...target,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/media/uploads/:mediaId/complete',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const mediaId = String(req.params.mediaId);
        const db = getDb();

        const [mediaRow] = await db
          .select()
          .from(mediaTable)
          .where(eq(mediaTable.id, mediaId))
          .limit(1);

        if (!mediaRow) {
          sendApiError(res, 404, 'not_found', 'الملف غير موجود');
          return;
        }
        if (mediaRow.ownerId !== authReq.auth!.userId) {
          sendApiError(res, 403, 'forbidden', 'لا تملك صلاحية الوصول إلى هذا الملف');
          return;
        }
        if (mediaRow.status === 'ready') {
          res.json({
            mediaId: mediaRow.id,
            status: 'ready',
            publicUrl: mediaRow.publicUrl,
            thumbUrl: mediaRow.thumbUrl,
            width: mediaRow.width,
            height: mediaRow.height,
            durationSec: mediaRow.durationSec,
            blurhash: mediaRow.blurhash,
            mime: mediaRow.mime,
          });
          return;
        }
        if (mediaRow.status === 'deleted') {
          sendApiError(res, 410, 'media_deleted', 'تم حذف هذا الملف');
          return;
        }

        let parsedCrop: ServerCropSpec | undefined;
        if (req.body && typeof req.body === 'object' && Object.keys(req.body as Record<string, unknown>).length > 0) {
          const parsedComplete = MediaUploadCompleteSchema.safeParse(req.body);
          if (!parsedComplete.success) {
            sendApiError(res, 400, 'validation_error', 'بيانات قص الصورة غير صالحة');
            return;
          }
          parsedCrop = parsedComplete.data.crop;
        }

        const jobId = `job-${crypto.randomUUID()}`;
        await db.insert(mediaJobsTable).values({
          id: jobId,
          mediaId: mediaRow.id,
          status: 'processing',
        });

        await db
          .update(mediaTable)
          .set({ status: 'processing' })
          .where(eq(mediaTable.id, mediaRow.id));

        try {
          const result = await processAndFinalizeMedia(mediaRow, parsedCrop);
          await db
            .update(mediaJobsTable)
            .set({ status: 'completed', completedAt: new Date() })
            .where(eq(mediaJobsTable.id, jobId));

          res.json({
            mediaId: mediaRow.id,
            status: 'ready',
            ...result,
          });
        } catch (procErr) {
          const msg = procErr instanceof Error ? procErr.message : 'فشلت معالجة الوسائط';
          await db
            .update(mediaTable)
            .set({ status: 'failed' })
            .where(eq(mediaTable.id, mediaRow.id));
          await db
            .update(mediaJobsTable)
            .set({ status: 'failed', error: msg, completedAt: new Date() })
            .where(eq(mediaJobsTable.id, jobId));
          sendApiError(res, 400, 'media_processing_failed', msg);
        }
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete('/api/media/:mediaId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const mediaId = String(req.params.mediaId);
      const db = getDb();

      const [mediaRow] = await db
        .select()
        .from(mediaTable)
        .where(eq(mediaTable.id, mediaId))
        .limit(1);

      if (!mediaRow) {
        sendApiError(res, 404, 'not_found', 'الملف غير موجود');
        return;
      }
      if (
        mediaRow.ownerId !== authReq.auth!.userId &&
        authReq.auth!.role !== 'admin' &&
        authReq.auth!.role !== 'moderator'
      ) {
        sendApiError(res, 403, 'forbidden', 'لا تملك صلاحية حذف هذا الملف');
        return;
      }

      const storage = getMediaStorage();
      await Promise.all([
        storage.deleteObject(mediaRow.stagingKey),
        mediaRow.publicKey ? storage.deleteObject(mediaRow.publicKey) : Promise.resolve(),
        mediaRow.thumbKey ? storage.deleteObject(mediaRow.thumbKey) : Promise.resolve(),
      ]);

      await db
        .update(mediaTable)
        .set({ status: 'deleted' })
        .where(eq(mediaTable.id, mediaId));

      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });
}

async function deleteMediaRowAndObjects(row: typeof mediaTable.$inferSelect): Promise<void> {
  const storage = getMediaStorage();
  await Promise.all([
    storage.deleteObject(row.stagingKey),
    row.publicKey ? storage.deleteObject(row.publicKey) : Promise.resolve(),
    row.thumbKey ? storage.deleteObject(row.thumbKey) : Promise.resolve(),
  ]);
  const env = getEnv();
  if (env.MEDIA_DRIVER === 'local') {
    const publicDir = path.resolve(process.cwd(), '.data/uploads/public', row.id);
    await fs.rm(publicDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function deleteMediaByIdOrUrl(
  mediaId?: string | null,
  publicUrl?: string | null
): Promise<void> {
  if (!hasDatabaseConfig()) return;
  const cleanId = mediaId?.trim() || null;
  const cleanUrl = publicUrl?.trim() || null;
  if (!cleanId && !cleanUrl) return;

  const db = getDb();
  const cond =
    cleanId && cleanUrl
      ? or(eq(mediaTable.id, cleanId), eq(mediaTable.publicUrl, cleanUrl))
      : cleanId
        ? eq(mediaTable.id, cleanId)
        : eq(mediaTable.publicUrl, cleanUrl!);

  const rows = await db.select().from(mediaTable).where(cond);
  for (const row of rows) {
    await deleteMediaRowAndObjects(row);
    await db.update(mediaTable).set({ status: 'deleted' }).where(eq(mediaTable.id, row.id));
  }
}

async function isMediaUrlMissingOnDisk(url: string | null | undefined, isLocalDriver: boolean): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('/uploads/')) return true;
  if (!isLocalDriver) return false;
  if (!url.startsWith('/media/')) return false;
  const rel = url.slice('/media/'.length).replace(/^\/+/, '');
  if (!rel) return true;
  const localRoot = path.resolve(process.cwd(), '.data/uploads/public');
  const fullPath = path.resolve(localRoot, rel);
  if (!fullPath.startsWith(localRoot + path.sep)) return true;
  try {
    const st = await fs.stat(fullPath);
    return !st.isFile();
  } catch {
    return true;
  }
}

export async function reconcileBrokenMediaAndOrphans(): Promise<{
  brokenUserMediaCleared: number;
  brokenPostsFixed: number;
  brokenStoriesRemoved: number;
  orphanDirsRemoved: number;
}> {
  if (!hasDatabaseConfig()) {
    return {
      brokenUserMediaCleared: 0,
      brokenPostsFixed: 0,
      brokenStoriesRemoved: 0,
      orphanDirsRemoved: 0,
    };
  }

  const db = getDb();
  const env = getEnv();
  const isLocal = env.MEDIA_DRIVER === 'local';
  const nowIso = new Date().toISOString();

  let brokenUserMediaCleared = 0;
  let brokenPostsFixed = 0;
  let brokenStoriesRemoved = 0;
  let orphanDirsRemoved = 0;

  // 1. Users avatar/cover reconciliation
  const users = await db
    .select({
      id: usersTable.id,
      avatarUrl: usersTable.avatarUrl,
      coverUrl: usersTable.coverUrl,
    })
    .from(usersTable);
  for (const u of users) {
    const badAvatar = await isMediaUrlMissingOnDisk(u.avatarUrl, isLocal);
    const badCover = await isMediaUrlMissingOnDisk(u.coverUrl, isLocal);
    if (badAvatar || badCover) {
      await db
        .update(usersTable)
        .set({
          ...(badAvatar ? { avatarUrl: '' } : {}),
          ...(badCover ? { coverUrl: null } : {}),
        })
        .where(eq(usersTable.id, u.id));
      brokenUserMediaCleared += 1;
    }
  }

  // 2. Posts media reconciliation
  const posts = await db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      text: postsTable.text,
      mediaJson: postsTable.mediaJson,
      pollJson: postsTable.pollJson,
    })
    .from(postsTable);
  for (const p of posts) {
    const mediaArr = p.mediaJson as Array<{ url?: string; aspectRatio?: string; alt?: string }> | null;
    if (!Array.isArray(mediaArr) || mediaArr.length === 0) continue;
    const kept: Array<{ url?: string; aspectRatio?: string; alt?: string }> = [];
    for (const item of mediaArr) {
      const broken = await isMediaUrlMissingOnDisk(item?.url, isLocal);
      if (!broken && item?.url) {
        kept.push(item);
      }
    }
    if (kept.length !== mediaArr.length) {
      if (kept.length === 0 && !p.text.trim() && !p.pollJson) {
        await db.delete(postsTable).where(eq(postsTable.id, p.id));
        await db
          .update(usersTable)
          .set({ postsCount: sql`GREATEST(0, ${usersTable.postsCount} - 1)` })
          .where(eq(usersTable.id, p.authorId));
      } else {
        await db
          .update(postsTable)
          .set({ mediaJson: kept.length > 0 ? kept : null })
          .where(eq(postsTable.id, p.id));
      }
      brokenPostsFixed += 1;
    }
  }

  // 3. Products image reconciliation
  const products = await db
    .select({ id: productsTable.id, imageUrl: productsTable.imageUrl })
    .from(productsTable);
  for (const prod of products) {
    if (await isMediaUrlMissingOnDisk(prod.imageUrl, isLocal)) {
      await db.update(productsTable).set({ imageUrl: '' }).where(eq(productsTable.id, prod.id));
    }
  }

  // 4. Stories reconciliation (remove legacy mode='reel', expired, or missing non-text media)
  const stories = await db
    .select({
      id: storiesTable.id,
      authorId: storiesTable.authorId,
      mode: storiesTable.mode,
      mediaType: storiesTable.mediaType,
      mediaUrl: storiesTable.mediaUrl,
      expiresAt: storiesTable.expiresAt,
    })
    .from(storiesTable);
  const badStoryIds: string[] = [];
  for (const s of stories) {
    const isExpired = Boolean(s.expiresAt && s.expiresAt <= nowIso);
    const isLegacyReel = s.mode === 'reel';
    const isMissingMedia =
      s.mediaType !== 'text' && (!s.mediaUrl || (await isMediaUrlMissingOnDisk(s.mediaUrl, isLocal)));
    if (isExpired || isLegacyReel || isMissingMedia) {
      badStoryIds.push(s.id);
    }
  }
  if (badStoryIds.length > 0) {
    await db.delete(storiesTable).where(inArray(storiesTable.id, badStoryIds));
    brokenStoriesRemoved = badStoryIds.length;
  }

  // Recompute users.hasActiveStory accurately
  const remainingStories = await db
    .select({ authorId: storiesTable.authorId })
    .from(storiesTable);
  const activeAuthorIds = new Set(remainingStories.map((s) => s.authorId));
  await db.update(usersTable).set({ hasActiveStory: false });
  if (activeAuthorIds.size > 0) {
    await db
      .update(usersTable)
      .set({ hasActiveStory: true })
      .where(inArray(usersTable.id, Array.from(activeAuthorIds)));
  }

  // 5. Orphaned local upload directories (.data/uploads/public/med-*)
  if (isLocal) {
    const publicRoot = path.resolve(process.cwd(), '.data/uploads/public');
    try {
      const entries = await fs.readdir(publicRoot, { withFileTypes: true });
      const medDirs = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('med-'))
        .map((e) => e.name);
      if (medDirs.length > 0) {
        const dbMedia = await db
          .select({ id: mediaTable.id, status: mediaTable.status })
          .from(mediaTable)
          .where(inArray(mediaTable.id, medDirs));
        const activeIds = new Set(
          dbMedia
            .filter((m) => m.status !== 'deleted' && m.status !== 'failed')
            .map((m) => m.id)
        );
        for (const dirName of medDirs) {
          if (!activeIds.has(dirName)) {
            await fs.rm(path.join(publicRoot, dirName), { recursive: true, force: true }).catch(() => undefined);
            orphanDirsRemoved += 1;
          }
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }

  return {
    brokenUserMediaCleared,
    brokenPostsFixed,
    brokenStoriesRemoved,
    orphanDirsRemoved,
  };
}

export async function runMediaCleanupOnce(now = new Date()): Promise<{
  stalePendingCleaned: number;
  orphansCleaned: number;
  expiredStoriesCleaned: number;
  expiredMomentsCleaned: number;
  deletedUsersPurged: number;
}> {
  if (!hasDatabaseConfig()) {
    return {
      stalePendingCleaned: 0,
      orphansCleaned: 0,
      expiredStoriesCleaned: 0,
      expiredMomentsCleaned: 0,
      deletedUsersPurged: 0,
    };
  }

  const db = getDb();
  const storage = getMediaStorage();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const expiredThresholdIso = oneHourAgo.toISOString();

  // 1. Stale pending uploads > 1h
  const stalePending = await db
    .select()
    .from(mediaTable)
    .where(and(eq(mediaTable.status, 'pending'), lt(mediaTable.createdAt, oneHourAgo)));
  for (const row of stalePending) {
    await storage.deleteObject(row.stagingKey);
    await db.update(mediaTable).set({ status: 'deleted' }).where(eq(mediaTable.id, row.id));
  }

  // 2. Orphaned ready media (usedById IS NULL) > 24h
  const orphans = await db
    .select()
    .from(mediaTable)
    .where(
      and(
        eq(mediaTable.status, 'ready'),
        sql`${mediaTable.usedById} IS NULL`,
        lt(mediaTable.createdAt, oneDayAgo)
      )
    );
  for (const row of orphans) {
    await deleteMediaRowAndObjects(row);
    await db.update(mediaTable).set({ status: 'deleted' }).where(eq(mediaTable.id, row.id));
  }

  // 3. Expired stories (+1h grace)
  const expiredStories = await db
    .select({ id: storiesTable.id, mediaId: storiesTable.mediaId })
    .from(storiesTable)
    .where(lt(storiesTable.expiresAt, expiredThresholdIso));
  if (expiredStories.length > 0) {
    const storyMediaIds = expiredStories
      .map((s) => s.mediaId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (storyMediaIds.length > 0) {
      const mRows = await db.select().from(mediaTable).where(inArray(mediaTable.id, storyMediaIds));
      for (const m of mRows) {
        await deleteMediaRowAndObjects(m);
        await db.update(mediaTable).set({ status: 'deleted' }).where(eq(mediaTable.id, m.id));
      }
    }
    await db
      .delete(storiesTable)
      .where(inArray(storiesTable.id, expiredStories.map((s) => s.id)));
  }

  // 4. Expired social moments (notes/instants +1h grace)
  const expiredMoments = await db
    .select({ id: socialMomentsTable.id, mediaId: socialMomentsTable.mediaId })
    .from(socialMomentsTable)
    .where(lt(socialMomentsTable.expiresAt, expiredThresholdIso));
  if (expiredMoments.length > 0) {
    const momentMediaIds = expiredMoments
      .map((m) => m.mediaId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (momentMediaIds.length > 0) {
      const mRows = await db.select().from(mediaTable).where(inArray(mediaTable.id, momentMediaIds));
      for (const m of mRows) {
        await deleteMediaRowAndObjects(m);
        await db.update(mediaTable).set({ status: 'deleted' }).where(eq(mediaTable.id, m.id));
      }
    }
    await db
      .delete(socialMomentsTable)
      .where(inArray(socialMomentsTable.id, expiredMoments.map((m) => m.id)));
  }

  // 5. Deleted accounts past 30 days
  const purgeUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.status, 'deleted'), lt(usersTable.deletedAt, thirtyDaysAgo)));
  for (const u of purgeUsers) {
    const userMedia = await db.select().from(mediaTable).where(eq(mediaTable.ownerId, u.id));
    for (const m of userMedia) {
      await deleteMediaRowAndObjects(m);
    }
    await db.delete(usersTable).where(eq(usersTable.id, u.id));
  }

  await reconcileBrokenMediaAndOrphans().catch((err) => {
    logger.warn({ err }, 'Media reconciliation pass warning');
  });

  return {
    stalePendingCleaned: stalePending.length,
    orphansCleaned: orphans.length,
    expiredStoriesCleaned: expiredStories.length,
    expiredMomentsCleaned: expiredMoments.length,
    deletedUsersPurged: purgeUsers.length,
  };
}

let cleanupTimer: NodeJS.Timeout | null = null;

export function startMediaCleanupScheduler(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    void runMediaCleanupOnce().catch((err) => {
      logger.error({ err }, 'Media background cleanup job failed');
    });
  }, 10 * 60 * 1000);
  cleanupTimer.unref();
}

export function stopMediaCleanupScheduler(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
