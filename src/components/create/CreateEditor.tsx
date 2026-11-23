import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  Sticker,
  PenTool,
  Music,
  Download,
  Trash2,
  Star,
  Send,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Undo2,
  Check,
  X,
} from 'lucide-react';
import type { CreateMode, StoryAudience, StoryOverlayItem, User } from '../../types';
import type { CapturedMediaItem } from './useCameraEngine';
import {
  EDITOR_COLOR_TOKENS,
  EDITOR_FONT_OPTIONS,
  TEXT_STORY_GRADIENTS,
  clampStoryDurationSec,
  type SeedAudioTrack,
} from '../../lib/createUtils';
import { HeritageSvg } from './HeritageMotifs';
import { Avatar } from '../ui/Avatar';
import { renderStoryImageTo1080x1920 } from './storyCanvas';
import { resolveStoryCanvasFormat } from '../../lib/remediation';

export interface CreateEditorProps {
  clips: CapturedMediaItem[];
  mode: CreateMode;
  currentUser: User;
  selectedSound: SeedAudioTrack | null;
  defaultAudience: StoryAudience;
  overlays: StoryOverlayItem[];
  onChangeOverlays: React.Dispatch<React.SetStateAction<StoryOverlayItem[]>>;
  onBack: () => void;
  onOpenStickers: () => void;
  onOpenSound: () => void;
  onOpenSoundMix: () => void;
  onRemoveSound: () => void;
  onOpenRecipients: () => void;
  onPublish: (
    audience: StoryAudience,
    activeClip: CapturedMediaItem,
    remainingOverlays?: StoryOverlayItem[],
    caption?: string
  ) => Promise<void> | void;
}

