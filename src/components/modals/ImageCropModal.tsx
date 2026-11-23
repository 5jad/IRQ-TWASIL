import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Maximize2, Minimize2, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  applyCropDragDelta,
  attachBlobCropSpec,
  clampZoom,
  computeCropLayout,
  computeServerCropSpec,
  type CropFitMode,
  detectImageFormat,
  MAX_CROP_ZOOM,
  MIN_CROP_ZOOM,
} from '../../lib/cropUtils';

export interface ImageCropModalProps {
  isOpen: boolean;
  file: File | null;
  shape?: 'circle' | 'rect';
  aspectRatio?: number;
  outputWidth?: number;
  outputHeight?: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => Promise<void> | void;
}

export function ImageCropModal({
  isOpen,
  file,
  shape = 'circle',
  aspectRatio = 1,
  outputWidth = 1024,
  outputHeight = 1024,
  title = 'تحديد قص الصورة',
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: aspectRatio >= 2 ? 420 : 288,
    height: aspectRatio >= 2 ? 140 : 288,
  });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState<CropFitMode>('cover');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);

  const imageFormat = useMemo(
    () => detectImageFormat(file?.type, file?.name),
    [file?.type, file?.name]
  );
  const isGif = imageFormat === 'gif';
  const isTransparentFormat = imageFormat === 'png' || imageFormat === 'webp';

  useEffect(() => {
    if (!isOpen || !file) {
      setImageUrl(null);
      setNaturalSize(null);
      setErrorMsg('');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    setNaturalSize(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFitMode('cover');
    setErrorMsg('');
    setIsProcessing(false);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, file]);

  useEffect(() => {
    if (!isOpen) return;
    const el = stageRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, aspectRatio]);

  const layout = useMemo(() => {
    const natW = naturalSize?.width ?? stageSize.width;
    const natH = naturalSize?.height ?? stageSize.height;
    return computeCropLayout({
      naturalWidth: natW,
      naturalHeight: natH,
      boxWidth: stageSize.width,
      boxHeight: stageSize.height,
      zoom,
      panX: pan.x,
      panY: pan.y,
      fitMode,
    });
  }, [naturalSize, stageSize.width, stageSize.height, zoom, pan.x, pan.y, fitMode]);

  const backdropLayout = useMemo(() => {
    const natW = naturalSize?.width ?? stageSize.width;
    const natH = naturalSize?.height ?? stageSize.height;
    return computeCropLayout({
      naturalWidth: natW,
      naturalHeight: natH,
      boxWidth: stageSize.width,
      boxHeight: stageSize.height,
      zoom: 1.08,
      panX: 0,
      panY: 0,
      fitMode: 'cover',
    });
  }, [naturalSize, stageSize.width, stageSize.height]);

  const handleZoomChange = (nextZoom: number) => {
    const clamped = clampZoom(nextZoom);
    setZoom(clamped);
    if (naturalSize) {
      const nextLayout = computeCropLayout({
        naturalWidth: naturalSize.width,
        naturalHeight: naturalSize.height,
        boxWidth: stageSize.width,
        boxHeight: stageSize.height,
        zoom: clamped,
        panX: pan.x,
        panY: pan.y,
        fitMode,
      });
      setPan({ x: nextLayout.clampedPanX, y: nextLayout.clampedPanY });
    }
  };

  const handleFitModeChange = (nextMode: CropFitMode) => {
    setFitMode(nextMode);
    if (naturalSize) {
      const nextLayout = computeCropLayout({
        naturalWidth: naturalSize.width,
        naturalHeight: naturalSize.height,
        boxWidth: stageSize.width,
        boxHeight: stageSize.height,
        zoom,
        panX: pan.x,
        panY: pan.y,
        fitMode: nextMode,
      });
      setPan({ x: nextLayout.clampedPanX, y: nextLayout.clampedPanY });
    }
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFitMode('cover');
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || isProcessing) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !naturalSize) return;
    const deltaX = e.clientX - drag.lastX;
    const deltaY = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;

    setPan((prev) => {
      const next = applyCropDragDelta({
        panX: prev.x,
        panY: prev.y,
        deltaX,
        deltaY,
        naturalWidth: naturalSize.width,
        naturalHeight: naturalSize.height,
        boxWidth: stageSize.width,
        boxHeight: stageSize.height,
        zoom,
        fitMode,
      });
      return { x: next.panX, y: next.panY };
    });
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!naturalSize || isProcessing) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.1 : -0.1;
    handleZoomChange(zoom + step);
  };

  const handleConfirm = async () => {
    const imgEl = imageRef.current;
    if (!imgEl || !naturalSize || naturalSize.width <= 0 || naturalSize.height <= 0) {
      setErrorMsg('تعذّر قراءة أبعاد الصورة، جرّب اختيار صورة أخرى.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (isGif && file) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error('حجم صورة GIF يتجاوز الحد الأقصى المسموح (٥ ميجابايت)');
        }
        const gifOutW = outputWidth >= 1200 ? 960 : Math.min(outputWidth, 512);
        const gifOutH = Math.max(32, Math.round(gifOutW * (outputHeight / outputWidth)));
        const cropSpec = computeServerCropSpec({
          naturalWidth: naturalSize.width,
          naturalHeight: naturalSize.height,
          boxWidth: stageSize.width,
          boxHeight: stageSize.height,
          zoom,
          panX: layout.clampedPanX,
          panY: layout.clampedPanY,
          fitMode,
          outputWidth: gifOutW,
          outputHeight: gifOutH,
        });
        attachBlobCropSpec(file, cropSpec);
        await onConfirm(file);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('تعذّر تجهيز أداة القص في المتصفح');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (isTransparentFormat) {
        ctx.clearRect(0, 0, outputWidth, outputHeight);
      } else if (fitMode === 'contain') {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, outputWidth, outputHeight);

        const bgLayout = computeCropLayout({
          naturalWidth: naturalSize.width,
          naturalHeight: naturalSize.height,
          boxWidth: outputWidth,
          boxHeight: outputHeight,
          zoom: 1.08,
          panX: 0,
          panY: 0,
          fitMode: 'cover',
        });

        ctx.save();
        ctx.filter = 'blur(26px) brightness(0.6)';
        ctx.drawImage(imgEl, bgLayout.drawX, bgLayout.drawY, bgLayout.renderWidth, bgLayout.renderHeight);
        ctx.restore();
      } else {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, outputWidth, outputHeight);
      }

      const exportLayout = computeCropLayout({
        naturalWidth: naturalSize.width,
        naturalHeight: naturalSize.height,
        boxWidth: outputWidth,
        boxHeight: outputHeight,
        zoom,
        panX: layout.clampedPanX,
        panY: layout.clampedPanY,
        fitMode,
      });

      ctx.drawImage(
        imgEl,
        exportLayout.drawX,
        exportLayout.drawY,
        exportLayout.renderWidth,
        exportLayout.renderHeight
      );

      let outMime: 'image/png' | 'image/webp' | 'image/jpeg' =
        imageFormat === 'png' ? 'image/png' : imageFormat === 'webp' ? 'image/webp' : 'image/jpeg';
      let blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outMime, outMime === 'image/png' ? undefined : 0.92);
      });

      if (blob && outMime === 'image/png' && blob.size > 4.2 * 1024 * 1024) {
        const webpBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/webp', 0.9);
        });
        if (webpBlob && webpBlob.size < blob.size) {
          blob = webpBlob;
          outMime = 'image/webp';
        }
      }

      if (!blob) {
        throw new Error('تعذّر إنشاء الصورة المقصوصة');
      }

      const ext = outMime === 'image/png' ? 'png' : outMime === 'image/webp' ? 'webp' : 'jpg';
      const baseName = (file?.name || 'profile-image').replace(/\.[^/.]+$/, '');
      const croppedFile = new File([blob], `${baseName}-cropped.${ext}`, {
        type: outMime,
      });

      await onConfirm(croppedFile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء قص الصورة');
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isProcessing) onCancel();
      }}
      title={title}
      testId="tw-image-crop-modal"
      contentClassName="max-w-lg bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-sans text-base font-bold text-[var(--text)] leading-normal">{title}</h2>
            <span className="text-xs text-[var(--text-muted)]">
              اسحب الصورة وحدد الجزء المناسب أو اختر إظهارها كاملة قبل الحفظ
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            data-testid="tw-crop-close-btn"
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Stage */}
        <div className="p-4 bg-[var(--surface-2)] flex flex-col items-center gap-3">
          <div
            ref={stageRef}
            dir="ltr"
            data-testid="tw-crop-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={handleWheel}
            className={`relative overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing border border-[var(--border-strong)] shadow-inner ${
              isTransparentFormat ? 'bg-[var(--surface)]' : 'bg-slate-950'
            } ${
              aspectRatio >= 2
                ? 'w-full aspect-[3/1] rounded-2xl'
                : 'w-full max-w-[300px] sm:max-w-[330px] aspect-square rounded-2xl'
            }`}
          >
            {imageUrl && fitMode === 'contain' && !isTransparentFormat && naturalSize && (
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute top-0 left-0 pointer-events-none blur-xl opacity-55"
                style={{
                  width: backdropLayout.renderWidth,
                  height: backdropLayout.renderHeight,
                  maxWidth: 'none',
                  transform: `translate3d(${backdropLayout.drawX}px, ${backdropLayout.drawY}px, 0)`,
                }}
              />
            )}

            {imageUrl && (
              <img
                ref={imageRef}
                src={imageUrl}
                alt="معاينة القص"
                draggable={false}
                onLoad={(e) => {
                  const target = e.currentTarget;
                  if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                    setNaturalSize({
                      width: target.naturalWidth,
                      height: target.naturalHeight,
                    });
                  }
                }}
                onError={() => setErrorMsg('تعذّر تحميل الصورة المختارة.')}
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: layout.renderWidth,
                  height: layout.renderHeight,
                  maxWidth: 'none',
                  transform: `translate3d(${layout.drawX}px, ${layout.drawY}px, 0)`,
                }}
              />
            )}

            {/* Visual Cutout Guide */}
            {shape === 'circle' ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.62)]"
              />
            ) : (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 border-2 border-white/80 rounded-2xl"
              >
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5" />
              <span>اسحب لتحريك الصورة داخل الإطار</span>
            </span>
            {isGif && (
              <span
                data-testid="tw-crop-format-badge"
                className="px-2 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] font-bold"
              >
                GIF متحرك · يحافظ على الحركة
              </span>
            )}
            {imageFormat === 'png' && (
              <span
                data-testid="tw-crop-format-badge"
                className="px-2 py-0.5 rounded-full bg-[var(--primary-tint)] text-[var(--primary-text)] font-bold"
              >
                PNG · يحافظ على الشفافية
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 flex flex-col gap-3.5 border-t border-[var(--border)]">
          {/* Fit Mode Switcher */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="tw-crop-mode-cover"
              onClick={() => handleFitModeChange('cover')}
              disabled={isProcessing}
              className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                fitMode === 'cover'
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>تعبئة وقص يدوي</span>
            </button>

            <button
              type="button"
              data-testid="tw-crop-mode-contain"
              onClick={() => handleFitModeChange('contain')}
              disabled={isProcessing}
              className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                fitMode === 'contain'
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>الصورة كاملة بدون قص</span>
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="tw-crop-zoom-out"
              aria-label="تصغير"
              disabled={isProcessing || zoom <= MIN_CROP_ZOOM}
              onClick={() => handleZoomChange(zoom - 0.15)}
              className="w-8 h-8 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text)] disabled:opacity-40"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={MIN_CROP_ZOOM}
              max={MAX_CROP_ZOOM}
              step={0.02}
              value={zoom}
              disabled={isProcessing}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              data-testid="tw-crop-zoom-slider"
              aria-label="مستوى التكبير"
              className="flex-1 h-2 rounded-lg bg-[var(--border)] accent-[var(--primary)] cursor-pointer"
            />

            <button
              type="button"
              data-testid="tw-crop-zoom-in"
              aria-label="تكبير"
              disabled={isProcessing || zoom >= MAX_CROP_ZOOM}
              onClick={() => handleZoomChange(zoom + 0.15)}
              className="w-8 h-8 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text)] disabled:opacity-40"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <span className="w-11 text-center text-xs font-mono font-bold text-[var(--primary)]" dir="ltr">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              data-testid="tw-crop-reset-btn"
              onClick={handleReset}
              disabled={isProcessing}
              title="إعادة ضبط"
              className="h-8 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ضبط</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isProcessing}
              data-testid="tw-crop-cancel-btn"
              className="h-10 px-4 text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleConfirm()}
              isLoading={isProcessing}
              disabled={!naturalSize || Boolean(errorMsg)}
              data-testid="tw-crop-confirm-btn"
              className="h-10 px-5 text-xs gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>اعتماد الصورة</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
