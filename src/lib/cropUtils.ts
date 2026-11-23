export type CropFitMode = 'cover' | 'contain';

export interface CropLayoutInput {
  naturalWidth: number;
  naturalHeight: number;
  boxWidth: number;
  boxHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  fitMode: CropFitMode;
}

export interface CropLayoutResult {
  baseScale: number;
  scale: number;
  renderWidth: number;
  renderHeight: number;
  drawX: number;
  drawY: number;
  clampedPanX: number;
  clampedPanY: number;
  maxPanX: number;
  maxPanY: number;
}

export const MIN_CROP_ZOOM = 1;
export const MAX_CROP_ZOOM = 3;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min === 0 ? 0 : min;
  if (min > max) return min === 0 ? 0 : min;
  const clamped = Math.min(max, Math.max(min, value));
  return clamped === 0 ? 0 : clamped;
}

export function clampZoom(zoom: number): number {
  return clampNumber(zoom, MIN_CROP_ZOOM, MAX_CROP_ZOOM);
}

/**
 * Computes exact scale-invariant image placement inside a crop box.
 * `panX` and `panY` are expressed as fractions of `boxWidth` and `boxHeight`,
 * so identical normalized pan values map identically between a preview box
 * and a high-resolution export canvas of the same aspect ratio.
 */
export function computeCropLayout(input: CropLayoutInput): CropLayoutResult {
  const naturalWidth = Math.max(1, input.naturalWidth);
  const naturalHeight = Math.max(1, input.naturalHeight);
  const boxWidth = Math.max(1, input.boxWidth);
  const boxHeight = Math.max(1, input.boxHeight);
  const zoom = clampZoom(input.zoom);

  const widthRatio = boxWidth / naturalWidth;
  const heightRatio = boxHeight / naturalHeight;
  const baseScale =
    input.fitMode === 'contain'
      ? Math.min(widthRatio, heightRatio)
      : Math.max(widthRatio, heightRatio);

  const scale = baseScale * zoom;
  const renderWidth = naturalWidth * scale;
  const renderHeight = naturalHeight * scale;

  const maxOffsetX = Math.max(0, (renderWidth - boxWidth) / 2);
  const maxOffsetY = Math.max(0, (renderHeight - boxHeight) / 2);
  const maxPanX = maxOffsetX / boxWidth;
  const maxPanY = maxOffsetY / boxHeight;

  const clampedPanX = clampNumber(input.panX, -maxPanX, maxPanX);
  const clampedPanY = clampNumber(input.panY, -maxPanY, maxPanY);

  const drawX = (boxWidth - renderWidth) / 2 + clampedPanX * boxWidth;
  const drawY = (boxHeight - renderHeight) / 2 + clampedPanY * boxHeight;

  return {
    baseScale,
    scale,
    renderWidth,
    renderHeight,
    drawX,
    drawY,
    clampedPanX,
    clampedPanY,
    maxPanX,
    maxPanY,
  };
}

export interface DragDeltaInput {
  panX: number;
  panY: number;
  deltaX: number;
  deltaY: number;
  naturalWidth: number;
  naturalHeight: number;
  boxWidth: number;
  boxHeight: number;
  zoom: number;
  fitMode: CropFitMode;
}

/**
 * Converts pointer drag deltas in stage pixels into clamped normalized pan coordinates.
 */
export function applyCropDragDelta(input: DragDeltaInput): { panX: number; panY: number } {
  const boxWidth = Math.max(1, input.boxWidth);
  const boxHeight = Math.max(1, input.boxHeight);
  const nextPanX = input.panX + input.deltaX / boxWidth;
  const nextPanY = input.panY + input.deltaY / boxHeight;

  const layout = computeCropLayout({
    naturalWidth: input.naturalWidth,
    naturalHeight: input.naturalHeight,
    boxWidth,
    boxHeight,
    zoom: input.zoom,
    panX: nextPanX,
    panY: nextPanY,
    fitMode: input.fitMode,
  });

  return {
    panX: layout.clampedPanX,
    panY: layout.clampedPanY,
  };
}

