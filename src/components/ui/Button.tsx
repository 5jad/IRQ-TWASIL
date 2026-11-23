import React from 'react';
import { Loader2, Check } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'primary-lg'
  | 'primary-sm'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'copper'
  | 'icon'
  | 'overlay-icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  testId?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      isLoading = false,
      icon,
      children,
      className = '',
      disabled,
      testId,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none select-none';

    let variantStyles = '';

    switch (variant) {
      case 'primary-lg':
        variantStyles =
          'h-14 px-6 text-base font-semibold rounded-2xl bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm hover:brightness-105';
        break;
      case 'primary-sm':
        variantStyles =
          'h-9 px-4 text-xs font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm hover:brightness-105';
        break;
      case 'primary':
        variantStyles =
          'h-12 px-5 text-sm font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm hover:brightness-105';
        break;
      case 'secondary':
        variantStyles =
          'h-12 px-5 text-sm font-semibold rounded-xl bg-[var(--surface-2)] text-[var(--text)] hover:brightness-95';
        break;
      case 'outline':
        variantStyles =
          'h-12 px-5 text-sm font-semibold rounded-xl border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]';
        break;
      case 'ghost':
        variantStyles =
          'h-12 px-3 text-sm font-semibold rounded-xl bg-transparent text-[var(--primary-text)] hover:bg-[var(--primary-tint)]';
        break;
      case 'danger':
        variantStyles =
          'h-12 px-5 text-sm font-semibold rounded-xl bg-[var(--danger)] text-[var(--danger-fg)] hover:brightness-105';
        break;
      case 'copper':
        variantStyles =
          'h-12 px-5 text-sm font-semibold rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-105 shadow-sm';
        break;
      case 'icon':
        variantStyles =
          'min-h-[44px] min-w-[44px] p-2 rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)]';
        break;
      case 'overlay-icon':
        variantStyles =
          'min-h-[44px] min-w-[44px] p-2 rounded-full bg-[var(--overlay)] text-white backdrop-blur-md hover:bg-black/70';
        break;
    }

    return (
      <button
        ref={ref}
        data-testid={testId}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {icon && <span className="ms-1.5 shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface FollowButtonProps {
  isFollowing: boolean;
  onToggle: () => void;
  className?: string;
  testId?: string;
}

export function FollowButton({ isFollowing, onToggle, className = '', testId }: FollowButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onToggle}
      className={`min-h-[36px] min-w-[88px] px-3.5 text-xs font-semibold rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 ${
        isFollowing
          ? 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--danger-tint)] hover:text-[var(--danger)]'
          : 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm hover:brightness-105'
      } ${className}`}
    >
      {isFollowing ? (
        <>
          <Check className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>يتابعه</span>
        </>
      ) : (
        <span>متابعة</span>
      )}
    </button>
  );
}
