import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import {
  Play,
  Pause,
  Check,
  Search,
  MapPin,
  AtSign,
  BarChart3,
  HelpCircle,
  Clock,
  Sparkles,
  Grid,
  Users,
  Heart,
  Globe,
  Radio,
} from 'lucide-react';
import {
  CAMERA_FILTERS,
  GREEN_SCREEN_PRESETS,
  HERITAGE_MOTIFS,
  IRAQI_LOCATIONS,
  LAYOUT_OPTIONS,
  SEED_AUDIO_TRACKS,
  type CameraSettingsPrefs,
  type LayoutGridId,
  type SeedAudioTrack,
} from '../../lib/createUtils';
import type { CameraFilterId, StoryAudience, StoryOverlayItem, User } from '../../types';
import { HeritageSvg } from './HeritageMotifs';
import { formatNumber } from '../../lib/formatters';
import { Avatar } from '../ui/Avatar';

export type ActiveCreateSheet =
  | null
  | 'sound'
  | 'sound-mix'
  | 'effects'
  | 'layout'
  | 'greenscreen'
  | 'beauty'
  | 'settings'
  | 'audience'
  | 'live-soon'
  | 'stickers'
  | 'recipients';

interface CreateSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  testId: string;
  children: React.ReactNode;
}

function CreateSheetShell({ isOpen, onClose, title, testId, children }: CreateSheetShellProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      testId={testId}
      className="!p-0 !items-end !justify-center"
      contentClassName="max-w-md w-full !max-h-[60vh] rounded-t-[24px] bg-[var(--cam-surface)] text-[var(--cam-text)] border-t border-white/10 shadow-2xl overflow-y-auto pb-[env(safe-area-inset-bottom,16px)]"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="w-[36px] h-[4px] rounded-full bg-[var(--cam-muted)]/40 mx-auto shrink-0" />
        <h2 className="text-base font-bold text-center text-[var(--cam-text)]">{title}</h2>
        {children}
      </div>
    </Modal>
  );
}

export interface CreateSheetsProps {
  activeSheet: ActiveCreateSheet;
  onClose: () => void;
  selectedSound: SeedAudioTrack | null;
  onSelectSound: (track: SeedAudioTrack | null) => void;
  videoVolume?: number;
  onChangeVideoVolume?: (val: number) => void;
  musicVolume?: number;
  onChangeMusicVolume?: (val: number) => void;
  onOpenSoundList?: () => void;
  activeFilter: CameraFilterId;
  onSelectFilter: (id: CameraFilterId) => void;
  activeLayout: LayoutGridId;
  onSelectLayout: (id: LayoutGridId) => void;
  greenScreenId: string;
  onSelectGreenScreen: (id: string) => void;
  beautyLevel: number;
  onChangeBeauty: (val: number) => void;
  settings: CameraSettingsPrefs;
  onUpdateSettings: (next: CameraSettingsPrefs) => void;
  audience: StoryAudience;
  onSelectAudience: (a: StoryAudience) => void;
  onAddSticker: (overlay: Omit<StoryOverlayItem, 'id'>) => void;
  users: User[];
  currentUserId?: string;
  onPublishToRecipients: (userIds: string[]) => void;
}

