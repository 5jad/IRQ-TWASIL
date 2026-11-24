import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  X,
  Zap,
  ZapOff,
  Settings,
  LayoutGrid,
  Music,
  Sparkles,
  UserSquare2,
  Wand2,
  Timer,
  SwitchCamera,
  Image as ImageIcon,
  Users,
  ChevronDown,
  Check,
  Undo2,
  Camera,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type {
  CameraFilterId,
  CreateMode,
  StoryAudience,
  StoryOverlayItem,
} from '../../types';
import {
  CAMERA_FILTERS,
  CREATE_MODES,
  GREEN_SCREEN_PRESETS,
  REEL_DURATIONS,
  REEL_SPEEDS,
  SQUIRCLE_CLIP_PATH_D,
  TEXT_STORY_GRADIENTS,
  buildPreviewFilterCss,
  computeStoryExpiryIso,
  clampStoryDurationSec,
  parseCreateMode,
  readCameraSettings,
  writeCameraSettings,
  type CameraSettingsPrefs,
  type LayoutGridId,
  type SeedAudioTrack,
} from '../../lib/createUtils';
import { inferPublishKindFromMode } from '../../lib/storyUtils';
import { isVideoSource } from '../../lib/apiHelpers';
import { formatNumber } from '../../lib/formatters';
import { useCameraEngine, type CapturedMediaItem } from '../create/useCameraEngine';
import { CreateSheets, type ActiveCreateSheet } from '../create/CreateSheets';
import { CreateEditor } from '../create/CreateEditor';
import { PostPickerPanel, type PickedGalleryItem } from '../create/PostPickerPanel';
import { InstantsShareSheet } from '../create/InstantsShareSheet';
import { LiveModeControls } from '../create/LiveModeControls';
import { CameraToolColumn, type CameraToolItem } from '../create/CameraToolColumn';
import { Avatar } from '../ui/Avatar';
import { apiFetch } from '../../lib/api';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export function CreateView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentUser,
    users,
    numeralSystem,
    publishStory,
    publishInstantMoment,
    createPost,
    showAppToast,
  } = useApp();

  const mode = parseCreateMode(searchParams.get('mode'));
  const isCameraMode =
    mode === 'story' || mode === 'reel' || mode === 'instants' || mode === 'live';

  // Camera persisted preferences (tw.camera.v1)
  const [settings, setSettings] = useState<CameraSettingsPrefs>(() => readCameraSettings());
  const updateSettings = useCallback((next: CameraSettingsPrefs) => {
    setSettings(next);
    writeCameraSettings(next);
  }, []);

  // Toast over camera screen
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  // Active sheet & edit screen state
  const [activeSheet, setActiveSheet] = useState<ActiveCreateSheet>(null);
  const [capturedClips, setCapturedClips] = useState<CapturedMediaItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [overlays, setOverlays] = useState<StoryOverlayItem[]>([]);

  // Preserved Post-mode picker state (B1 & B5)
  const [postItems, setPostItems] = useState<PickedGalleryItem[]>([]);
  const [postSelectedIds, setPostSelectedIds] = useState<string[]>([]);
  const [postIsMultiSelect, setPostIsMultiSelect] = useState(false);

  // Instants captured frozen frame before share-with sheet (B3)
  const [frozenInstantClip, setFrozenInstantClip] = useState<CapturedMediaItem | null>(null);

  // Camera tools state (preserved across mode switches)
  const [activeFilter, setActiveFilter] = useState<CameraFilterId>('none');
  const [lastUsedFilter, setLastUsedFilter] = useState<CameraFilterId | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutGridId>('none');
  const [greenScreenId, setGreenScreenId] = useState<string>('none');
  const [beautyLevel, setBeautyLevel] = useState<number>(0);
  const [timerSec, setTimerSec] = useState<0 | 3 | 10>(0);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isBoomerangBusy, setIsBoomerangBusy] = useState(false);

  const [selectedSound, setSelectedSound] = useState<SeedAudioTrack | null>(null);
  const [videoVolume, setVideoVolume] = useState<number>(30);
  const [musicVolume, setMusicVolume] = useState<number>(100);
  const [reelDurationSec, setReelDurationSec] = useState<number>(REEL_DURATIONS[0]);
  const [reelSpeed, setReelSpeed] = useState<number>(REEL_SPEEDS[2]);
  const [reelSegments, setReelSegments] = useState<CapturedMediaItem[]>([]);
  const [audience, setAudience] = useState<StoryAudience>('everyone');
  const [galleryThumb, setGalleryThumb] = useState<string | null>(null);
  const [filterOffset, setFilterOffset] = useState<number>(0);
  const [isLiveSessionBusy, setIsLiveSessionBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'live') setIsLiveSessionBusy(false);
  }, [mode]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stripTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Camera engine: active only in camera modes, stops/releases on mode change (B5)
  const camera = useCameraEngine({
    enabled: isCameraMode && !isEditing && !frozenInstantClip,
    highQuality: settings.highQuality,
    streamKey: mode,
    onToast: showToast,
  });

  // Close flow safely: stop all camera tracks then return to previous route
  const handleClose = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    camera.stopAllTracks();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  }, [camera, navigate]);

  // Center active mode tab inside horizontal snap strip
  useEffect(() => {
    const btn = stripTabRefs.current[mode];
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [mode]);

  // Mode selection across all 5 modes (B5)
  const selectMode = useCallback(
    (next: CreateMode) => {
      if (next === mode) return;
      if (next !== 'instants') {
        setFrozenInstantClip(null);
      }
      setSearchParams({ mode: next }, { replace: true });
    },
    [mode, setSearchParams]
  );

  // Escape closes screen when no sheet/countdown is active; Arrow keys move between modes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeSheet || isEditing || frozenInstantClip) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (countdownLeft !== null) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setCountdownLeft(null);
          return;
        }
        handleClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const idx = CREATE_MODES.findIndex((m) => m.id === mode);
        if (idx === -1) return;
        const delta = e.key === 'ArrowLeft' ? 1 : -1;
        const target = CREATE_MODES[(idx + delta + CREATE_MODES.length) % CREATE_MODES.length];
        if (target) selectMode(target.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSheet, countdownLeft, frozenInstantClip, handleClose, isEditing, mode, selectMode]);

  // Shutter press / hold logic
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartedRecordingRef = useRef(false);

  const performPhotoCapture = useCallback(async () => {
    const item = await camera.capturePhoto(activeFilter, beautyLevel, settings.saveOriginal);
    if (!item) {
      fileInputRef.current?.click();
      return;
    }
    if (mode === 'instants') {
      camera.stopAllTracks();
      setFrozenInstantClip(item);
      return;
    }
    setCapturedClips([item]);
    setOverlays([]);
    setIsEditing(true);
  }, [activeFilter, beautyLevel, camera, mode, settings.saveOriginal]);

  const triggerPhotoWithTimer = useCallback(() => {
    if (timerSec === 0) {
      void performPhotoCapture();
      return;
    }
    let remaining: number = timerSec;
    setCountdownLeft(remaining);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdownLeft(null);
        void performPhotoCapture();
      } else {
        setCountdownLeft(remaining);
      }
    }, 1000);
  }, [performPhotoCapture, timerSec]);

  const handleTriggerBoomerang = useCallback(async () => {
    if (isBoomerangBusy) return;
    if (camera.permissionState !== 'granted') {
      showToast('فعّل الكاميرا لتسجيل بوميرانغ');
      return;
    }
    setIsBoomerangBusy(true);
    showToast('جارٍ التقاط بوميرانغ...');
    try {
      const clip = await camera.captureBoomerang(activeFilter, beautyLevel);
      if (clip) {
        setCapturedClips([clip]);
        setOverlays([]);
        setIsEditing(true);
      }
    } finally {
      setIsBoomerangBusy(false);
    }
  }, [activeFilter, beautyLevel, camera, isBoomerangBusy, showToast]);

  const handleShutterPointerDown = () => {
    if (camera.permissionState !== 'granted') return;
    holdStartedRecordingRef.current = false;

    if (mode === 'instants') return;

    const maxClipSec = mode === 'reel' ? reelDurationSec : 15;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdStartedRecordingRef.current = true;
      void camera.startRecording(maxClipSec, (clip) => {
        if (mode === 'reel') {
          setReelSegments((prev) => [...prev, clip]);
        } else {
          setCapturedClips([clip]);
          setOverlays([]);
          setIsEditing(true);
        }
      });
    }, 250);
  };

  const handleShutterPointerUp = async () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (camera.permissionState !== 'granted') {
      fileInputRef.current?.click();
      return;
    }

    if (mode !== 'instants' && holdStartedRecordingRef.current) {
      holdStartedRecordingRef.current = false;
      const clip = await camera.stopRecording();
      if (clip) {
        if (mode === 'reel') {
          setReelSegments((prev) => [...prev, clip]);
        } else {
          setCapturedClips([clip]);
          setOverlays([]);
          setIsEditing(true);
        }
      }
      return;
    }

    triggerPhotoWithTimer();
  };

  // Pick image or video files from device gallery — strictly routed by entry mode, never file type (Part A)
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const entryMode = parseCreateMode(searchParams.get('mode'));

    if (entryMode === 'post') {
      void handlePostAddFiles(files);
      e.target.value = '';
      return;
    }

    const items: CapturedMediaItem[] = files.map((file, idx) => {
      const url = URL.createObjectURL(file);
      const isVid = isVideoSource(file);
      return {
        id: `file-${Date.now()}-${idx}`,
        url,
        blob: file,
        type: isVid ? 'video' : 'image',
        durationSec: isVid ? 10 : 5,
      };
    });
    if (items[0]) setGalleryThumb(items[0].url);
    if (entryMode === 'instants' && items[0]) {
      camera.stopAllTracks();
      setIsEditing(false);
      setFrozenInstantClip(items[0]);
      e.target.value = '';
      return;
    }
    setCapturedClips(items);
    setOverlays([]);
    setIsEditing(true);
    e.target.value = '';
  };

  // Post-mode picker file additions (up to 10 selected)
  const handlePostAddFiles = useCallback(
    async (files: File[]) => {
      const added: PickedGalleryItem[] = await Promise.all(
        files.map(async (file, idx) => {
          const isVid = isVideoSource(file);
          const blobUrl = URL.createObjectURL(file);
          const persistUrl = !isVid && file.size <= 3_500_000 ? await readFileAsDataUrl(file) : undefined;
          return {
            id: `post-media-${Date.now()}-${idx}`,
            url: blobUrl,
            persistUrl: persistUrl || blobUrl,
            file,
            type: isVid ? 'video' : 'image',
            durationSec: isVid ? 8 : undefined,
          };
        })
      );
      setPostItems((prev) => [...added, ...prev]);
      if (added[0]) {
        setPostSelectedIds((prev) =>
          postIsMultiSelect ? Array.from(new Set([...prev, ...added.map((a) => a.id)])).slice(0, 10) : [added[0].id]
        );
      }
    },
    [postIsMultiSelect]
  );

  const handlePostSelectTile = useCallback(
    (id: string) => {
      if (!postIsMultiSelect) {
        setPostSelectedIds([id]);
        return;
      }
      setPostSelectedIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= 10) {
          showToast('الحد الأقصى ١٠ عناصر');
          return prev;
        }
        return [...prev, id];
      });
    },
    [postIsMultiSelect, showToast]
  );

  // Open text-only story on a gradient background
  const openTextStory = () => {
    setCapturedClips([
      {
        id: `txt-story-${Date.now()}`,
        url: '',
        type: 'text',
        durationSec: 5,
        bgGradient: TEXT_STORY_GRADIENTS[0],
      },
    ]);
    setOverlays([]);
    setIsEditing(true);
  };

  // Publish capture into AppContext based on active create mode (reel -> /reels, instant -> moments, story -> stories)
  const handlePublishStory = async (
    chosenAudience: StoryAudience,
    activeClip: CapturedMediaItem,
    remainingOverlays?: StoryOverlayItem[],
    captionText?: string,
    recipientIds?: string[]
  ) => {
    const publishKind = inferPublishKindFromMode(mode);
    if (publishKind === 'reel') {
      const overlayCaption = (remainingOverlays ?? overlays)
        .filter((o) => o.kind === 'text' && o.text)
        .map((o) => o.text?.trim())
        .filter(Boolean)
        .join(' ');
      const finalCaption = (captionText ?? '').trim() || overlayCaption;
      const mediaSource = activeClip.blob ?? (activeClip.url || undefined);
      const ok = await createPost(finalCaption, mediaSource, {
        kind: 'reel',
        audioTrack: selectedSound?.title,
        aspectRatio: '9/16',
        isVideo: activeClip.type === 'video',
      });
      if (!ok) return;
      showAppToast('تم نشر الريلز بنجاح', 'success');
      camera.stopAllTracks();
      navigate('/reels', { replace: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (publishKind === 'instant') {
      const saved = await publishInstantMoment({
        mediaUrl: activeClip.url,
        mediaSource: activeClip.blob,
        mediaType: activeClip.type === 'video' ? 'video' : 'image',
        audience: chosenAudience,
      });
      if (!saved) return;
      camera.stopAllTracks();
      navigate(`/messages?openInstant=${encodeURIComponent(currentUser.id)}`, { replace: true });
      return;
    }
    const ok = await publishStory(
      {
        id: `story-${Date.now()}`,
        authorId: currentUser.id,
        kind: publishKind,
        mediaUrl: activeClip.url,
        mediaType: activeClip.type,
        soundId: selectedSound?.id,
        soundTitle: selectedSound?.title,
        videoVolume: selectedSound ? videoVolume : 100,
        musicVolume: selectedSound ? musicVolume : undefined,
        soundStartSec: selectedSound ? 0 : undefined,
        durationSec: clampStoryDurationSec(activeClip.durationSec, activeClip.type),
        audience: chosenAudience,
        ...(chosenAudience === 'custom' && recipientIds && recipientIds.length > 0
          ? { recipientIds }
          : {}),
        mode,
        createdAt: new Date().toISOString(),
        expiresAt: computeStoryExpiryIso(),
        bgGradient: activeClip.bgGradient,
        overlays: remainingOverlays ?? overlays,
      },
      activeClip.blob
    );
    if (!ok) return;
    camera.stopAllTracks();
    navigate('/', { replace: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Publish Instant from "مشاركة مع" sheet -> store 24h instant in socialMoments (Part A & B)
  const handleSendInstant = async (chosenAudience: StoryAudience) => {
    if (!frozenInstantClip) return;
    const saved = await publishInstantMoment({
      mediaUrl: frozenInstantClip.url,
      mediaSource: frozenInstantClip.blob,
      mediaType: frozenInstantClip.type === 'video' ? 'video' : 'image',
      audience: chosenAudience,
    });
    if (!saved) return;
    setFrozenInstantClip(null);
    camera.stopAllTracks();
    navigate(`/messages?openInstant=${encodeURIComponent(currentUser.id)}`, { replace: true });
  };

  const handlePublishToRecipients = async (recipientIds: string[]) => {
    if (recipientIds.length === 0) return;
    let sentCount = 0;
    for (const rid of recipientIds) {
      try {
        const startRes = await apiFetch<{ conversation?: { id: string } }>(
          '/api/conversations/start',
          {
            method: 'POST',
            body: JSON.stringify({ recipientId: rid }),
          }
        );
        const convId = startRes.conversation?.id;
        if (convId) {
          await apiFetch(`/api/conversations/${encodeURIComponent(convId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({
              text: 'شارك معك قصة جديدة عبر تواصل ✨',
              kind: 'text',
            }),
          });
          sentCount += 1;
        }
      } catch {
        // Continue to next recipient if one recipient blocks DMs
      }
    }
    if (capturedClips[0]) {
      await handlePublishStory('custom', capturedClips[0], overlays, undefined, recipientIds);
    }
    if (sentCount > 0) {
      showAppToast(`تمت المشاركة مع ${formatNumber(sentCount, numeralSystem)} أشخاص`, 'success');
    } else if (!capturedClips[0]) {
      showAppToast('تعذّر الإرسال إلى المحددين بسبب إعدادات الخصوصية', 'error');
    }
  };

  // Swipe across camera screen to switch modes
  const swipeStartXRef = useRef<number | null>(null);
  const handlePreviewPointerDown = (e: React.PointerEvent) => {
    swipeStartXRef.current = e.clientX;
  };
  const handlePreviewPointerUp = (e: React.PointerEvent) => {
    if (swipeStartXRef.current === null) return;
    const dx = e.clientX - swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (Math.abs(dx) < 55) return;
    const idx = CREATE_MODES.findIndex((m) => m.id === mode);
    if (idx === -1) return;
    const nextIdx = dx < 0 ? idx + 1 : idx - 1;
    const target = CREATE_MODES[nextIdx];
    if (target) {
      selectMode(target.id);
    }
  };

  const visibleFilterIndices = [0, 1, 2].map((offset) => (filterOffset + offset) % CAMERA_FILTERS.length);

  const storyCollapsedTools: CameraToolItem[] = [
    {
      id: 'create',
      label: 'إنشاء',
      customIcon: <span className="text-[26px] font-medium leading-none">Aa</span>,
      active: false,
      onClick: openTextStory,
    },
    {
      id: 'boomerang',
      label: 'بوميرانغ',
      icon: InfinityIcon,
      active: isBoomerangBusy,
      onClick: () => void handleTriggerBoomerang(),
    },
    {
      id: 'effects',
      label: 'مؤثرات',
      icon: Wand2,
      active: activeFilter !== 'none',
      onClick: () => setActiveSheet('effects'),
    },
  ];

  const storyExtraTools: CameraToolItem[] = [
    {
      id: 'layout',
      label: 'تخطيط',
      icon: LayoutGrid,
      active: activeLayout !== 'none',
      onClick: () => setActiveSheet('layout'),
    },
    {
      id: 'greenscreen',
      label: 'شاشة خضراء',
      icon: UserSquare2,
      active: greenScreenId !== 'none',
      onClick: () => setActiveSheet('greenscreen'),
    },
    {
      id: 'timer',
      label: timerSec > 0 ? `المؤقت (${formatNumber(timerSec, numeralSystem)}ث)` : 'المؤقت',
      icon: Timer,
      active: timerSec > 0,
      onClick: () => setTimerSec((t) => (t === 0 ? 3 : t === 3 ? 10 : 0)),
    },
    {
      id: 'beauty',
      label: 'تجميل',
      icon: Sparkles,
      active: beautyLevel > 0,
      badge: !settings.beautyUsed ? 'جديد' : undefined,
      onClick: () => {
        if (!settings.beautyUsed) {
          updateSettings({ ...settings, beautyUsed: true });
        }
        setActiveSheet('beauty');
      },
    },
    {
      id: 'sound',
      label: 'صوت',
      icon: Music,
      active: Boolean(selectedSound),
      onClick: () => setActiveSheet('sound'),
    },
  ];

  const reelTools: CameraToolItem[] = [
    {
      id: 'sound',
      label: 'صوت',
      icon: Music,
      active: Boolean(selectedSound),
      onClick: () => setActiveSheet('sound'),
    },
    {
      id: 'effects',
      label: 'مؤثرات',
      icon: Sparkles,
      active: activeFilter !== 'none',
      onClick: () => setActiveSheet('effects'),
    },
    {
      id: 'greenscreen',
      label: 'شاشة خضراء',
      icon: UserSquare2,
      active: greenScreenId !== 'none',
      onClick: () => setActiveSheet('greenscreen'),
    },
    {
      id: 'beauty',
      label: 'تجميل',
      icon: Wand2,
      active: beautyLevel > 0,
      badge: !settings.beautyUsed ? 'جديد' : undefined,
      onClick: () => {
        if (!settings.beautyUsed) {
          updateSettings({ ...settings, beautyUsed: true });
        }
        setActiveSheet('beauty');
      },
    },
    {
      id: 'duration',
      label: 'المدة',
      customIcon: (
        <span className="w-[30px] h-[30px] rounded-full border-2 border-dashed border-[var(--cam-text)] flex items-center justify-center text-[11px] font-bold">
          {formatNumber(reelDurationSec, numeralSystem)}
        </span>
      ),
      active: reelDurationSec !== 15,
      onClick: () => {
        const nextIdx =
          (REEL_DURATIONS.indexOf(reelDurationSec as (typeof REEL_DURATIONS)[number]) + 1) %
          REEL_DURATIONS.length;
        setReelDurationSec(REEL_DURATIONS[nextIdx] ?? 15);
      },
    },
    {
      id: 'speed',
      label: 'السرعة',
      customIcon: (
        <span className="text-[13px] font-bold tracking-tight" dir="ltr">
          {reelSpeed}x
        </span>
      ),
      active: reelSpeed !== 1,
      onClick: () => {
        const nextIdx =
          (REEL_SPEEDS.indexOf(reelSpeed as (typeof REEL_SPEEDS)[number]) + 1) %
          REEL_SPEEDS.length;
        setReelSpeed(REEL_SPEEDS[nextIdx] ?? 1);
      },
    },
    {
      id: 'timer',
      label: timerSec > 0 ? `المؤقت (${formatNumber(timerSec, numeralSystem)}ث)` : 'المؤقت',
      icon: Timer,
      active: timerSec > 0,
      onClick: () => setTimerSec((t) => (t === 0 ? 3 : t === 3 ? 10 : 0)),
    },
  ];

  const storyVisibleTools = settings.toolsExpanded
    ? [...storyCollapsedTools, ...storyExtraTools]
    : storyCollapsedTools;

  const activeTools = mode === 'reel' ? reelTools : storyVisibleTools;

  const recordedReelSec = reelSegments.reduce((acc, s) => acc + s.durationSec, 0);
  const currentProgressRatio =
    mode === 'reel'
      ? Math.min(1, (recordedReelSec + camera.recordingElapsedSec) / reelDurationSec)
      : Math.min(1, camera.recordingElapsedSec / 15);

  const greenPreset = GREEN_SCREEN_PRESETS.find((g) => g.id === greenScreenId);

  const audienceLabel =
    audience === 'close-friends'
      ? 'الأصدقاء المقرّبون'
      : audience === 'followers'
      ? 'المتابِعون'
      : 'الأصدقاء';

  if (isEditing && capturedClips.length > 0 && mode !== 'instants') {
    return (
      <>
        <CreateEditor
          clips={capturedClips}
          mode={mode}
          currentUser={currentUser}
          selectedSound={selectedSound}
          defaultAudience={audience}
          overlays={overlays}
          onChangeOverlays={setOverlays}
          onBack={() => setIsEditing(false)}
          onOpenStickers={() => setActiveSheet('stickers')}
          onOpenSound={() => setActiveSheet('sound')}
          onOpenSoundMix={() => setActiveSheet('sound-mix')}
          onRemoveSound={() => setSelectedSound(null)}
          onOpenRecipients={() => setActiveSheet('recipients')}
          onPublish={handlePublishStory}
        />
        <CreateSheets
          activeSheet={activeSheet}
          onClose={() => setActiveSheet(null)}
          selectedSound={selectedSound}
          onSelectSound={setSelectedSound}
          videoVolume={videoVolume}
          onChangeVideoVolume={setVideoVolume}
          musicVolume={musicVolume}
          onChangeMusicVolume={setMusicVolume}
          onOpenSoundList={() => setActiveSheet('sound')}
          activeFilter={activeFilter}
          onSelectFilter={(f) => {
            setActiveFilter(f);
            setLastUsedFilter(f);
          }}
          activeLayout={activeLayout}
          onSelectLayout={setActiveLayout}
          greenScreenId={greenScreenId}
          onSelectGreenScreen={setGreenScreenId}
          beautyLevel={beautyLevel}
          onChangeBeauty={setBeautyLevel}
          settings={settings}
          onUpdateSettings={updateSettings}
          audience={audience}
          onSelectAudience={setAudience}
          onAddSticker={(overlay) =>
            setOverlays((prev) => [...prev, { ...overlay, id: `stk-${Date.now()}` }])
          }
          users={users}
          currentUserId={currentUser.id}
          onPublishToRecipients={(ids) => void handlePublishToRecipients(ids)}
        />
      </>
    );
  }

  return (
    <div
      data-testid="tw-create-view"
      className="fixed inset-0 z-40 bg-[var(--cam-bg)] text-[var(--cam-text)] flex justify-center overflow-hidden select-none"
    >
      {/* Hidden SVG clipPath definition for Instants squircle (superellipse exponent 4.2) */}
      <svg width="0" height="0" aria-hidden="true" className="absolute pointer-events-none">
        <defs>
          <clipPath id="tw-instants-squircle-clip" clipPathUnits="objectBoundingBox">
            <path d={SQUIRCLE_CLIP_PATH_D} />
          </clipPath>
        </defs>
      </svg>

      <div className="relative w-full max-w-[430px] h-full overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple={mode !== 'instants'}
          className="hidden"
          data-testid="tw-create-file-input"
          onChange={handleFilesSelected}
        />

        {/* Post Mode Picker & Editor (B1) */}
        {mode === 'post' && (
          <PostPickerPanel
            items={postItems}
            selectedIds={postSelectedIds}
            isMultiSelect={postIsMultiSelect}
            onToggleMultiSelect={() => setPostIsMultiSelect((v) => !v)}
            onAddFiles={(files) => void handlePostAddFiles(files)}
            onSelectTile={handlePostSelectTile}
            onOpenCamera={() => selectMode('story')}
            onOpenEffects={() => setActiveSheet('effects')}
            onOpenBoomerang={() => {
              selectMode('story');
              showToast('اضغط بوميرانغ للتسجيل');
            }}
            onOpenLayout={() => setActiveSheet('layout')}
            onClose={handleClose}
            onPublished={() => navigate('/', { replace: true })}
          />
        )}

        {/* Camera Modes Preview (story / reel / instants / live) */}
        {isCameraMode && (
          <div
            onPointerDown={handlePreviewPointerDown}
            onPointerUp={handlePreviewPointerUp}
            data-testid={mode === 'instants' ? 'tw-instants-squircle' : 'tw-camera-preview'}
            style={
              mode === 'instants'
                ? { clipPath: 'url(#tw-instants-squircle-clip)' }
                : undefined
            }
            className={
              mode === 'instants'
                ? 'absolute top-[191px] left-1/2 -translate-x-1/2 w-[min(360px,calc(100%-30px))] h-[min(360px,calc(100%-30px))] aspect-square rounded-[34%] overflow-hidden bg-[var(--cam-surface)] transition-opacity duration-[180ms] motion-reduce:duration-0'
                : 'absolute inset-x-[2px] top-[42px] bottom-[134px] rounded-[20px] overflow-hidden bg-[var(--cam-surface)] transition-opacity duration-[180ms] motion-reduce:duration-0'
            }
          >
            {/* Optional Green Screen Tint Layer */}
            {greenPreset && greenPreset.gradient && mode !== 'instants' && (
              <div
                className="absolute inset-0 opacity-45 pointer-events-none z-10"
                style={{ background: greenPreset.gradient }}
              />
            )}

            {/* Frozen Instant Frame (dimmed to 60% while share-with sheet is open) OR Live Camera Video */}
            {mode === 'instants' && frozenInstantClip ? (
              <img
                src={frozenInstantClip.url}
                alt="معاينة اللحظة"
                data-testid="tw-instants-frozen-img"
                className="w-full h-full object-cover opacity-60"
                draggable={false}
              />
            ) : (
              <video
                ref={camera.videoRef}
                autoPlay
                muted
                playsInline
                data-testid="tw-camera-video"
                data-facing={camera.facingMode}
                style={{
                  filter: buildPreviewFilterCss(activeFilter, beautyLevel),
                  transform: camera.facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
                className="w-full h-full object-cover"
              />
            )}

            {/* Grid Lines Setting Overlay */}
            {settings.showGrid && !frozenInstantClip && (
              <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="border border-white/20" />
                ))}
              </div>
            )}

            {/* Collage Layout Overlay */}
            {activeLayout !== 'none' && mode === 'story' && (
              <div
                className={`absolute inset-0 pointer-events-none z-10 grid ${
                  activeLayout === '2x2'
                    ? 'grid-cols-2 grid-rows-2'
                    : activeLayout === '3x1'
                    ? 'grid-cols-1 grid-rows-3'
                    : 'grid-cols-4 grid-rows-4'
                }`}
              >
                {Array.from({
                  length: activeLayout === '2x2' ? 4 : activeLayout === '3x1' ? 3 : 16,
                }).map((_, idx) => (
                  <div key={idx} className="border border-white/35" />
                ))}
              </div>
            )}

            {/* Reel Segmented Top Progress Bar (height 3, gap 2) */}
            {mode === 'reel' && (
              <div className="absolute top-2 inset-x-3 z-20 flex items-center gap-[2px] h-[3px]">
                {reelSegments.map((seg) => (
                  <div
                    key={seg.id}
                    style={{ width: `${Math.max(4, (seg.durationSec / reelDurationSec) * 100)}%` }}
                    className="h-full rounded-full bg-[var(--live)]"
                  />
                ))}
                <div className="flex-1 h-full rounded-full bg-[var(--cam-muted)]/40 overflow-hidden">
                  {camera.isRecording && (
                    <div
                      style={{
                        width: `${Math.min(100, (camera.recordingElapsedSec / reelDurationSec) * 100)}%`,
                      }}
                      className="h-full bg-[var(--live)]"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Timer Countdown Overlay (96/700 white) */}
            {countdownLeft !== null && (
              <button
                type="button"
                onClick={() => {
                  if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                  countdownTimerRef.current = null;
                  setCountdownLeft(null);
                }}
                aria-label="إلغاء المؤقت"
                className="absolute inset-0 z-30 bg-[var(--cam-scrim)] flex flex-col items-center justify-center gap-2"
              >
                <span className="text-[96px] font-bold leading-none text-[var(--cam-text)] drop-shadow-lg animate-pulse">
                  {formatNumber(countdownLeft, numeralSystem)}
                </span>
                <span className="text-xs font-semibold text-[var(--cam-muted)]">
                  اضغط للإلغاء
                </span>
              </button>
            )}

            {/* Permission Denied / No Camera / Insecure Context Fallback Card */}
            {!frozenInstantClip &&
              (camera.permissionState === 'denied' ||
                camera.permissionState === 'unavailable' ||
                camera.permissionState === 'insecure') && (
                <div
                  data-testid="tw-camera-fallback-card"
                  className="absolute inset-0 z-20 bg-[var(--cam-surface)]/95 flex items-center justify-center p-5"
                >
                  <div className="w-full max-w-xs rounded-3xl bg-[var(--cam-surface-2)] border border-white/10 p-4 text-center flex flex-col items-center gap-2.5 shadow-2xl">
                    <div className="w-11 h-11 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center">
                      <Camera className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm font-bold text-[var(--cam-text)]">
                      نحتاج إذن الكاميرا
                    </h2>
                    <p className="text-[11px] text-[var(--cam-muted)] leading-relaxed">
                      {camera.permissionState === 'insecure'
                        ? 'يتطلب الوصول للكاميرا اتصالاً آمناً. يمكنك اختيار وسائط من جهازك.'
                        : 'لا توجد كاميرا متصلة أو لم يتم منح الإذن. يمكنك السماح بالكاميرا أو اختيار وسائط من المعرض.'}
                    </p>
                    <div className="flex flex-col gap-2 w-full pt-0.5">
                      <button
                        type="button"
                        onClick={() => void camera.startCamera(camera.facingMode, false)}
                        className="w-full h-10 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
                      >
                        السماح
                      </button>
                      <button
                        type="button"
                        data-testid="tw-fallback-gallery-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-10 rounded-xl bg-[var(--cam-surface)] border border-white/15 text-[var(--cam-text)] text-xs font-semibold"
                      >
                        اختيار من المعرض
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Top Bar (Camera modes: height 56 under safe-area, 44x44 buttons, 28px white icons) */}
        {isCameraMode && !frozenInstantClip && !(mode === 'live' && isLiveSessionBusy) && (
          <header className="absolute top-[max(41px,calc(12px+var(--sat)))] inset-x-0 h-[56px] z-30 pointer-events-none">
            <button
              type="button"
              data-testid="tw-create-close"
              onClick={handleClose}
              aria-label="إغلاق"
              className="pointer-events-auto absolute top-[6px] start-[3px] w-[44px] h-[44px] flex items-center justify-center text-[var(--cam-text)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)] active:scale-95"
            >
              <X className="w-[28px] h-[28px]" />
            </button>

            <div className="pointer-events-auto absolute top-[6px] left-1/2 -translate-x-1/2 h-[44px] flex items-center justify-center">
              {mode === 'instants' ? (
                <h1 className="text-[17px] font-bold text-[var(--cam-text)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  لحظة جديدة
                </h1>
              ) : mode !== 'live' ? (
                <button
                  type="button"
                  onClick={() => void camera.toggleTorch()}
                  aria-label="تبديل الفلاش"
                  className="w-[44px] h-[44px] flex items-center justify-center text-[var(--cam-text)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)] active:scale-95"
                >
                  {camera.torchOn ? (
                    <Zap className="w-[28px] h-[28px] text-[var(--gold)]" />
                  ) : (
                    <ZapOff className="w-[28px] h-[28px]" />
                  )}
                </button>
              ) : null}
            </div>

            <button
              type="button"
              data-testid="tw-create-settings-btn"
              onClick={() => setActiveSheet('settings')}
              aria-label="إعدادات الكاميرا"
              className="pointer-events-auto absolute top-[6px] end-[5px] w-[44px] h-[44px] flex items-center justify-center text-[var(--cam-text)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)] active:scale-95"
            >
              {mode === 'instants' ? (
                <LayoutGrid className="w-[28px] h-[28px]" />
              ) : (
                <Settings className="w-[28px] h-[28px]" />
              )}
            </button>
          </header>
        )}

        {/* Add-Sound Pill (Story / Reel centered at y=124) */}
        {(mode === 'story' || mode === 'reel') &&
          camera.permissionState !== 'denied' &&
          camera.permissionState !== 'unavailable' &&
          camera.permissionState !== 'insecure' && (
            <div className="absolute top-[106px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5">
              <button
                type="button"
                data-testid="tw-create-sound-pill"
                onClick={() => setActiveSheet('sound')}
                className="h-[36px] min-w-[105px] px-3.5 rounded-full bg-[var(--cam-scrim)] backdrop-blur-md text-[var(--cam-text)] flex items-center justify-center gap-1.5 text-[15px] font-semibold"
              >
                <Music className="w-[18px] h-[18px] shrink-0" />
                <span>إضافة صوت</span>
              </button>
              {selectedSound && (
                <div className="px-3 h-7 rounded-full bg-[var(--cam-surface)]/85 border border-white/10 text-xs font-semibold text-[var(--cam-text)] flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-[var(--primary)] rounded-full animate-pulse" />
                  <span className="truncate max-w-[160px]">{selectedSound.title}</span>
                </div>
              )}
            </div>
          )}

        {/* Vertical Tool Column: Story collapsed (centers y=396, 440, 485, 530) -> expanded (8 rows), Reel (7 rows) */}
        {(mode === 'story' || mode === 'reel') &&
          camera.permissionState !== 'denied' &&
          camera.permissionState !== 'unavailable' &&
          camera.permissionState !== 'insecure' && (
            <CameraToolColumn
              mode={mode}
              tools={activeTools}
              toolsExpanded={settings.toolsExpanded}
              onToggleExpand={() =>
                updateSettings({ ...settings, toolsExpanded: !settings.toolsExpanded })
              }
            />
          )}

        {/* Story & Reel Bottom Controls Row (y = 733 center) */}
        {(mode === 'story' || mode === 'reel') && (
          <>
            <button
              type="button"
              onClick={() => {
                if (lastUsedFilter) setActiveFilter(lastUsedFilter);
                else setActiveSheet('effects');
              }}
              aria-label="آخر مؤثر مستخدم"
              className="absolute top-[min(711.5px,calc(100%-127.5px))] start-[88.5px] z-30 w-[43px] h-[43px] rounded-full overflow-hidden border-2 border-white/80 bg-[var(--cam-surface)] flex items-center justify-center"
            >
              {lastUsedFilter ? (
                <span
                  className="w-full h-full block"
                  style={{
                    background:
                      CAMERA_FILTERS.find((f) => f.id === lastUsedFilter)?.swatchGradient ??
                      'var(--cam-surface-2)',
                  }}
                />
              ) : (
                <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={43} />
              )}
            </button>

            <button
              type="button"
              data-testid="tw-camera-shutter"
              aria-label={camera.isRecording ? 'جارٍ التسجيل' : 'التقاط'}
              onPointerDown={handleShutterPointerDown}
              onPointerUp={() => void handleShutterPointerUp()}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  if (camera.permissionState === 'granted') triggerPhotoWithTimer();
                  else fileInputRef.current?.click();
                }
              }}
              className="absolute top-[min(699px,calc(100%-140px))] left-1/2 -translate-x-1/2 z-30 w-[68px] h-[68px] rounded-full flex items-center justify-center active:scale-[0.92] motion-reduce:active:scale-100 transition-transform"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 68 68">
                <circle
                  cx="34"
                  cy="34"
                  r="31"
                  fill="none"
                  stroke={camera.isRecording ? 'rgba(255,255,255,0.28)' : 'var(--cam-text)'}
                  strokeWidth="4"
                />
                {camera.isRecording && (
                  <circle
                    cx="34"
                    cy="34"
                    r="31"
                    fill="none"
                    stroke="var(--live)"
                    strokeWidth="4"
                    strokeDasharray={2 * Math.PI * 31}
                    strokeDashoffset={2 * Math.PI * 31 * (1 - currentProgressRatio)}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <span
                className={`block rounded-full transition-all ${
                  camera.isRecording
                    ? 'w-[28px] h-[28px] rounded-[8px] bg-[var(--live)]'
                    : 'w-[52px] h-[52px] bg-[var(--cam-text)]'
                }`}
              />
            </button>

            <div
              className="absolute top-[min(711.5px,calc(100%-127.5px))] start-[236px] z-30 flex items-center gap-[6px] overflow-hidden"
              onWheel={() => setFilterOffset((o) => (o + 1) % CAMERA_FILTERS.length)}
            >
              {visibleFilterIndices.map((fIdx, slotIdx) => {
                const f = CAMERA_FILTERS[fIdx]!;
                const selected = activeFilter === f.id;
                return (
                  <button
                    key={`${f.id}-${slotIdx}`}
                    type="button"
                    aria-label={`فلتر ${f.label}`}
                    onClick={() => {
                      setActiveFilter(f.id);
                      setLastUsedFilter(f.id);
                      setFilterOffset(fIdx);
                    }}
                    className={`w-[43px] h-[43px] rounded-full shrink-0 border-2 transition-transform ${
                      selected ? 'border-[var(--primary)] scale-105' : 'border-white/75'
                    }`}
                    style={{ background: f.swatchGradient }}
                  />
                );
              })}
            </div>

            {mode === 'reel' && reelSegments.length > 0 && (
              <div className="absolute top-[min(655px,calc(100%-184px))] inset-x-4 z-30 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setReelSegments((prev) => prev.slice(0, -1))}
                  className="px-3 h-9 rounded-full bg-[var(--cam-surface)]/90 text-xs font-bold text-[var(--cam-text)] flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>تراجع</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCapturedClips(reelSegments);
                    setOverlays([]);
                    setIsEditing(true);
                  }}
                  aria-label="متابعة للتحرير"
                  className="w-11 h-11 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center shadow-lg"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Instants Mode Controls (B3) */}
        {mode === 'instants' && !frozenInstantClip && (
          <>
            <button
              type="button"
              onClick={() => void camera.toggleTorch()}
              aria-label="تبديل الفلاش"
              className="absolute top-[min(665px,calc(100%-174px))] start-[74px] z-30 w-[50px] h-[50px] rounded-full bg-[var(--cam-surface)] text-[var(--cam-text)] flex items-center justify-center active:scale-95"
            >
              {camera.torchOn ? (
                <Zap className="w-[26px] h-[26px] text-[var(--gold)]" />
              ) : (
                <ZapOff className="w-[26px] h-[26px]" />
              )}
            </button>

            <button
              type="button"
              data-testid="tw-instants-shutter"
              aria-label="التقاط"
              onClick={() => {
                if (camera.permissionState === 'granted') triggerPhotoWithTimer();
                else fileInputRef.current?.click();
              }}
              className="absolute top-[min(649px,calc(100%-190px))] left-1/2 -translate-x-1/2 z-30 w-[82px] h-[82px] rounded-full border-[5px] border-[var(--cam-text)] flex items-center justify-center active:scale-[0.92] motion-reduce:active:scale-100 transition-transform"
            >
              <span className="w-[64px] h-[64px] rounded-full bg-[var(--cam-text)] block" />
            </button>

            <button
              type="button"
              data-testid="tw-instants-flip"
              onClick={camera.flipCamera}
              aria-label="تبديل الكاميرا"
              className="absolute top-[min(665px,calc(100%-174px))] start-[264px] z-30 w-[50px] h-[50px] rounded-full bg-[var(--cam-surface)] text-[var(--cam-text)] flex items-center justify-center active:scale-95"
            >
              <SwitchCamera className="w-[26px] h-[26px]" />
            </button>

            <button
              type="button"
              data-testid="tw-instants-audience"
              onClick={() => setActiveSheet('audience')}
              className="absolute top-[min(732px,calc(100%-112px))] left-1/2 -translate-x-1/2 z-30 min-w-[115px] h-[42px] px-2.5 rounded-full bg-[var(--cam-surface)] text-[var(--cam-text)] flex items-center justify-center gap-2"
            >
              <span className="w-6 h-6 rounded-full bg-[var(--lapis)] text-[var(--lapis-fg)] flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </span>
              <span className="text-[17px] font-bold leading-none">{audienceLabel}</span>
              <ChevronDown className="w-4 h-4 text-[var(--cam-muted)] shrink-0" />
            </button>
          </>
        )}

        {/* Instants Share-With Sheet (auto-opens after capture, B3) */}
        <InstantsShareSheet
          isOpen={mode === 'instants' && Boolean(frozenInstantClip)}
          users={users}
          currentUserId={currentUser.id}
          numeralSystem={numeralSystem}
          audience={audience}
          onSelectAudience={setAudience}
          onCancel={() => setFrozenInstantClip(null)}
          onSend={(a) => void handleSendInstant(a)}
        />

        {/* Live Mode Controls (B4) */}
        {mode === 'live' && (
          <LiveModeControls
            activeFilter={activeFilter}
            onSelectFilter={(f) => {
              setActiveFilter(f);
              setLastUsedFilter(f);
            }}
            onFlipCamera={camera.flipCamera}
            onStopAllTracks={camera.stopAllTracks}
            onCloseCreate={handleClose}
            onLiveActiveChange={setIsLiveSessionBusy}
            numeralSystem={numeralSystem}
          />
        )}

        {/* Bottom Strip Row: Gallery (start, 48x48) in Story, Reel & Instants */}
        {(mode === 'story' || mode === 'reel' || (mode === 'instants' && !frozenInstantClip)) && (
          <button
            type="button"
            data-testid={mode === 'instants' ? 'tw-instants-gallery-btn' : 'tw-create-gallery-btn'}
            onClick={() => fileInputRef.current?.click()}
            aria-label="اختيار من المعرض"
            className="absolute bottom-[calc(23px+var(--sab))] start-[8px] z-30 w-[48px] h-[48px] rounded-[10px] border-2 border-[var(--cam-text)] overflow-hidden bg-[var(--cam-surface)] flex items-center justify-center"
          >
            {galleryThumb ? (
              <img src={galleryThumb} alt="المعرض" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-5 h-5 text-[var(--cam-text)]" />
            )}
          </button>
        )}

        {/* Mode Strip (5 modes in RTL order, role=tablist, hidden when Instants Share sheet or active Live is open) */}
        {!frozenInstantClip && !(mode === 'live' && isLiveSessionBusy) && (
          <div
            role="tablist"
            aria-label="أوضاع الإنشاء"
            data-testid="tw-create-mode-strip"
            className={`absolute bottom-[calc(27.5px+var(--sab))] left-1/2 -translate-x-1/2 z-30 h-[39px] max-w-[calc(100%-128px)] sm:max-w-[400px] sm:w-auto rounded-full px-[14px] sm:px-[18px] flex items-center gap-[16px] sm:gap-[22px] overflow-x-auto snap-x snap-mandatory scrollbar-none transition-colors duration-[180ms] motion-reduce:duration-0 ${
              mode === 'reel'
                ? 'bg-transparent'
                : mode === 'post'
                ? 'bg-[var(--cam-surface)]/92'
                : 'bg-[var(--cam-surface)]/90'
            }`}
          >
            {CREATE_MODES.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  ref={(el) => {
                    stripTabRefs.current[m.id] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`tw-mode-tab-${m.id}`}
                  onClick={() => selectMode(m.id)}
                  className={`snap-center shrink-0 h-full flex items-center text-[15px] tracking-[0px] whitespace-nowrap transition-colors ${
                    active
                      ? 'text-[var(--cam-text)] font-bold'
                      : 'text-[var(--cam-muted)] font-semibold'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

        {/* End Flip Button in Story & Reel */}
        {(mode === 'story' || mode === 'reel') && (
          <button
            type="button"
            data-testid="tw-create-flip-btn"
            onClick={camera.flipCamera}
            aria-label="تبديل الكاميرا"
            className="absolute bottom-[calc(25px+var(--sab))] end-[12px] z-30 w-[44px] h-[44px] flex items-center justify-center text-[var(--cam-text)] active:scale-95"
          >
            <SwitchCamera className="w-[28px] h-[28px]" />
          </button>
        )}

        {/* Toast over Camera Screen */}
        {toastMsg && (
          <div
            role="status"
            data-testid="tw-create-toast"
            className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-[var(--cam-surface)] text-[var(--cam-text)] text-xs font-bold border border-white/15 shadow-lg whitespace-nowrap"
          >
            {toastMsg}
          </div>
        )}

        {/* Bottom Sheets */}
        <CreateSheets
          activeSheet={activeSheet}
          onClose={() => setActiveSheet(null)}
          selectedSound={selectedSound}
          onSelectSound={setSelectedSound}
          videoVolume={videoVolume}
          onChangeVideoVolume={setVideoVolume}
          musicVolume={musicVolume}
          onChangeMusicVolume={setMusicVolume}
          onOpenSoundList={() => setActiveSheet('sound')}
          activeFilter={activeFilter}
          onSelectFilter={(f) => {
            setActiveFilter(f);
            setLastUsedFilter(f);
          }}
          activeLayout={activeLayout}
          onSelectLayout={setActiveLayout}
          greenScreenId={greenScreenId}
          onSelectGreenScreen={setGreenScreenId}
          beautyLevel={beautyLevel}
          onChangeBeauty={setBeautyLevel}
          settings={settings}
          onUpdateSettings={updateSettings}
          audience={audience}
          onSelectAudience={setAudience}
          onAddSticker={(overlay) =>
            setOverlays((prev) => [...prev, { ...overlay, id: `stk-${Date.now()}` }])
          }
          users={users}
          currentUserId={currentUser.id}
          onPublishToRecipients={(ids) => void handlePublishToRecipients(ids)}
        />
      </div>
    </div>
  );
}
