import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  testId?: string;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

let openModalCount = 0;

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  testId,
  className = '',
  overlayClassName = '',
  contentClassName = '',
  onKeyDown,
  initialFocusRef,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    openModalCount += 1;
    previousActiveElement.current = document.activeElement as HTMLElement | null;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Set inert on #root (which sits behind the body portal)
    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.setAttribute('inert', '');
    }

    // Set initial focus inside dialog
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0]?.focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 20);

    // Global Keydown handler for Escape & Tab focus trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = originalOverflow;
        if (rootEl) {
          rootEl.removeAttribute('inert');
        }
      }
      if (
        previousActiveElement.current &&
        typeof previousActiveElement.current.focus === 'function'
      ) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-description={description}
      data-testid={testId}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 ${className}`}
      onKeyDown={onKeyDown}
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-[var(--overlay)] backdrop-blur-xs transition-opacity ${overlayClassName}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content Container */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-3xl outline-none ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
