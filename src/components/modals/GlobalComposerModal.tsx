import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Image, MapPin, Smile, Globe, Users, Lock } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { LIMITS } from '../../lib/limits';
import { Modal } from '../ui/Modal';
import { isVideoSource } from '../../lib/apiHelpers';
import { SmartImage } from '../ui/SmartImage';

const COMPOSER_LOCATIONS = [
  'بغداد - الكرادة',
  'بغداد - المنصور',
  'البصرة - العشار',
  'أربيل - عينكاوة',
  'النجف الأشرف',
  'كربلاء المقدسة',
  'الموصل',
];

const COMPOSER_EMOJIS = ['🇮🇶', '✨', '☕', '❤️', '🔥', '👏', '😂', '🙏', '🎉', '🌿'];

export function PostComposerPanel({
  onCancel,
  onPublished,
  fullScreen = false,
}: {
  onCancel: () => void;
  onPublished: () => void;
  fullScreen?: boolean;
}) {
  const { currentUser, createPost, requireAuthForWrite } = useApp();
  const [text, setText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<{ url: string; file: File }[]>([]);
  const [audience, setAudience] = useState<'everyone' | 'followers' | 'friends'>('everyone');
  const [location, setLocation] = useState<string>('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const mediaFilesRef = useRef(mediaFiles);
  mediaFilesRef.current = mediaFiles;

  useEffect(() => {
    return () => {
      for (const item of mediaFilesRef.current) {
        if (item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      }
    };
  }, []);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    setMediaFiles((prev) => {
      const remaining = Math.max(0, 10 - prev.length);
      const next = picked.slice(0, remaining).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  };

  const removeMediaAt = (idx: number) => {
    setMediaFiles((prev) => {
      const target = prev[idx];
      if (target?.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const clearAllMedia = () => {
    for (const item of mediaFiles) {
      if (item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    }
    setMediaFiles([]);
  };

  const cycleAudience = () => {
    setAudience((prev) =>
      prev === 'everyone' ? 'followers' : prev === 'followers' ? 'friends' : 'everyone'
    );
  };

  const handlePublish = async () => {
    if ((!text.trim() && mediaFiles.length === 0) || isPublishing) return;
    if (!requireAuthForWrite()) return;
    setIsPublishing(true);
    try {
      const files = mediaFiles.map((m) => m.file);
      const ok = await createPost(
        text.trim(),
        files.length > 0 ? files : undefined,
        {
          ...(location ? { location } : {}),
          audience,
        }
      );
      if (ok) {
        setText('');
        setLocation('');
        clearAllMedia();
        onPublished();
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      className={`w-full bg-[var(--surface)] text-[var(--text)] ${
        fullScreen
          ? 'h-full flex-1 p-4 flex flex-col gap-4'
          : 'sm:rounded-3xl rounded-t-3xl border border-[var(--border)] p-4 flex flex-col gap-4 shadow-2xl'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="إلغاء"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-base font-bold text-[var(--text)]">إنشاء منشور جديد</h2>

        <button
          type="button"
          disabled={(!text.trim() && mediaFiles.length === 0) || isPublishing}
          onClick={() => void handlePublish()}
          className="px-4 py-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] font-semibold text-xs shadow-xs hover:brightness-105 disabled:opacity-40 min-h-[36px]"
        >
          {isPublishing ? 'جاري النشر...' : 'نشر'}
        </button>
      </div>

      {/* User Line & Audience Selector */}
      <div className="flex items-center gap-3">
        <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={42} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-[var(--text)]">{currentUser.displayName}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={cycleAudience}
              className="flex items-center gap-1 text-[11px] font-semibold text-[var(--primary-text)] bg-[var(--primary-tint)] px-2.5 py-0.5 rounded-full w-fit hover:brightness-95"
            >
              {audience === 'everyone' ? (
                <Globe className="w-3 h-3" />
              ) : audience === 'followers' ? (
                <Users className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              <span>
                {audience === 'everyone'
                  ? 'الجميع (عام)'
                  : audience === 'followers'
                  ? 'المتابعون فقط'
                  : 'الأصدقاء المقربون'}
              </span>
            </button>

            {location && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                <MapPin className="w-3 h-3" />
                <span>{location}</span>
                <button
                  type="button"
                  onClick={() => setLocation('')}
                  aria-label="إزالة الموقع"
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Text Input */}
      <textarea
        rows={fullScreen ? 7 : 4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={LIMITS.POST_TEXT_MAX_LENGTH}
        placeholder="شارك فكرة، قصة، أو تفاصيل من يومياتك في العراق..."
        className="w-full bg-transparent text-[var(--text)] text-base placeholder:text-[var(--text-muted)] border-none focus:outline-none resize-none leading-relaxed"
      />

      {/* Media Preview Grid */}
      {mediaFiles.length > 0 && (
        <div className={`grid gap-2 ${mediaFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {mediaFiles.map((item, idx) => (
            <div key={item.url} className="relative rounded-2xl overflow-hidden border border-[var(--border)]">
              {isVideoSource(item.file) ? (
                <video src={item.url} controls className="w-full h-44 object-cover bg-black" />
              ) : (
                <SmartImage src={item.url} alt={`وسائط ${idx + 1}`} containerClassName="w-full h-44" />
              )}
              <button
                type="button"
                onClick={() => removeMediaAt(idx)}
                className="absolute top-2 end-2 p-1.5 rounded-full bg-[var(--overlay)] text-white"
                aria-label="إزالة الوسيط"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Location Picker Popover */}
      {showLocationPicker && (
        <div className="p-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-wrap gap-1.5">
          {COMPOSER_LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => {
                setLocation(loc);
                setShowLocationPicker(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                location === loc
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]'
                  : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="p-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center flex-wrap gap-1.5">
          {COMPOSER_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setText((prev) => `${prev}${em}`)}
              className="w-8 h-8 rounded-lg hover:bg-[var(--surface)] text-base flex items-center justify-center active:scale-90"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex items-center justify-between text-[var(--text-muted)] mt-auto pt-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-1">
          <label
            className="p-2 rounded-xl hover:bg-[var(--surface-2)] text-[var(--primary)] cursor-pointer"
            aria-label="إضافة صور أو فيديو"
          >
            <Image className="w-5 h-5" />
            <input
              type="file"
              multiple
              accept="image/*,video/mp4,video/webm,video/quicktime"
              onChange={handleFilePick}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setShowLocationPicker((v) => !v);
              setShowEmojiPicker(false);
            }}
            className={`p-2 rounded-xl hover:bg-[var(--surface-2)] ${
              location || showLocationPicker ? 'text-[var(--primary)]' : ''
            }`}
            aria-label="الموقع"
          >
            <MapPin className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker((v) => !v);
              setShowLocationPicker(false);
            }}
            className={`p-2 rounded-xl hover:bg-[var(--surface-2)] ${
              showEmojiPicker ? 'text-[var(--primary)]' : ''
            }`}
            aria-label="رموز تعبيرية"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        <span className="text-xs text-[var(--text-muted)]">
          {text.length} / {LIMITS.POST_TEXT_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}

export function GlobalComposerModal() {
  const { isComposerOpen, setIsComposerOpen } = useApp();

  return (
    <Modal
      isOpen={isComposerOpen}
      onClose={() => setIsComposerOpen(false)}
      title="إنشاء منشور جديد"
      testId="tw-composer-modal"
      className="items-end sm:items-center"
      contentClassName="max-w-lg"
    >
      <PostComposerPanel
        onCancel={() => setIsComposerOpen(false)}
        onPublished={() => setIsComposerOpen(false)}
      />
    </Modal>
  );
}