export function CreateSheets({
  activeSheet,
  onClose,
  selectedSound,
  onSelectSound,
  videoVolume = 30,
  onChangeVideoVolume,
  musicVolume = 100,
  onChangeMusicVolume,
  onOpenSoundList,
  activeFilter,
  onSelectFilter,
  activeLayout,
  onSelectLayout,
  greenScreenId,
  onSelectGreenScreen,
  beautyLevel,
  onChangeBeauty,
  settings,
  onUpdateSettings,
  audience,
  onSelectAudience,
  onAddSticker,
  users,
  currentUserId,
  onPublishToRecipients,
}: CreateSheetsProps) {
  const [soundQuery, setSoundQuery] = useState('');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stickerTab, setStickerTab] = useState<
    'heritage' | 'location' | 'mention' | 'poll' | 'question' | 'countdown'
  >('heritage');
  const [pollQuestion, setPollQuestion] = useState('شنو رأيكم؟');
  const [pollOptions, setPollOptions] = useState(['نعم', 'لا']);
  const [questionPrompt, setQuestionPrompt] = useState('اسألني أي شي!');
  const [countdownTitle, setCountdownTitle] = useState('موعدنا القادم');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  const stopPreviewAudio = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      } catch {}
    }
    setPlayingTrackId(null);
  };

  useEffect(() => {
    if (activeSheet !== 'sound') {
      stopPreviewAudio();
    }
    return () => stopPreviewAudio();
  }, [activeSheet]);

  const togglePlayPreview = (track: SeedAudioTrack) => {
    if (playingTrackId === track.id) {
      stopPreviewAudio();
      return;
    }
    stopPreviewAudio();
    setPlayingTrackId(track.id);

    const a = previewAudioRef.current;
    if (a) {
      a.src = track.audioUrl;
      a.currentTime = 0;
      a.volume = 0.85;
      void a.play().catch(() => {});
    }

    previewTimerRef.current = setTimeout(() => {
      stopPreviewAudio();
    }, 10000);
  };

  const filteredTracks = SEED_AUDIO_TRACKS.filter(
    (t) =>
      !soundQuery.trim() ||
      t.title.includes(soundQuery.trim()) ||
      t.artist.includes(soundQuery.trim())
  );

  return (
    <>
      {/* 1. Sound Sheet */}
      <audio ref={previewAudioRef} data-testid="tw-sound-preview-audio" preload="none" />
      <CreateSheetShell
        isOpen={activeSheet === 'sound'}
        onClose={onClose}
        title="إضافة صوت"
        testId="tw-create-sheet-sound"
      >
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--cam-muted)] absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="search"
            value={soundQuery}
            onChange={(e) => setSoundQuery(e.target.value)}
            placeholder="ابحث عن مقام أو مقطع..."
            aria-label="بحث عن صوت"
            className="w-full h-11 ps-9 pe-3 rounded-xl bg-[var(--cam-surface-2)] text-sm text-[var(--cam-text)] placeholder:text-[var(--cam-muted)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        <div className="flex flex-col gap-2">
          {filteredTracks.map((track) => {
            const isPlaying = playingTrackId === track.id;
            const isChosen = selectedSound?.id === track.id;
            return (
              <div
                key={track.id}
                data-testid={`tw-sound-row-${track.id}`}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border ${
                  isChosen
                    ? 'border-[var(--primary)] bg-[var(--cam-surface-2)]'
                    : 'border-white/5 bg-[var(--cam-surface-2)]/60'
                }`}
              >
                <button
                  type="button"
                  data-testid={`tw-sound-preview-${track.id}`}
                  onClick={() => togglePlayPreview(track)}
                  className="w-11 h-11 rounded-xl bg-[var(--cam-surface)] text-[var(--cam-text)] flex items-center justify-center shrink-0"
                  aria-label={isPlaying ? `إيقاف ${track.title}` : `معاينة ${track.title}`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  data-testid={`tw-sound-pick-${track.id}`}
                  onClick={() => {
                    onSelectSound(isChosen ? null : track);
                    onClose();
                  }}
                  className="flex-1 text-start min-w-0 py-1"
                >
                  <p className="text-sm font-bold text-[var(--cam-text)] truncate">{track.title}</p>
                  <p className="text-xs text-[var(--cam-muted)] truncate">
                    {track.artist} · {formatNumber(track.durationSec)} ث
                  </p>
                </button>

                {isChosen && (
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CreateSheetShell>

      {/* 1b. Sound Mix Sheet (تعديل الصوت) */}
      <CreateSheetShell
        isOpen={activeSheet === 'sound-mix'}
        onClose={onClose}
        title="تعديل الصوت"
        testId="tw-create-sheet-sound-mix"
      >
        <div className="flex flex-col gap-3.5 py-1">
          {selectedSound && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--cam-surface-2)] border border-white/10">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--cam-text)] truncate">{selectedSound.title}</p>
                <p className="text-[11px] text-[var(--cam-muted)] truncate">{selectedSound.artist}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenSoundList && (
                  <button
                    type="button"
                    onClick={onOpenSoundList}
                    className="h-8 px-2.5 rounded-lg bg-[var(--cam-surface)] text-xs font-semibold text-[var(--cam-text)]"
                  >
                    تغيير
                  </button>
                )}
                <button
                  type="button"
                  data-testid="tw-sound-mix-remove"
                  onClick={() => {
                    onSelectSound(null);
                    onClose();
                  }}
                  className="h-8 px-2.5 rounded-lg bg-[var(--danger-tint)] text-[var(--danger)] text-xs font-bold"
                >
                  إزالة
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--cam-text)]">صوت الفيديو الأصلي</span>
              <span className="font-bold text-[var(--cam-muted)]">{formatNumber(videoVolume)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              data-testid="tw-slider-video-vol"
              value={videoVolume}
              onChange={(e) => onChangeVideoVolume?.(Number(e.target.value))}
              aria-label="صوت الفيديو الأصلي"
              className="w-full accent-[var(--primary)] h-2 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--cam-text)]">الموسيقى</span>
              <span className="font-bold text-[var(--cam-muted)]">{formatNumber(musicVolume)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              data-testid="tw-slider-music-vol"
              value={musicVolume}
              onChange={(e) => onChangeMusicVolume?.(Number(e.target.value))}
              aria-label="مستوى الموسيقى"
              className="w-full accent-[var(--primary)] h-2 cursor-pointer"
            />
          </div>

          <button
            type="button"
            data-testid="tw-sound-mix-done"
            onClick={onClose}
            className="h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-bold text-sm"
          >
            تم
          </button>
        </div>
      </CreateSheetShell>

      {/* 2. Effects Sheet */}
      <CreateSheetShell
        isOpen={activeSheet === 'effects'}
        onClose={onClose}
        title="المؤثرات والفلاتر"
        testId="tw-create-sheet-effects"
      >
        <div className="grid grid-cols-3 gap-2.5">
          {CAMERA_FILTERS.map((f) => {
            const active = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onSelectFilter(f.id);
                  onClose();
                }}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 min-h-[44px] ${
                  active ? 'border-[var(--primary)] bg-[var(--cam-surface-2)]' : 'border-white/10'
                }`}
              >
                <span
                  className="w-11 h-11 rounded-full border-2 border-white/60"
                  style={{ background: f.swatchGradient }}
                />
                <span className="text-xs font-semibold text-[var(--cam-text)]">{f.label}</span>
              </button>
            );
          })}
        </div>
      </CreateSheetShell>

      {/* 3. Layout Sheet */}
      <CreateSheetShell
        isOpen={activeSheet === 'layout'}
        onClose={onClose}
        title="تخطيط الشبكة"
        testId="tw-create-sheet-layout"
      >
        <div className="grid grid-cols-2 gap-2.5">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelectLayout(opt.id);
                onClose();
              }}
              className={`h-12 px-4 rounded-2xl border flex items-center justify-between text-sm font-semibold ${
                activeLayout === opt.id
                  ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--cam-text)]'
                  : 'border-white/10 bg-[var(--cam-surface-2)] text-[var(--cam-muted)]'
              }`}
            >
              <span>{opt.label}</span>
              <Grid className="w-4 h-4" />
            </button>
          ))}
        </div>
      </CreateSheetShell>

      {/* 4. Green Screen Sheet */}
      <CreateSheetShell
        isOpen={activeSheet === 'greenscreen'}
        onClose={onClose}
        title="الشاشة الخضراء والخلفيات"
        testId="tw-create-sheet-greenscreen"
      >
        <div className="grid grid-cols-2 gap-2.5">
          {GREEN_SCREEN_PRESETS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onSelectGreenScreen(g.id);
                onClose();
              }}
              className={`p-3 rounded-2xl border flex items-center gap-3 min-h-[48px] ${
                greenScreenId === g.id
                  ? 'border-[var(--primary)] bg-[var(--cam-surface-2)]'
                  : 'border-white/10 bg-[var(--cam-surface-2)]/50'
              }`}
            >
              <span
                className="w-8 h-8 rounded-xl border border-white/20 shrink-0"
                style={{ background: g.gradient || 'var(--cam-bg)' }}
              />
              <span className="text-xs font-semibold text-[var(--cam-text)]">{g.label}</span>
            </button>
          ))}
        </div>
      </CreateSheetShell>

      {/* 5. Beauty Touch-up Sheet */}
      <CreateSheetShell
        isOpen={activeSheet === 'beauty'}
        onClose={onClose}
        title="تجميل وتنعيم الإضاءة"
        testId="tw-create-sheet-beauty"
      >
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--cam-muted)]">النعومة والإضاءة</span>
            <span className="font-bold text-[var(--cam-text)]">{formatNumber(beautyLevel)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={beautyLevel}
            onChange={(e) => onChangeBeauty(Number(e.target.value))}
            aria-label="مستوى التجميل"
            className="w-full accent-[var(--primary)] h-2 cursor-pointer"
          />
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-bold text-sm"
          >
            تطبيق
          </button>
        </div>
      </CreateSheetShell>

      {/* 6. Camera Settings Sheet (persisted in tw.camera.v1) */}
      <CreateSheetShell
        isOpen={activeSheet === 'settings'}
        onClose={onClose}
        title="إعدادات الكاميرا"
        testId="tw-create-sheet-settings"
      >
        <div className="flex flex-col gap-2">
          {[
            {
              key: 'showGrid' as const,
              label: 'خطوط الشبكة',
              desc: 'إظهار شبكة التثليث أثناء التصوير',
            },
            {
              key: 'highQuality' as const,
              label: 'جودة عالية (١٠٨٠p)',
              desc: 'التقاط بدقة أعلى عندما يدعم الجهاز ذلك',
            },
            {
              key: 'saveOriginal' as const,
              label: 'حفظ النسخة الأصلية على الجهاز',
              desc: 'تنزيل نسخة تلقائياً بعد الالتقاط',
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--cam-surface-2)] cursor-pointer min-h-[52px]"
            >
              <div>
                <p className="text-sm font-bold text-[var(--cam-text)]">{item.label}</p>
                <p className="text-xs text-[var(--cam-muted)]">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={settings[item.key]}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, [item.key]: e.target.checked })
                }
                className="w-5 h-5 accent-[var(--primary)]"
              />
            </label>
          ))}
        </div>
      </CreateSheetShell>

      {/* 7. Instants Audience Sheet */}
      <CreateSheetShell
        isOpen={activeSheet === 'audience'}
        onClose={onClose}
        title="الجمهور"
        testId="tw-create-sheet-audience"
      >
        <div className="flex flex-col gap-2">
          {[
            { id: 'everyone' as const, label: 'الأصدقاء', icon: Users },
            { id: 'close-friends' as const, label: 'الأصدقاء المقرّبون', icon: Heart },
            { id: 'followers' as const, label: 'المتابِعون', icon: Globe },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = audience === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelectAudience(opt.id);
                  onClose();
                }}
                className={`h-12 px-4 rounded-2xl flex items-center justify-between border ${
                  active
                    ? 'border-[var(--primary)] bg-[var(--cam-surface-2)]'
                    : 'border-white/10 bg-[var(--cam-surface-2)]/50'
                }`}
              >
                <span className="flex items-center gap-3 text-sm font-bold text-[var(--cam-text)]">
                  <Icon className="w-5 h-5 text-[var(--primary)]" />
                  <span>{opt.label}</span>
                </span>
                {active && <Check className="w-5 h-5 text-[var(--primary)]" />}
              </button>
            );
          })}
        </div>
      </CreateSheetShell>

      {/* 8. Live Soon Sheet */}
      <CreateSheetShell
        isOpen={activeSheet === 'live-soon'}
        onClose={onClose}
        title="البث المباشر قريباً"
        testId="tw-create-sheet-live"
      >
        <div className="flex flex-col items-center text-center gap-3 py-3">
          <div className="w-14 h-14 rounded-full bg-[var(--cam-surface-2)] flex items-center justify-center text-[var(--live)]">
            <Radio className="w-7 h-7" />
          </div>
          <p className="text-sm text-[var(--cam-muted)] leading-relaxed">
            نعمل حالياً على تفعيل البث المباشر الفوري في هذا الوضع. يمكنك مشاركة اللحظات والستوري والريلز الآن.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-bold text-sm"
          >
            حسناً
          </button>
        </div>
      </CreateSheetShell>

      {/* 9. Stickers Sheet */}
      <CreateSheetShell
        isOpen={activeSheet === 'stickers'}
        onClose={onClose}
        title="الملصقات والتراث العراقي"
        testId="tw-create-sheet-stickers"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'heritage' as const, label: 'قطعة تراثية', icon: Sparkles },
            { id: 'location' as const, label: 'الموقع', icon: MapPin },
            { id: 'mention' as const, label: 'منشن', icon: AtSign },
            { id: 'poll' as const, label: 'استفتاء', icon: BarChart3 },
            { id: 'question' as const, label: 'سؤال', icon: HelpCircle },
            { id: 'countdown' as const, label: 'عد تنازلي', icon: Clock },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setStickerTab(t.id)}
                className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 ${
                  stickerTab === t.id
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'bg-[var(--cam-surface-2)] text-[var(--cam-muted)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {stickerTab === 'heritage' && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {HERITAGE_MOTIFS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onAddSticker({
                    kind: 'sticker',
                    stickerKind: 'heritage',
                    motifId: m.id,
                    text: m.label,
                    xPct: 50,
                    yPct: 48,
                    scale: 1,
                    rotation: 0,
                  });
                  onClose();
                }}
                className="p-2.5 rounded-2xl bg-[var(--cam-surface-2)] hover:bg-white/10 flex flex-col items-center gap-1.5 text-[var(--gold)]"
              >
                <HeritageSvg motifId={m.id} className="w-8 h-8" />
                <span className="text-[11px] font-semibold text-[var(--cam-text)] truncate w-full text-center">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {stickerTab === 'location' && (
          <div className="grid grid-cols-2 gap-2">
            {IRAQI_LOCATIONS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  onAddSticker({
                    kind: 'sticker',
                    stickerKind: 'location',
                    text: loc,
                    xPct: 50,
                    yPct: 55,
                    scale: 1,
                    rotation: 0,
                  });
                  onClose();
                }}
                className="h-11 px-3 rounded-xl bg-[var(--cam-surface-2)] text-xs font-bold text-[var(--cam-text)] flex items-center gap-2 text-start"
              >
                <MapPin className="w-4 h-4 text-[var(--primary)] shrink-0" />
                <span className="truncate">{loc}</span>
              </button>
            ))}
          </div>
        )}

        {stickerTab === 'mention' && (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onAddSticker({
                    kind: 'sticker',
                    stickerKind: 'mention',
                    text: `@${u.username}`,
                    xPct: 50,
                    yPct: 45,
                    scale: 1,
                    rotation: 0,
                  });
                  onClose();
                }}
                className="h-12 px-3 rounded-xl bg-[var(--cam-surface-2)] flex items-center gap-3 text-start"
              >
                <Avatar src={u.avatarUrl} name={u.displayName} size={32} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--cam-text)] truncate">{u.displayName}</p>
                  <p className="text-[11px] text-[var(--cam-muted)]" dir="ltr">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {stickerTab === 'poll' && (
          <div className="flex flex-col gap-2.5">
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="سؤال الاستفتاء..."
              aria-label="سؤال الاستفتاء"
              className="h-11 px-3 rounded-xl bg-[var(--cam-surface-2)] text-sm text-[var(--cam-text)]"
            />
            {pollOptions.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                value={opt}
                onChange={(e) =>
                  setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                }
                placeholder={`خيار ${idx + 1}`}
                aria-label={`خيار الاستفتاء ${idx + 1}`}
                className="h-10 px-3 rounded-xl bg-[var(--cam-surface-2)] text-xs text-[var(--cam-text)]"
              />
            ))}
            <div className="flex items-center gap-2">
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((p) => [...p, `خيار ${p.length + 1}`])}
                  className="h-10 px-3 rounded-xl bg-[var(--cam-surface-2)] text-xs font-bold text-[var(--cam-text)]"
                >
                  + خيار
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onAddSticker({
                    kind: 'sticker',
                    stickerKind: 'poll',
                    text: pollQuestion || 'استفتاء',
                    pollOptions: pollOptions.filter((o) => o.trim()),
                    xPct: 50,
                    yPct: 50,
                    scale: 1,
                    rotation: 0,
                  });
                  onClose();
                }}
                className="flex-1 h-10 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
              >
                إضافة الاستفتاء
              </button>
            </div>
          </div>
        )}

        {stickerTab === 'question' && (
          <div className="flex flex-col gap-2.5">
            <input
              type="text"
              value={questionPrompt}
              onChange={(e) => setQuestionPrompt(e.target.value)}
              aria-label="نص السؤال"
              className="h-11 px-3 rounded-xl bg-[var(--cam-surface-2)] text-sm text-[var(--cam-text)]"
            />
            <button
              type="button"
              onClick={() => {
                onAddSticker({
                  kind: 'sticker',
                  stickerKind: 'question',
                  text: questionPrompt || 'اسألني أي شي!',
                  xPct: 50,
                  yPct: 50,
                  scale: 1,
                  rotation: 0,
                });
                onClose();
              }}
              className="h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
            >
              إضافة ملصق سؤال
            </button>
          </div>
        )}

        {stickerTab === 'countdown' && (
          <div className="flex flex-col gap-2.5">
            <input
              type="text"
              value={countdownTitle}
              onChange={(e) => setCountdownTitle(e.target.value)}
              aria-label="عنوان العد التنازلي"
              className="h-11 px-3 rounded-xl bg-[var(--cam-surface-2)] text-sm text-[var(--cam-text)]"
            />
            <button
              type="button"
              onClick={() => {
                onAddSticker({
                  kind: 'sticker',
                  stickerKind: 'countdown',
                  text: countdownTitle || 'عد تنازلي',
                  xPct: 50,
                  yPct: 48,
                  scale: 1,
                  rotation: 0,
                });
                onClose();
              }}
              className="h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-xs font-bold"
            >
              إضافة العد التنازلي
            </button>
          </div>
        )}
      </CreateSheetShell>

      {/* 10. Recipients Sheet (إرسال إلى...) */}
      <CreateSheetShell
        isOpen={activeSheet === 'recipients'}
        onClose={onClose}
        title="إرسال إلى..."
        testId="tw-create-sheet-recipients"
      >
        <div className="flex flex-col gap-2">
          {users
            .filter((u) => u.id !== currentUserId && u.id !== 'guest' && u.kind !== 'bot')
            .map((u) => {
              const selected = selectedRecipients.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setSelectedRecipients((prev) =>
                      prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                    )
                  }
                  className="h-12 px-3 rounded-xl bg-[var(--cam-surface-2)] flex items-center justify-between"
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar src={u.avatarUrl} name={u.displayName} size={32} />
                    <span className="text-xs font-bold text-[var(--cam-text)]">{u.displayName}</span>
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      selected
                        ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-fg)]'
                        : 'border-[var(--cam-muted)]'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          <button
            type="button"
            disabled={selectedRecipients.length === 0}
            onClick={() => {
              onPublishToRecipients(selectedRecipients);
              setSelectedRecipients([]);
              onClose();
            }}
            className="mt-1 h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] text-sm font-bold disabled:opacity-50"
          >
            مشاركة
          </button>
        </div>
      </CreateSheetShell>
    </>
  );
}
