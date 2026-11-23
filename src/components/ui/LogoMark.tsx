import React from 'react';

export interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 32, className = '' }: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <path id="wedge-mark" d="M-5.5 -19 L5.5 -19 L1.6 -9.5 L1.6 -2 L-1.6 -2 L-1.6 -9.5 Z" />
      </defs>
      <g transform="translate(24 25)">
        <use href="#wedge-mark" fill="var(--primary)" />
        <use href="#wedge-mark" fill="var(--primary)" transform="rotate(120)" />
        <use href="#wedge-mark" fill="var(--accent)" transform="rotate(240)" />
      </g>
    </svg>
  );
}
