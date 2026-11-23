import React, { useState } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  maxLength?: number;
  currentLength?: number;
  testId?: string;
}

export function TextField({
  label,
  error,
  helperText,
  maxLength,
  currentLength,
  className = '',
  testId,
  ...props
}: TextFieldProps) {
  const isNearLimit = maxLength && currentLength && currentLength >= maxLength * 0.9;
  const isAtLimit = maxLength && currentLength && currentLength >= maxLength;

  return (
    <div className="w-full flex flex-col gap-1.5" data-testid={testId}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-[var(--text)]">{label}</label>
          {maxLength && (
            <span
              className={`text-xs ${
                isAtLimit
                  ? 'text-[var(--danger)] font-bold'
                  : isNearLimit
                  ? 'text-[var(--warning)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {currentLength ?? 0} / {maxLength}
            </span>
          )}
        </div>
      )}

      <input
        className={`w-full h-12 px-4 rounded-xl text-base bg-[var(--surface)] text-[var(--text)] border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent disabled:opacity-40 ${
          error ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]'
        } ${className}`}
        {...props}
      />

      {error ? (
        <span className="text-xs text-[var(--danger)] font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-[var(--text-muted)]">{helperText}</span>
      ) : null}
    </div>
  );
}

export function PasswordField({
  label = 'كلمة المرور',
  value = '',
  onChange,
  error,
  testId,
  ...props
}: TextFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const passwordStr = String(value);

  // Strength score: 0 to 4
  let score = 0;
  if (passwordStr.length >= 8) score++;
  if (/[0-9]/.test(passwordStr)) score++;
  if (/[a-z]/.test(passwordStr) && /[A-Z]/.test(passwordStr)) score++;
  if (/[^A-Za-z0-9]/.test(passwordStr)) score++;

  return (
    <div className="w-full flex flex-col gap-1.5" data-testid={testId}>
      <label className="text-sm font-semibold text-[var(--text)]">{label}</label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className={`w-full h-12 ps-4 pe-12 rounded-xl text-base bg-[var(--surface)] text-[var(--text)] border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
            error ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]'
          }`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute inset-y-0 end-0 px-3.5 flex items-center text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none"
          aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Strength indicator */}
      {passwordStr.length > 0 && (
        <div className="flex gap-1.5 mt-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors ${
                score >= step
                  ? score <= 1
                    ? 'bg-[var(--danger)]'
                    : score <= 2
                    ? 'bg-[var(--warning)]'
                    : 'bg-[var(--success)]'
                  : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      )}

      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}

export function SearchField({
  value,
  defaultValue = '',
  onChange,
  onClear,
  onKeyDown,
  placeholder = 'بحث...',
  className = '',
  testId,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  testId?: string;
}) {
  const [internalVal, setInternalVal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const currentVal = isControlled ? value : internalVal;

  return (
    <div className={`relative flex items-center ${className}`} data-testid={testId}>
      <Search className="absolute start-3.5 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
      <input
        type="search"
        value={currentVal}
        onChange={(e) => {
          if (!isControlled) setInternalVal(e.target.value);
          onChange?.(e);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full h-10 ps-10 pe-9 rounded-full bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:text-[var(--text-muted)] [&::-webkit-search-cancel-button]:hidden"
      />
      {currentVal && (
        <button
          type="button"
          onClick={() => {
            if (!isControlled) setInternalVal('');
            onClear?.();
          }}
          className="absolute end-2.5 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text)]"
          aria-label="مسح البحث"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  testId,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label
      data-testid={testId}
      className={`flex items-center justify-between gap-4 py-2.5 select-none group ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="flex flex-col">
        {label && <span className="text-sm font-semibold text-[var(--text)]">{label}</span>}
        {description && <span className="text-xs text-[var(--text-muted)]">{description}</span>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!checked);
        }}
        className={`relative inline-flex h-8 w-13 shrink-0 rounded-full border-2 transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed ${
          checked
            ? 'bg-[var(--primary)] border-[var(--primary)]'
            : 'bg-[var(--surface-2)] border-[var(--border-strong)]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-7 w-7 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
            checked
              ? 'bg-[var(--primary-fg)] -translate-x-5'
              : 'bg-[var(--border-strong)] translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex h-10 p-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-strong)] gap-1 ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${
              isSelected
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
