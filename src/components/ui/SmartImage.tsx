import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { resolveMediaUrl } from '../../lib/runtimeUrl';

export interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  aspectRatio?: string;
  fallbackText?: string;
  containerClassName?: string;
}

export function SmartImage({
  src,
  alt = '',
  aspectRatio,
  className = '',
  containerClassName = '',
  fallbackText,
  loading = 'lazy',
  decoding = 'async',
  ...rest
}: SmartImageProps) {
  const resolvedSrc = resolveMediaUrl(src);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [resolvedSrc]);

  const hasPositionClass = /\b(absolute|fixed|sticky|relative|static)\b/.test(containerClassName);
  const isUnreachableBlob =
    Boolean(resolvedSrc && resolvedSrc.startsWith('blob:')) &&
    (typeof window === 'undefined' || !resolvedSrc!.startsWith(`blob:${window.location.origin}`));

  return (
    <div
      className={`${hasPositionClass ? '' : 'relative '}overflow-hidden bg-[var(--surface-2)] flex items-center justify-center ${containerClassName}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {!isLoaded && !hasError && !isUnreachableBlob && (
        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--surface-2)] via-[var(--surface)] to-[var(--surface-2)] animate-pulse" />
      )}

      {hasError || !resolvedSrc || isUnreachableBlob ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-[var(--text-muted)] bg-[var(--surface-2)] select-none">
          <ImageIcon className="w-8 h-8 stroke-[1.5] text-[var(--primary)]/60 mb-1" />
          {fallbackText && <span className="text-[11px] font-medium text-center">{fallbackText}</span>}
        </div>
      ) : (
        <img
          src={resolvedSrc}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onError={() => setHasError(true)}
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          {...rest}
        />
      )}
    </div>
  );
}
