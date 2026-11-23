import { useState, useRef, useEffect, useCallback } from 'react';
import type { CameraFilterId } from '../../types';
import { getCanvasFilterCss, pickSupportedVideoMimeType } from '../../lib/createUtils';

export type CameraPermissionState =
  | 'initializing'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'insecure';

export interface CapturedMediaItem {
  id: string;
  url: string;
  blob?: Blob;
  type: 'image' | 'video' | 'text';
  durationSec: number;
  bgGradient?: string;
}

export interface UseCameraEngineOptions {
  enabled: boolean;
  highQuality: boolean;
  streamKey?: string;
  onToast: (msg: string) => void;
}

export function useCameraEngine({ enabled, highQuality, streamKey, onToast }: UseCameraEngineOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRequestedRef = useRef(false);
  const createdUrlsRef = useRef<string[]>([]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [torchOn, setTorchOn] = useState(false);
  const [permissionState, setPermissionState] = useState<CameraPermissionState>('initializing');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);

  const registerUrl = useCallback((url: string) => {
    createdUrlsRef.current.push(url);
    return url;
  }, []);

  const stopAllTracks = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setIsRecording(false);
  }, []);

  const startCamera = useCallback(
    async (targetFacing: 'user' | 'environment', includeAudio = false) => {
      if (typeof window === 'undefined') return;
      if (!window.isSecureContext) {
        setPermissionState('insecure');
        return;
      }
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setPermissionState('unavailable');
        return;
      }

      stopAllTracks();
      setPermissionState('initializing');

      const widthIdeal = highQuality ? 1080 : 720;
      const heightIdeal = highQuality ? 1920 : 1280;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: widthIdeal },
            height: { ideal: heightIdeal },
          },
          audio: includeAudio,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setPermissionState('granted');
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setPermissionState('denied');
        } else {
          setPermissionState('unavailable');
        }
      }
    },
    [highQuality, stopAllTracks]
  );

  // Start or stop camera based on whether a camera mode is active, and release/re-acquire on mode changes
  useEffect(() => {
    if (!enabled) {
      stopAllTracks();
      return;
    }
    void startCamera(facingMode, audioRequestedRef.current);

    return () => {
      stopAllTracks();
    };
  }, [enabled, facingMode, streamKey, startCamera, stopAllTracks]);

  // Privacy safeguard: stop tracks immediately when tab becomes hidden
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden) {
        stopAllTracks();
      } else if (enabled) {
        void startCamera(facingMode, audioRequestedRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [enabled, facingMode, startCamera, stopAllTracks]);

  // Note: Object URLs passed into AppContext stories are managed by AppContext or browser session,
  // while intermediate discarded URLs are cleaned only when explicitly requested.
  const revokeManagedUrl = useCallback((url: string) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, []);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  const toggleTorch = useCallback(async () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) {
      onToast('الفلاش غير متوفر بهذا الجهاز');
      return;
    }
    const caps = (
      typeof videoTrack.getCapabilities === 'function' ? videoTrack.getCapabilities() : {}
    ) as { torch?: boolean };
    if (!caps.torch) {
      onToast('الفلاش غير متوفر بهذا الجهاز');
      return;
    }
    const next = !torchOn;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      onToast('الفلاش غير متوفر بهذا الجهاز');
    }
  }, [onToast, torchOn]);

  // Capture unmirrored JPEG photo with active filter applied
  const capturePhoto = useCallback(
    async (
      filterId: CameraFilterId,
      beautyLevel: number,
      saveOriginal: boolean
    ): Promise<CapturedMediaItem | null> => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return null;

      const w = video.videoWidth || 1080;
      const h = video.videoHeight || 1920;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const filterCss = getCanvasFilterCss(filterId, beautyLevel);
      if (filterCss !== 'none' && 'filter' in ctx) {
        ctx.filter = filterCss;
      }

      // Always save unmirrored image regardless of front-camera preview mirroring
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
      );

      let url = '';
      if (blob) {
        url = registerUrl(URL.createObjectURL(blob));
      } else {
        url = canvas.toDataURL('image/jpeg', 0.9);
      }

      if (saveOriginal && url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `tawasul-${Date.now()}.jpg`;
        a.click();
      }

      return {
        id: `cap-${Date.now()}`,
        url,
        blob: blob ?? undefined,
        type: 'image',
        durationSec: 5,
      };
    },
    [registerUrl]
  );

  // Start / Stop video recording with MediaRecorder (vp9,opus -> mp4 fallback)
  const recordingStartRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const resolveStopRef = useRef<((item: CapturedMediaItem | null) => void) | null>(null);

  const ensureAudioTrackOnce = useCallback(async () => {
    if (audioRequestedRef.current || !streamRef.current) return;
    audioRequestedRef.current = true;
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack && streamRef.current) {
        streamRef.current.addTrack(audioTrack);
      } else {
        audioStream.getTracks().forEach((t) => t.stop());
        onToast('تم التسجيل بدون صوت');
      }
    } catch {
      onToast('تم التسجيل بدون صوت');
    }
  }, [onToast]);

  const stopRecording = useCallback((): Promise<CapturedMediaItem | null> => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingElapsedSec(0);

    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      return Promise.resolve(null);
    }

    return new Promise<CapturedMediaItem | null>((resolve) => {
      resolveStopRef.current = resolve;
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const startRecording = useCallback(
    async (maxSeconds: number, onAutoStop?: (clip: CapturedMediaItem) => void) => {
      if (!streamRef.current || isRecording) return;
      await ensureAudioTrackOnce();
      if (!streamRef.current) return;

      recordingChunksRef.current = [];
      recordingStartRef.current = performance.now();
      setIsRecording(true);
      setRecordingElapsedSec(0);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }

      const mimeType =
        typeof MediaRecorder !== 'undefined'
          ? pickSupportedVideoMimeType((m) => MediaRecorder.isTypeSupported(m))
          : '';

      if (typeof MediaRecorder === 'undefined') {
        setIsRecording(false);
        return;
      }

      try {
        const rec = mimeType
          ? new MediaRecorder(streamRef.current, { mimeType })
          : new MediaRecorder(streamRef.current);

        recorderRef.current = rec;
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            recordingChunksRef.current.push(ev.data);
          }
        };

        rec.onstop = () => {
          const elapsedSec = Math.max(
            0.5,
            Number(((performance.now() - recordingStartRef.current) / 1000).toFixed(2))
          );
          const blob = new Blob(recordingChunksRef.current, {
            type: mimeType || 'video/webm',
          });
          const url = registerUrl(URL.createObjectURL(blob));
          const clip: CapturedMediaItem = {
            id: `vid-${Date.now()}`,
            url,
            blob,
            type: 'video',
            durationSec: elapsedSec,
          };
          if (resolveStopRef.current) {
            const fn = resolveStopRef.current;
            resolveStopRef.current = null;
            fn(clip);
          } else if (onAutoStop) {
            onAutoStop(clip);
          }
        };

        rec.start(200);
        recordingTimerRef.current = setInterval(() => {
          const sec = (performance.now() - recordingStartRef.current) / 1000;
          setRecordingElapsedSec(sec);
          if (sec >= maxSeconds) {
            void stopRecording().then((clip) => {
              if (clip && onAutoStop) onAutoStop(clip);
            });
          }
        }, 100);
      } catch {
        setIsRecording(false);
      }
    },
    [ensureAudioTrackOnce, isRecording, registerUrl, stopRecording]
  );

  // Boomerang capture: 1s burst at ~12fps, then forward+backward loop via canvas MediaRecorder
  const captureBoomerang = useCallback(
    async (filterId: CameraFilterId, beautyLevel: number): Promise<CapturedMediaItem | null> => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return null;

      const w = Math.min(720, video.videoWidth || 720);
      const h = Math.round((w * (video.videoHeight || 1280)) / (video.videoWidth || 720));
      const frames: HTMLCanvasElement[] = [];
      const filterCss = getCanvasFilterCss(filterId, beautyLevel);

      for (let i = 0; i < 12; i += 1) {
        const fc = document.createElement('canvas');
        fc.width = w;
        fc.height = h;
        const fctx = fc.getContext('2d');
        if (fctx) {
          if (filterCss !== 'none' && 'filter' in fctx) {
            fctx.filter = filterCss;
          }
          fctx.drawImage(video, 0, 0, w, h);
          frames.push(fc);
        }
        await new Promise((r) => setTimeout(r, 83));
      }

      if (frames.length === 0) return null;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const outCtx = outCanvas.getContext('2d');
      const mimeType =
        typeof MediaRecorder !== 'undefined'
          ? pickSupportedVideoMimeType((m) => MediaRecorder.isTypeSupported(m))
          : '';

      if (
        !outCtx ||
        typeof MediaRecorder === 'undefined' ||
        typeof outCanvas.captureStream !== 'function'
      ) {
        const fallbackUrl = frames[0]!.toDataURL('image/jpeg', 0.9);
        return {
          id: `boom-${Date.now()}`,
          url: fallbackUrl,
          type: 'image',
          durationSec: 5,
        };
      }

      const sequence = [...frames, ...frames.slice(1, -1).reverse()];
      const stream = outCanvas.captureStream(12);
      const chunks: BlobPart[] = [];
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      return new Promise<CapturedMediaItem>((resolve) => {
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const url = registerUrl(URL.createObjectURL(blob));
          resolve({
            id: `boom-${Date.now()}`,
            url,
            blob,
            type: 'video',
            durationSec: 2,
          });
        };

        rec.start(100);
        let idx = 0;
        const playTimer = setInterval(() => {
          const frame = sequence[idx];
          if (frame) {
            outCtx.drawImage(frame, 0, 0, w, h);
          }
          idx += 1;
          if (idx >= sequence.length) {
            clearInterval(playTimer);
            try {
              rec.stop();
            } catch {}
          }
        }, 83);
      });
    },
    [registerUrl]
  );

  return {
    videoRef,
    streamRef,
    facingMode,
    torchOn,
    permissionState,
    isRecording,
    recordingElapsedSec,
    startCamera,
    stopAllTracks,
    flipCamera,
    toggleTorch,
    capturePhoto,
    captureBoomerang,
    startRecording,
    stopRecording,
    revokeManagedUrl,
  };
}