export function CreateEditor({
  clips,
  mode,
  currentUser,
  selectedSound,
  defaultAudience,
  overlays,
  onChangeOverlays,
  onBack,
  onOpenStickers,
  onOpenSound,
  onOpenSoundMix,
  onRemoveSound,
  onOpenRecipients,
  onPublish,
}: CreateEditorProps) {
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const activeClip = clips[activeClipIndex] ?? clips[0]!;

  // Text tool state
  const [isTypingText, setIsTypingText] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [textColor, setTextColor] = useState<string>(EDITOR_COLOR_TOKENS[0]!.cssVar);
  const [textFontClass, setTextFontClass] = useState<string>(EDITOR_FONT_OPTIONS[0]!.className);
  const [textAlign, setTextAlign] = useState<'start' | 'center' | 'end'>('center');

  // Draw tool state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawColor, setDrawColor] = useState<string>(EDITOR_COLOR_TOKENS[1]!.cssVar);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingPointerRef = useRef(false);
  const drawHistoryRef = useRef<ImageData[]>([]);

  // Drag / pinch / delete state for overlays
  const frameRef = useRef<HTMLDivElement | null>(null);
  const trashRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; angle: number; scale: number; rotation: number } | null>(null);

  // Story text-only gradient switcher
  const [bgIndex, setBgIndex] = useState(0);
  const resolvedBg = activeClip.bgGradient || TEXT_STORY_GRADIENTS[bgIndex % TEXT_STORY_GRADIENTS.length];

  // Audience & reel caption state
  const [chosenAudience, setChosenAudience] = useState<StoryAudience>(defaultAudience);
  const [reelCaption, setReelCaption] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishWithCanvas = async (targetAudience: StoryAudience) => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const normalizedClip: CapturedMediaItem = {
        ...activeClip,
        durationSec: clampStoryDurationSec(activeClip.durationSec, activeClip.type),
        bgGradient: activeClip.type === 'text' ? resolvedBg : undefined,
      };
      const captionValue = mode === 'reel' ? reelCaption.trim() : undefined;
      if (normalizedClip.type === 'image' && normalizedClip.url) {
        const clipMime =
          normalizedClip.blob?.type ||
          (normalizedClip.url.startsWith('data:')
            ? normalizedClip.url.slice(5, Math.max(5, normalizedClip.url.indexOf(';')))
            : undefined);
        const { dataUrl, remainingOverlays } = await renderStoryImageTo1080x1920(
          normalizedClip.url,
          drawCanvasRef.current,
          overlays,
          clipMime
        );
        const bakedChanged = dataUrl !== normalizedClip.url;
        await onPublish(
          targetAudience,
          { ...normalizedClip, url: dataUrl, blob: bakedChanged ? undefined : normalizedClip.blob },
          remainingOverlays,
          captionValue
        );
      } else {
        await onPublish(targetAudience, normalizedClip, overlays, captionValue);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Sync draw canvas dimensions
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    canvas.width = frame.clientWidth || 386;
    canvas.height = frame.clientHeight || 680;
  }, []);

  const handleConfirmText = () => {
    const trimmed = draftText.trim();
    if (trimmed) {
      onChangeOverlays((prev) => [
        ...prev,
        {
          id: `txt-${Date.now()}`,
          kind: 'text',
          text: trimmed,
          colorToken: textColor,
          fontClass: textFontClass,
          align: textAlign,
          xPct: 50,
          yPct: 45,
          scale: 1,
          rotation: 0,
        },
      ]);
    }
    setDraftText('');
    setIsTypingText(false);
  };

  const handleDownload = () => {
    if (!activeClip.url || activeClip.type === 'text') return;
    const fmt = resolveStoryCanvasFormat(
      activeClip.blob?.type ||
        (activeClip.url.includes('.gif') || activeClip.url.startsWith('data:image/gif')
          ? 'image/gif'
          : activeClip.url.includes('.png') || activeClip.url.startsWith('data:image/png')
          ? 'image/png'
          : 'image/jpeg')
    );
    const a = document.createElement('a');
    a.href = activeClip.url;
    a.download = `tawasul-${Date.now()}.${activeClip.type === 'video' ? 'webm' : fmt.ext}`;
    a.click();
  };

  // Overlay pointer drag + two-finger pinch/rotate
  const handleOverlayPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDraggingId(id);

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[1]!.x - pts[0]!.x;
      const dy = pts[1]!.y - pts[0]!.y;
      const target = overlays.find((o) => o.id === id);
      pinchStartRef.current = {
        dist: Math.hypot(dx, dy) || 1,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        scale: target?.scale ?? 1,
        rotation: target?.rotation ?? 0,
      };
    }
  };

  const handleOverlayPointerMove = (e: React.PointerEvent, id: string) => {
    if (draggingId !== id || !frameRef.current) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[1]!.x - pts[0]!.x;
      const dy = pts[1]!.y - pts[0]!.y;
      const dist = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const nextScale = Math.max(0.5, Math.min(2.8, pinchStartRef.current.scale * (dist / pinchStartRef.current.dist)));
      const nextRot = pinchStartRef.current.rotation + (angle - pinchStartRef.current.angle);
      onChangeOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, scale: nextScale, rotation: nextRot } : o))
      );
      return;
    }

    const rect = frameRef.current.getBoundingClientRect();
    const xPct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    onChangeOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, xPct, yPct } : o))
    );

    if (trashRef.current) {
      const tr = trashRef.current.getBoundingClientRect();
      const over =
        e.clientX >= tr.left - 12 &&
        e.clientX <= tr.right + 12 &&
        e.clientY >= tr.top - 12 &&
        e.clientY <= tr.bottom + 12;
      setIsOverTrash(over);
    }
  };

  const handleOverlayPointerUp = (e: React.PointerEvent, id: string) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) {
      if (isOverTrash) {
        onChangeOverlays((prev) => prev.filter((o) => o.id !== id));
      }
      setDraggingId(null);
      setIsOverTrash(false);
    }
  };

  // Freehand canvas draw handlers
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const rect = canvas.getBoundingClientRect();
    const resolvedColor = getComputedStyle(document.documentElement)
      .getPropertyValue(drawColor.replace('var(', '').replace(')', ''))
      .trim();
    ctx.strokeStyle = resolvedColor || '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    isDrawingPointerRef.current = true;
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isDrawingPointerRef.current || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleCanvasPointerUp = () => {
    isDrawingPointerRef.current = false;
  };

  const handleUndoDraw = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const prev = drawHistoryRef.current.pop();
    if (ctx && prev) ctx.putImageData(prev, 0, 0);
  };

  // Swipe left/right between multiple clips
  const swipeXRef = useRef<number | null>(null);

  return (
    <div
      data-testid="tw-create-editor"
      className="fixed inset-0 z-40 bg-[var(--cam-bg)] text-[var(--cam-text)] flex flex-col items-center justify-between select-none"
    >
      <div className="relative w-full max-w-[430px] h-full flex flex-col justify-between p-[2px] pb-[env(safe-area-inset-bottom,0px)]">
        {/* Media Preview Frame (rounded 20) */}
        <div
          ref={frameRef}
          onPointerDown={(e) => {
            swipeXRef.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipeXRef.current !== null && clips.length > 1) {
              const delta = e.clientX - swipeXRef.current;
              if (Math.abs(delta) > 50) {
                setActiveClipIndex((idx) =>
                  delta < 0
                    ? Math.min(clips.length - 1, idx + 1)
                    : Math.max(0, idx - 1)
                );
              }
            }
            swipeXRef.current = null;
          }}
          className="relative flex-1 my-[6px] rounded-[20px] overflow-hidden bg-[var(--cam-surface)] flex items-center justify-center"
          style={activeClip.type === 'text' ? { background: resolvedBg } : undefined}
        >
          {activeClip.type === 'image' && (
            <div className="absolute inset-0 overflow-hidden bg-[var(--cam-bg)]">
              <img
                aria-hidden="true"
                src={activeClip.url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60 pointer-events-none"
                draggable={false}
              />
              <img
                src={activeClip.url}
                alt="معاينة الصورة"
                className="relative w-full h-full object-contain"
                data-testid="tw-editor-media-image"
                draggable={false}
              />
            </div>
          )}

          {activeClip.type === 'video' && (
            <video
              src={activeClip.url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain bg-[var(--cam-bg)]"
              data-testid="tw-editor-media-video"
            />
          )}

          {activeClip.type === 'text' && (
            <div className="p-6 text-center">
              {overlays.filter((o) => o.kind === 'text').length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsTypingText(true)}
                  className="px-5 py-3 rounded-2xl bg-[var(--cam-scrim)] text-base font-bold text-[var(--cam-text)]"
                >
                  اضغط لكتابة نص قصتك...
                </button>
              )}
              <button
                type="button"
                onClick={() => setBgIndex((i) => i + 1)}
                className="absolute bottom-4 end-4 px-3 h-9 rounded-full bg-[var(--cam-scrim)] text-xs font-bold text-[var(--cam-text)]"
              >
                تغيير الخلفية
              </button>
            </div>
          )}

          {/* Freehand Drawing Canvas */}
          <canvas
            ref={drawCanvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className={`absolute inset-0 w-full h-full ${
              isDrawingMode ? 'pointer-events-auto cursor-crosshair z-20' : 'pointer-events-none z-10'
            }`}
          />

          {/* Overlays (Text + Stickers) */}
          {overlays.map((item) => (
            <div
              key={item.id}
              data-testid={`tw-editor-overlay-${item.id}`}
              onPointerDown={(e) => handleOverlayPointerDown(e, item.id)}
              onPointerMove={(e) => handleOverlayPointerMove(e, item.id)}
              onPointerUp={(e) => handleOverlayPointerUp(e, item.id)}
              style={{
                left: `${item.xPct}%`,
                top: `${item.yPct}%`,
                transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
                color: item.colorToken ?? 'var(--cam-text)',
                textAlign: item.align ?? 'center',
              }}
              className="absolute z-20 cursor-grab active:cursor-grabbing touch-none max-w-[85%]"
            >
              {item.kind === 'text' && (
                <div
                  className={`px-3 py-1.5 rounded-xl bg-[var(--cam-scrim)] backdrop-blur-xs text-2xl drop-shadow-md ${
                    item.fontClass ?? 'font-bold'
                  }`}
                >
                  {item.text}
                </div>
              )}

              {item.kind === 'sticker' && item.stickerKind === 'heritage' && (
                <div className="p-2 rounded-2xl bg-[var(--cam-scrim)] backdrop-blur-xs text-[var(--gold)] flex flex-col items-center gap-1">
                  <HeritageSvg motifId={item.motifId ?? 'star'} className="w-12 h-12" />
                  <span className="text-xs font-bold text-[var(--cam-text)]">{item.text}</span>
                </div>
              )}

              {item.kind === 'sticker' && item.stickerKind !== 'heritage' && (
                <div className="px-3.5 py-2 rounded-2xl bg-[var(--cam-surface)]/90 border border-white/15 text-sm font-bold text-[var(--cam-text)] shadow-lg">
                  {item.text}
                  {item.pollOptions && item.pollOptions.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1 text-xs">
                      {item.pollOptions.map((po, i) => (
                        <div key={i} className="px-2.5 py-1 rounded-lg bg-[var(--cam-surface-2)]">
                          {po}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Top Bar inside preview */}
          <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pt-[env(safe-area-inset-top,0px)]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="tw-editor-back"
                onClick={onBack}
                aria-label="الرجوع للكاميرا"
                className="w-11 h-11 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-[var(--cam-text)] flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              <button
                type="button"
                data-testid="tw-editor-tool-text"
                onClick={() => {
                  setIsDrawingMode(false);
                  setIsTypingText(true);
                }}
                aria-label="إضافة نص"
                className="w-11 h-11 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-[var(--cam-text)] font-bold text-sm flex items-center justify-center"
              >
                Aa
              </button>

              <button
                type="button"
                data-testid="tw-editor-tool-sticker"
                onClick={() => {
                  setIsDrawingMode(false);
                  onOpenStickers();
                }}
                aria-label="إضافة ملصق"
                className="w-11 h-11 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-[var(--cam-text)] flex items-center justify-center"
              >
                <Sticker className="w-5 h-5" />
              </button>

              <button
                type="button"
                data-testid="tw-editor-tool-draw"
                onClick={() => setIsDrawingMode((v) => !v)}
                aria-label="أداة الرسم"
                className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center ${
                  isDrawingMode
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'bg-[var(--cam-scrim)] text-[var(--cam-text)]'
                }`}
              >
                <PenTool className="w-5 h-5" />
              </button>

              <button
                type="button"
                data-testid="tw-editor-tool-sound"
                onClick={selectedSound ? onOpenSoundMix : onOpenSound}
                aria-label="تعديل الصوت"
                className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center ${
                  selectedSound
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'bg-[var(--cam-scrim)] text-[var(--cam-text)]'
                }`}
              >
                <Music className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleDownload}
                aria-label="تنزيل"
                className="w-11 h-11 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-[var(--cam-text)] flex items-center justify-center"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sound Chip + Instants 24h Badge + Multi-clip dots */}
          <div className="absolute top-16 inset-x-4 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
            {mode === 'instants' && (
              <span className="px-3 py-1 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-xs font-bold text-[var(--cam-text)]">
                تنتهي بعد ٢٤ ساعة
              </span>
            )}
            {selectedSound && (
              <div
                data-testid="tw-editor-sound-chip"
                className="pointer-events-auto inline-flex items-center gap-1.5 ps-3 pe-1.5 h-8 rounded-full bg-[var(--cam-surface)]/90 border border-white/15 text-xs font-semibold text-[var(--cam-text)]"
              >
                <button
                  type="button"
                  data-testid="tw-editor-sound-mix-btn"
                  onClick={onOpenSoundMix}
                  className="inline-flex items-center gap-1.5"
                >
                  <Music className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>{selectedSound.title}</span>
                </button>
                <button
                  type="button"
                  data-testid="tw-editor-sound-remove"
                  onClick={onRemoveSound}
                  aria-label="إزالة الصوت"
                  className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-[var(--cam-muted)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {clips.length > 1 && (
              <div className="flex items-center gap-1 pointer-events-auto">
                {clips.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`مقطع ${idx + 1}`}
                    onClick={() => setActiveClipIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === activeClipIndex ? 'w-6 bg-[var(--cam-text)]' : 'w-2 bg-[var(--cam-muted)]/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Draw Toolbar */}
          {isDrawingMode && (
            <div className="absolute bottom-4 inset-x-4 z-30 flex items-center justify-between px-3 py-2 rounded-2xl bg-[var(--cam-surface)]/90">
              <div className="flex items-center gap-2">
                {EDITOR_COLOR_TOKENS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`لون ${c.label}`}
                    onClick={() => setDrawColor(c.cssVar)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      drawColor === c.cssVar ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.cssVar }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndoDraw}
                  aria-label="تراجع عن الرسم"
                  className="w-9 h-9 rounded-xl bg-[var(--cam-surface-2)] flex items-center justify-center"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawingMode(false)}
                  aria-label="تم الرسم"
                  className="px-3 h-9 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
                >
                  تم
                </button>
              </div>
            </div>
          )}

          {/* Bottom Trash Drop Circle when dragging an overlay */}
          {draggingId && (
            <div
              ref={trashRef}
              data-testid="tw-editor-trash"
              className={`absolute bottom-5 start-1/2 translate-x-1/2 z-30 w-12 h-12 rounded-full border-2 flex items-center justify-center transition-transform ${
                isOverTrash
                  ? 'bg-[var(--live)] border-white scale-115'
                  : 'bg-[var(--cam-scrim)] border-white/60'
              }`}
              aria-label="اسحب هنا للحذف"
            >
              <Trash2 className="w-5 h-5 text-[var(--cam-text)]" />
            </div>
          )}

          {/* Text Tool Overlay Modal */}
          {isTypingText && (
            <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-xs flex flex-col justify-between p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {EDITOR_FONT_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTextFontClass(f.className)}
                      className={`px-2.5 h-9 rounded-xl text-xs font-bold ${
                        textFontClass === f.className
                          ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                          : 'bg-[var(--cam-surface-2)] text-[var(--cam-text)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="محاذاة النص"
                    onClick={() =>
                      setTextAlign((a) => (a === 'center' ? 'start' : a === 'start' ? 'end' : 'center'))
                    }
                    className="w-9 h-9 rounded-xl bg-[var(--cam-surface-2)] flex items-center justify-center"
                  >
                    {textAlign === 'start' ? (
                      <AlignRight className="w-4 h-4" />
                    ) : textAlign === 'end' ? (
                      <AlignLeft className="w-4 h-4" />
                    ) : (
                      <AlignCenter className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="tw-editor-text-done"
                  onClick={handleConfirmText}
                  className="px-4 h-9 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>تم</span>
                </button>
              </div>

              <input
                type="text"
                autoFocus
                data-testid="tw-editor-text-input"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmText();
                }}
                placeholder="اكتب نصك هنا..."
                style={{ color: textColor, textAlign }}
                className={`w-full bg-transparent text-2xl focus:outline-none placeholder:text-[var(--cam-muted)] ${textFontClass}`}
              />

              <div className="flex items-center justify-center gap-3 pb-2">
                {EDITOR_COLOR_TOKENS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`لون النص ${c.label}`}
                    onClick={() => setTextColor(c.cssVar)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      textColor === c.cssVar ? 'border-white scale-110' : 'border-white/30'
                    }`}
                    style={{ backgroundColor: c.cssVar }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Publish Bar (64px height, --cam-surface) */}
        {mode === 'reel' ? (
          <div className="h-[64px] px-2.5 bg-[var(--cam-surface)] rounded-t-2xl flex items-center justify-between gap-2 shrink-0">
            <input
              type="text"
              value={reelCaption}
              onChange={(e) => setReelCaption(e.target.value)}
              placeholder="أضف وصفاً للريلز (اختياري)..."
              maxLength={300}
              data-testid="tw-reel-caption-input"
              className="flex-1 min-w-0 h-11 px-3.5 rounded-full bg-[var(--cam-surface-2)] border border-white/10 text-xs text-[var(--cam-text)] placeholder:text-[var(--cam-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              data-testid="tw-publish-primary"
              disabled={isPublishing}
              onClick={() => void handlePublishWithCanvas('everyone')}
              className="h-11 px-4 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap disabled:opacity-60"
            >
              <span>{isPublishing ? 'جارٍ النشر...' : 'نشر ريلز'}</span>
              <Send className="w-3.5 h-3.5 -scale-x-100" />
            </button>
          </div>
        ) : (
          <div className="h-[64px] px-2 bg-[var(--cam-surface)] rounded-t-2xl flex items-center justify-between gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="tw-publish-story-everyone"
              disabled={isPublishing}
              onClick={() => {
                setChosenAudience('everyone');
                void handlePublishWithCanvas('everyone');
              }}
              className={`shrink-0 h-11 px-2.5 rounded-full flex items-center justify-center gap-1.5 text-xs font-bold border ${
                chosenAudience === 'everyone'
                  ? 'bg-[var(--cam-surface-2)] border-[var(--primary)] text-[var(--cam-text)]'
                  : 'bg-[var(--cam-surface-2)]/60 border-white/10 text-[var(--cam-text)]'
              }`}
            >
              <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={22} />
              <span className="whitespace-nowrap">قصتك</span>
            </button>

            <button
              type="button"
              data-testid="tw-publish-close-friends"
              disabled={isPublishing}
              onClick={() => {
                setChosenAudience('close-friends');
                void handlePublishWithCanvas('close-friends');
              }}
              className="flex-1 min-w-0 h-11 px-2 rounded-full bg-[var(--cam-surface-2)] border border-white/10 flex items-center justify-center gap-1 text-[11px] font-bold text-[var(--cam-text)]"
            >
              <span className="w-4 h-4 rounded-full bg-[var(--success)] text-[var(--primary-fg)] flex items-center justify-center shrink-0">
                <Star className="w-2.5 h-2.5 fill-current" />
              </span>
              <span className="truncate">الأصدقاء المقرّبون</span>
            </button>

            <button
              type="button"
              onClick={onOpenRecipients}
              className="h-11 px-2 rounded-full bg-[var(--cam-surface-2)] text-[11px] font-semibold text-[var(--cam-muted)] shrink-0 whitespace-nowrap"
              aria-label="إرسال إلى"
            >
              إرسال إلى...
            </button>

            <button
              type="button"
              data-testid="tw-publish-primary"
              disabled={isPublishing}
              onClick={() => void handlePublishWithCanvas(chosenAudience)}
              className="h-11 px-3 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <span>مشاركة</span>
              <Send className="w-3.5 h-3.5 -scale-x-100" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
