import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface CameraToolItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  customIcon?: React.ReactNode;
  active: boolean;
  badge?: string;
  onClick: () => void;
}

interface CameraToolColumnProps {
  mode: 'story' | 'reel';
  tools: CameraToolItem[];
  toolsExpanded: boolean;
  onToggleExpand: () => void;
}

export function CameraToolColumn({
  mode,
  tools,
  toolsExpanded,
  onToggleExpand,
}: CameraToolColumnProps) {
  return (
    <div
      data-testid="tw-create-tool-column"
      className={`absolute start-[10px] z-30 flex flex-col gap-[1px] transition-all duration-[180ms] motion-reduce:transition-none ${
        mode === 'story' && !toolsExpanded ? 'top-[374px]' : 'top-[256px]'
      }`}
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            type="button"
            data-testid={`tw-tool-${tool.id}`}
            onClick={tool.onClick}
            aria-label={tool.label}
            className="h-[44px] ps-[6px] pe-3 flex items-center gap-[13px] text-[var(--cam-text)] active:scale-95 transition-transform motion-reduce:transition-none"
          >
            <span className="relative w-[32px] h-[32px] flex items-center justify-center shrink-0">
              {Icon ? (
                <Icon className="w-[30px] h-[30px] stroke-[1.75] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
              ) : (
                tool.customIcon
              )}
              {tool.active && (
                <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--cam-bg)]" />
              )}
            </span>

            <span className="text-[15px] font-semibold leading-none [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
              {tool.label}
            </span>

            {tool.badge && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] text-[10px] font-bold leading-none">
                {tool.badge}
              </span>
            )}
          </button>
        );
      })}

      {mode === 'story' && (
        <button
          type="button"
          data-testid="tw-story-tools-chevron"
          aria-label={toolsExpanded ? 'طي الأدوات' : 'المزيد من الأدوات'}
          onClick={onToggleExpand}
          className="h-[44px] w-[44px] flex items-center justify-center text-[var(--cam-text)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
        >
          <ChevronDown
            className={`w-6 h-6 transition-transform duration-[180ms] motion-reduce:transition-none ${
              toolsExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}
    </div>
  );
}