export type ImageSourceFormat = 'png' | 'gif' | 'webp' | 'jpeg';

export function detectImageFormat(
  mime?: string | null,
  fileName?: string | null
): ImageSourceFormat {
  const normMime = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (normMime === 'image/gif') return 'gif';
  if (normMime === 'image/png') return 'png';
  if (normMime === 'image/webp') return 'webp';
  if (normMime === 'image/jpeg' || normMime === 'image/jpg') return 'jpeg';

  const cleanName = (fileName ?? '').split('?')[0]?.split('#')[0]?.trim().toLowerCase() ?? '';
  if (cleanName.endsWith('.gif')) return 'gif';
  if (cleanName.endsWith('.png')) return 'png';
  if (cleanName.endsWith('.webp')) return 'webp';
  return 'jpeg';
}

export interface ServerCropSpec {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  outputWidth: number;
  outputHeight: number;
  fitMode: CropFitMode;
}

/**
 * Computes exact natural-pixel source crop and output-pixel destination placement
 * for server-side animated GIF / WebP processing.
 */
export function computeServerCropSpec(
  input: CropLayoutInput & { outputWidth: number; outputHeight: number }
): ServerCropSpec {
  const naturalWidth = Math.max(1, Math.round(input.naturalWidth));
  const naturalHeight = Math.max(1, Math.round(input.naturalHeight));
  const boxWidth = Math.max(1, input.boxWidth);
  const boxHeight = Math.max(1, input.boxHeight);
  const outputWidth = Math.max(32, Math.round(input.outputWidth));
  const outputHeight = Math.max(32, Math.round(input.outputHeight));

  const layout = computeCropLayout({
    ...input,
    naturalWidth,
    naturalHeight,
    boxWidth,
    boxHeight,
  });

  const visLeft = Math.max(0, layout.drawX);
  const visTop = Math.max(0, layout.drawY);
  const visRight = Math.min(boxWidth, layout.drawX + layout.renderWidth);
  const visBottom = Math.min(boxHeight, layout.drawY + layout.renderHeight);

  const sx = Math.max(0, Math.min(naturalWidth - 1, Math.round((visLeft - layout.drawX) / layout.scale)));
  const sy = Math.max(0, Math.min(naturalHeight - 1, Math.round((visTop - layout.drawY) / layout.scale)));
  const sw = Math.max(
    1,
    Math.min(naturalWidth - sx, Math.round((visRight - visLeft) / layout.scale))
  );
  const sh = Math.max(
    1,
    Math.min(naturalHeight - sy, Math.round((visBottom - visTop) / layout.scale))
  );

  const dx = Math.max(0, Math.min(outputWidth - 1, Math.round((visLeft / boxWidth) * outputWidth)));
  const dy = Math.max(0, Math.min(outputHeight - 1, Math.round((visTop / boxHeight) * outputHeight)));
  const dw = Math.max(
    1,
    Math.min(outputWidth - dx, Math.round(((visRight - visLeft) / boxWidth) * outputWidth))
  );
  const dh = Math.max(
    1,
    Math.min(outputHeight - dy, Math.round(((visBottom - visTop) / boxHeight) * outputHeight))
  );

  return {
    sx,
    sy,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh,
    outputWidth,
    outputHeight,
    fitMode: input.fitMode,
  };
}

const blobCropRegistry = new WeakMap<Blob, ServerCropSpec>();

export function attachBlobCropSpec(blob: Blob, spec: ServerCropSpec): void {
  blobCropRegistry.set(blob, spec);
}

export function consumeBlobCropSpec(blob: Blob): ServerCropSpec | undefined {
  const spec = blobCropRegistry.get(blob);
  if (spec) {
    blobCropRegistry.delete(blob);
  }
  return spec;
}

