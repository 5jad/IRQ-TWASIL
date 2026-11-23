import React, { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { resolveMediaUrl } from '../../lib/runtimeUrl';

export type AvatarSize = number;

export interface AvatarProps {
  src?: string;
  name: string;
  size?: AvatarSize;
  className?: string;
  hasStory?: boolean;
  hasUnseenStory?: boolean;
  isMerchant?: boolean;
  isCloseFriend?: boolean;
  isOwnStoryEmpty?: boolean;
  isOnline?: boolean;
  isVerified?: boolean;
  verifiedKind?: 'none' | 'identity' | 'merchant' | 'official';
  onClick?: () => void;
  testId?: string;
  shape?: 'circle' | 'squircle';
}

const TINT_COLORS = [
  'bg-teal-100 text-teal-900',
  'bg-amber-100 text-amber-900',
  'bg-indigo-100 text-indigo-900',
  'bg-emerald-100 text-emerald-900',
  'bg-rose-100 text-rose-900',
  'bg-purple-100 text-purple-900',
  'bg-cyan-100 text-cyan-900',
  'bg-orange-100 text-orange-900',
];

export function Avatar({
  src,
  name,
  size = 40,
  className = '',
  hasStory = false,
  hasUnseenStory = false,
  isMerchant = false,
  isCloseFriend = false,
  isOwnStoryEmpty = false,
  isOnline = false,
  isVerified = false,
  verifiedKind = 'identity',
  onClick,
  testId,
  shape = 'circle',
}: AvatarProps) {
  const resolvedSrc = resolveMediaUrl(src);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedSrc]);

  // Deterministic fallback initial
  const initial = name ? name.trim().charAt(0).toUpperCase() : '؟';
  const colorIndex = Math.abs(
    name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % TINT_COLORS.length;
  const fallbackClass = TINT_COLORS[colorIndex] ?? 'bg-slate-200 text-slate-800';

  // Ring styling
  let ringClasses = '';
  if (hasStory) {
    if (isOwnStoryEmpty) {
      ringClasses = 'border-2 border-dashed border-[var(--border-strong)] p-[3px]';
    } else if (hasUnseenStory) {
      if (isMerchant) {
        ringClasses = 'border-[2.5px] border-[var(--accent)] p-[3px]';
      } else if (isCloseFriend) {
        ringClasses = 'border-[2.5px] border-[var(--success)] p-[3px]';
      } else {
        ringClasses = 'border-[2.5px] border-[var(--primary)] p-[3px]';
      }
    } else {
      ringClasses = 'border-[2.5px] border-[var(--border)] p-[3px]';
    }
  }

  const dimStyle = { width: `${size}px`, height: `${size}px` };

  const shapeRadius = shape === 'squircle' ? 'rounded-2xl' : 'rounded-full';

  return (
    <div
      data-testid={testId}
      onClick={onClick}
      className={`relative inline-flex shrink-0 items-center justify-center ${shapeRadius} ${ringClasses} ${
        onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''
      } ${className}`}
    >
      <div
        style={dimStyle}
        className={`relative overflow-hidden ${shapeRadius} bg-[var(--surface-2)] flex items-center justify-center select-none`}
      >
        {resolvedSrc && !imageFailed ? (
          <img
            src={resolvedSrc}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className={`w-full h-full flex items-center justify-center font-bold ${fallbackClass}`} style={{ fontSize: `${Math.round(size * 0.4)}px` }}>
            {initial}
          </span>
        )}
      </div>

      {/* Online Dot */}
      {isOnline && (
        <span
          className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-[var(--success)] ring-2 ring-[var(--surface)]"
          aria-label="متصل الآن"
        />
      )}

      {/* Own Empty Story Plus Badge */}
      {isOwnStoryEmpty && (
        <span className="absolute bottom-0 end-0 w-5 h-5 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] ring-2 ring-[var(--bg)] flex items-center justify-center shadow-xs">
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
        </span>
      )}

      {/* Verified Mark for Large Avatars */}
      {isVerified && size >= 72 && (
        <span
          className={`absolute bottom-1 end-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-[var(--surface)] ${
            verifiedKind === 'merchant'
              ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
              : 'bg-[var(--primary)] text-[var(--primary-fg)]'
          }`}
          aria-label={verifiedKind === 'merchant' ? 'متجر موثّق' : 'حساب موثّق'}
        >
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      )}
    </div>
  );
}

export function VerifiedBadge({
  kind = 'identity',
  size = 16,
  className = '',
}: {
  kind?: 'none' | 'identity' | 'merchant' | 'official';
  size?: number;
  className?: string;
}) {
  if (kind === 'none') return null;

  const isMerchant = kind === 'merchant';
  const bgColor = isMerchant ? 'bg-[var(--accent)]' : 'bg-[var(--primary)]';
  const textColor = isMerchant ? 'text-[var(--accent-fg)]' : 'text-[var(--primary-fg)]';
  const title = isMerchant ? 'متجر موثّق' : 'حساب موثّق';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${textColor} ${bgColor} ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      title={title}
      aria-label={title}
    >
      <Check className="stroke-[3]" style={{ width: `${Math.round(size * 0.65)}px`, height: `${Math.round(size * 0.65)}px` }} />
    </span>
  );
}
