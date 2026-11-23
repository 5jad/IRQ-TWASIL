import React from 'react';

export function HeritageSvg({
  motifId,
  className = 'w-8 h-8',
}: {
  motifId: string;
  className?: string;
}) {
  switch (motifId) {
    case 'cuneiform':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M8 9L14 14L8 19V9Z" fill="currentColor" />
          <path d="M13 14H28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M15 21L21 26L15 31V21Z" fill="currentColor" />
          <path d="M20 26H29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'palm':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M18 32V15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M18 15C13 11 8 12 6 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M18 15C23 11 28 12 30 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M18 15C13 8 10 6 8 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M18 15C23 8 26 6 28 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M18 15C18 9 18 6 18 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'date':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <ellipse cx="18" cy="19" rx="7" ry="11" stroke="currentColor" strokeWidth="2.4" />
          <path d="M18 8V5M18 12V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'ishtar-arch':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M6 31V10H11V7H15V10H21V7H25V10H30V31" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M13 31V21C13 18.2 15.2 16 18 16C20.8 16 23 18.2 23 21V31" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      );
    case 'malwiya':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M8 31H28L25 25H11L13 19H23L21 13H15L17 6H19" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'wheel':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="18" cy="18" r="3" fill="currentColor" />
          <path d="M18 6V30M6 18H30M9.5 9.5L26.5 26.5M26.5 9.5L9.5 26.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'dallah':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M13 13C13 9 23 9 23 13L25 26C25 28.5 22 30 18 30C14 30 11 28.5 11 26L13 13Z" stroke="currentColor" strokeWidth="2.2" />
          <path d="M12 16L6 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 15C28 15 29 22 25 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M18 9V5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'cup':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M9 13H27L24 27C23.5 29 21 30 18 30C15 30 12.5 29 12 27L9 13Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M14 9C14 7 16 6 16 4M20 9C20 7 22 6 22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'boat':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M5 21C9 27 27 27 31 21L27 27H9L5 21Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M18 11V21M18 11L25 18H18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case 'dome':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M18 6V9M8 23C8 15 12 10 18 9C24 10 28 15 28 23V30H8V23Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M15 30V24C15 22.3 16.3 21 18 21C19.7 21 21 22.3 21 24V30" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'wave':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M4 14C8 10 12 10 16 14C20 18 24 18 32 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M4 22C8 18 12 18 16 22C20 26 24 26 32 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    default: // star (Mesopotamian 8-point star)
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M18 4L21 15L32 18L21 21L18 32L15 21L4 18L15 15L18 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 9L16 16M27 9L20 16M27 27L20 20M9 27L16 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}
