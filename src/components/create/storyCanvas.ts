import type { StoryOverlayItem } from '../../types';
import { resolveStoryCanvasFormat } from '../../lib/remediation';

const TARGET_W = 1080;
const TARGET_H = 1920;

function resolveTokenColor(token?: string): string {
  if (!token) return '#ffffff';
  if (!token.startsWith('var(')) return token;
  const varName = token.slice(4, -1).trim();
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return resolved || '#ffffff';
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function canvasHasPixels(canvas: HTMLCanvasElement | null | undefined): boolean {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 16) {
      if (data[i]! > 0) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Renders an image story to a 1080x1920 canvas while preserving GIF animation and PNG transparency:
 * 1) Dark backdrop & blurred cover copy for opaque JPEG images
 * 2) Crisp contained image centered on top (never cropped)
 * 3) Freehand draw canvas + text overlays baked on top
 */
export async function renderStoryImageTo1080x1920(
  imageUrl: string,
  drawCanvas?: HTMLCanvasElement | null,
  overlays: StoryOverlayItem[] = [],
  mime?: string
): Promise<{ dataUrl: string; remainingOverlays: StoryOverlayItem[] }> {
  try {
    const inferredMime = mime
      ? mime
      : imageUrl.startsWith('data:')
      ? imageUrl.slice(5, Math.max(5, imageUrl.indexOf(';')))
      : /\.gif(\?|#|$)/i.test(imageUrl)
      ? 'image/gif'
      : /\.png(\?|#|$)/i.test(imageUrl)
      ? 'image/png'
      : 'image/jpeg';

    const fmt = resolveStoryCanvasFormat(inferredMime);
    if (fmt.skipCanvasRasterize) {
      return { dataUrl: imageUrl, remainingOverlays: overlays };
    }

    const hasDraw = Boolean(drawCanvas && canvasHasPixels(drawCanvas));
    const hasTextOverlays = overlays.some((ov) => ov.kind === 'text' && Boolean(ov.text));
    if (fmt.preserveAlpha && !hasDraw && !hasTextOverlays) {
      return { dataUrl: imageUrl, remainingOverlays: overlays };
    }

    const img = await loadHtmlImage(imageUrl);
    const imgW = img.naturalWidth || img.width || TARGET_W;
    const imgH = img.naturalHeight || img.height || TARGET_H;

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: imageUrl, remainingOverlays: overlays };

    if (!fmt.preserveAlpha) {
      // 1. Dark base fill for opaque outputs
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, TARGET_W, TARGET_H);

      // 2. Blurred cover copy underneath
      const coverScale = Math.max(TARGET_W / imgW, TARGET_H / imgH) * 1.1;
      const coverW = imgW * coverScale;
      const coverH = imgH * coverScale;
      ctx.save();
      ctx.globalAlpha = 0.6;
      if ('filter' in ctx) {
        ctx.filter = 'blur(36px)';
      }
      ctx.drawImage(img, (TARGET_W - coverW) / 2, (TARGET_H - coverH) / 2, coverW, coverH);
      ctx.restore();
    } else {
      ctx.clearRect(0, 0, TARGET_W, TARGET_H);
    }

    // 3. Sharp contained picture on top
    const containScale = Math.min(TARGET_W / imgW, TARGET_H / imgH);
    const drawW = imgW * containScale;
    const drawH = imgH * containScale;
    ctx.drawImage(img, (TARGET_W - drawW) / 2, (TARGET_H - drawH) / 2, drawW, drawH);

    // 4. Freehand drawing canvas
    if (hasDraw && drawCanvas) {
      ctx.drawImage(drawCanvas, 0, 0, TARGET_W, TARGET_H);
    }

    // 5. Bake text overlays; preserve non-text interactive stickers separately
    const remainingOverlays: StoryOverlayItem[] = [];
    for (const ov of overlays) {
      if (ov.kind !== 'text' || !ov.text) {
        remainingOverlays.push(ov);
        continue;
      }

      const cx = (ov.xPct / 100) * TARGET_W;
      const cy = (ov.yPct / 100) * TARGET_H;
      const scale = ov.scale || 1;
      const rot = ((ov.rotation || 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.font = '700 54px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(ov.text);
      const padX = 28;
      const boxW = Math.min(TARGET_W * 0.85, metrics.width + padX * 2);
      const boxH = 88;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 24);
      ctx.fill();

      ctx.fillStyle = resolveTokenColor(ov.colorToken);
      ctx.fillText(ov.text, 0, 2, TARGET_W * 0.8);
      ctx.restore();
    }

    return {
      dataUrl:
        fmt.exportMime === 'image/png'
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.92),
      remainingOverlays,
    };
  } catch {
    return { dataUrl: imageUrl, remainingOverlays: overlays };
  }
}
