import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from './env.ts';
import { sendApiError } from './schemas.ts';

export interface SignedUploadTarget {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSec: number;
}

export interface HeadObjectResult {
  contentLength: number;
  contentType?: string;
}

export interface MediaStorage {
  createSignedUploadUrl(
    key: string,
    contentType: string,
    maxBytes: number,
    expiresInSec?: number
  ): Promise<SignedUploadTarget>;
  headObject(key: string): Promise<HeadObjectResult | null>;
  readRange(key: string, start: number, end: number): Promise<Buffer>;
  readAll(key: string): Promise<Buffer>;
  putPublicObject(
    key: string,
    body: Buffer,
    contentType: string,
    options?: { cacheControl?: string; contentDisposition?: string }
  ): Promise<string>;
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

class S3MediaStorage implements MediaStorage {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    const env = getEnv();
    this.bucket = env.S3_BUCKET!;
    this.publicBaseUrl = env.MEDIA_PUBLIC_BASE_URL!.replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION ?? 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }

  async createSignedUploadUrl(
    key: string,
    contentType: string,
    _maxBytes: number,
    expiresInSec = 900
  ): Promise<SignedUploadTarget> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: expiresInSec });
    return {
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresInSec,
    };
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return {
        contentLength: res.ContentLength ?? 0,
        contentType: res.ContentType,
      };
    } catch {
      return null;
    }
  }

  async readRange(key: string, start: number, end: number): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=${start}-${end}`,
      })
    );
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : Buffer.alloc(0);
  }

  async readAll(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : Buffer.alloc(0);
  }

  async putPublicObject(
    key: string,
    body: Buffer,
    contentType: string,
    options?: { cacheControl?: string; contentDisposition?: string }
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: options?.cacheControl ?? 'public, max-age=31536000, immutable',
        ...(options?.contentDisposition
          ? { ContentDisposition: options.contentDisposition }
          : {}),
      })
    );
    return this.getPublicUrl(key);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // Ignore missing key on cleanup
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.replace(/^\/+/, '')}`;
  }
}

interface LocalUploadTokenPayload {
  key: string;
  contentType: string;
  maxBytes: number;
  exp: number;
}

const LOCAL_UPLOAD_ROOT = path.resolve(process.cwd(), '.data/uploads');
const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

function safeResolveLocalPath(key: string): string {
  const cleaned = key.replace(/^\/+/, '');
  const resolved = path.resolve(LOCAL_UPLOAD_ROOT, cleaned);
  if (!resolved.startsWith(LOCAL_UPLOAD_ROOT + path.sep) && resolved !== LOCAL_UPLOAD_ROOT) {
    throw new Error('Invalid storage path');
  }
  return resolved;
}

function signLocalToken(payload: LocalUploadTokenPayload): string {
  const env = getEnv();
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', env.SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyLocalToken(token: string): LocalUploadTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;
  const env = getEnv();
  const expected = crypto.createHmac('sha256', env.SESSION_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as LocalUploadTokenPayload;
    if (
      typeof parsed.key !== 'string' ||
      typeof parsed.maxBytes !== 'number' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

class LocalMediaStorage implements MediaStorage {
  async createSignedUploadUrl(
    key: string,
    contentType: string,
    maxBytes: number,
    expiresInSec = 900
  ): Promise<SignedUploadTarget> {
    const token = signLocalToken({
      key,
      contentType,
      maxBytes,
      exp: Date.now() + expiresInSec * 1000,
    });
    return {
      uploadUrl: `/uploads/${token}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresInSec,
    };
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    try {
      const target = safeResolveLocalPath(key);
      const stat = await fs.stat(target);
      if (!stat.isFile()) return null;
      return { contentLength: stat.size };
    } catch {
      return null;
    }
  }

  async readRange(key: string, start: number, end: number): Promise<Buffer> {
    const target = safeResolveLocalPath(key);
    const fh = await fs.open(target, 'r');
    try {
      const length = Math.max(0, end - start + 1);
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, start);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  async readAll(key: string): Promise<Buffer> {
    const target = safeResolveLocalPath(key);
    return fs.readFile(target);
  }

  async putPublicObject(key: string, body: Buffer): Promise<string> {
    const target = safeResolveLocalPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return this.getPublicUrl(key);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const target = safeResolveLocalPath(key);
      await fs.unlink(target);
    } catch {
      // Ignore missing file
    }
  }

  getPublicUrl(key: string): string {
    const clean = key.replace(/^\/+/, '');
    if (clean.startsWith('public/')) {
      return `/media/${clean.slice('public/'.length)}`;
    }
    return `/media/${clean}`;
  }
}

let storageInstance: MediaStorage | null = null;

export function getMediaStorage(): MediaStorage {
  const env = getEnv();
  if (env.MEDIA_DRIVER === 's3') {
    if (!(storageInstance instanceof S3MediaStorage)) {
      storageInstance = new S3MediaStorage();
    }
    return storageInstance;
  }
  if (!(storageInstance instanceof LocalMediaStorage)) {
    storageInstance = new LocalMediaStorage();
  }
  return storageInstance;
}

export function registerLocalMediaRoutes(app: Express): void {
  const env = getEnv();
  if (env.MEDIA_DRIVER !== 'local') return;

  app.put(
    '/uploads/:token',
    express.raw({ type: '*/*', limit: '55mb' }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = String(req.params.token ?? '');
        const payload = verifyLocalToken(token);
        if (!payload) {
          sendApiError(res, 403, 'invalid_upload_token', 'رابط الرفع غير صالح أو منتهي الصلاحية');
          return;
        }
        const body = req.body as Buffer;
        if (!Buffer.isBuffer(body) || body.length === 0) {
          sendApiError(res, 400, 'empty_upload', 'الملف المرفوع فارغ');
          return;
        }
        if (body.length > payload.maxBytes) {
          sendApiError(res, 413, 'payload_too_large', 'حجم الملف يتجاوز الحد المسموح');
          return;
        }
        const target = safeResolveLocalPath(payload.key);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, body);
        res.status(200).json({ ok: true, sizeBytes: body.length });
      } catch (err) {
        next(err);
      }
    }
  );

  app.use('/media', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const rel = req.path.replace(/^\/+/, '');
    if (!rel) {
      res.status(404).end();
      return;
    }
    let filePath: string;
    try {
      filePath = safeResolveLocalPath(`public/${rel}`);
    } catch {
      res.status(403).end();
      return;
    }
    if (!fsSync.existsSync(filePath)) {
      res.status(404).end();
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', mime);

    const isInlineMedia =
      mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/');
    if (!isInlineMedia) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    }

    res.sendFile(filePath, { dotfiles: 'allow' });
  });
}
