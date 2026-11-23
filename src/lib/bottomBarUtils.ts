import type { Handedness } from '../types';

export const BOTTOM_BAR_DRAG_THRESHOLD_PX = 8;
export const BOTTOM_BAR_SNAP_DISTANCE_PX = 20;
export const BOTTOM_BAR_FULL_SPAN_DISTANCE_PX = 64;
export const BOTTOM_BAR_QUICK_FLICK_DISTANCE_PX = 14;
export const BOTTOM_BAR_QUICK_FLICK_VELOCITY = 0.45;
export const BOTTOM_BAR_EDGE_PADDING_PX = 12;
export const BOTTOM_BAR_MAX_WIDTH_PX = 304;

export function resolveBottomBarDrop(
  current: Handedness,
  deltaX: number,
  durationMs: number
): Handedness {
  const absDx = Math.abs(deltaX);
  const velocity = absDx / Math.max(16, durationMs);
  const meetsDistance = absDx >= BOTTOM_BAR_SNAP_DISTANCE_PX;
  const meetsQuickFlick =
    absDx >= BOTTOM_BAR_QUICK_FLICK_DISTANCE_PX &&
    velocity >= BOTTOM_BAR_QUICK_FLICK_VELOCITY;

  if (!meetsDistance && !meetsQuickFlick) {
    return current;
  }

  const jumpFull = absDx >= BOTTOM_BAR_FULL_SPAN_DISTANCE_PX || velocity >= 0.65;

  if (deltaX > 0) {
    if (current === 'center' || current === 'right') return 'right';
    return jumpFull ? 'right' : 'center';
  }

  if (current === 'center' || current === 'left') return 'left';
  return jumpFull ? 'left' : 'center';
}

export function getBottomBarWidth(viewportWidth: number): number {
  return Math.max(
    240,
    Math.min(BOTTOM_BAR_MAX_WIDTH_PX, viewportWidth - BOTTOM_BAR_EDGE_PADDING_PX * 2)
  );
}

export function getBottomBarWidthCss(): string {
  return `min(${BOTTOM_BAR_MAX_WIDTH_PX}px, calc(100% - ${BOTTOM_BAR_EDGE_PADDING_PX * 2}px))`;
}

export function getBottomBarAnchorLeft(
  handedness: Handedness,
  viewportWidth: number,
  barWidth: number,
  edgePadding = BOTTOM_BAR_EDGE_PADDING_PX
): number {
  const minLeft = edgePadding;
  const maxLeft = Math.max(edgePadding, viewportWidth - edgePadding - barWidth);
  if (handedness === 'left') return minLeft;
  if (handedness === 'right') return maxLeft;
  return (minLeft + maxLeft) / 2;
}

export function clampBottomBarDragOffset(
  deltaX: number,
  current: Handedness,
  viewportWidth: number,
  barWidth: number,
  edgePadding = BOTTOM_BAR_EDGE_PADDING_PX
): number {
  const minLeft = edgePadding;
  const maxLeft = Math.max(edgePadding, viewportWidth - edgePadding - barWidth);
  const currentLeft = getBottomBarAnchorLeft(current, viewportWidth, barWidth, edgePadding);
  const minOffset = minLeft - currentLeft;
  const maxOffset = maxLeft - currentLeft;
  const rubberMax = 16;

  if (deltaX < minOffset) {
    const excess = deltaX - minOffset;
    return minOffset + Math.max(-rubberMax, excess * 0.35);
  }
  if (deltaX > maxOffset) {
    const excess = deltaX - maxOffset;
    return maxOffset + Math.min(rubberMax, excess * 0.35);
  }
  return deltaX;
}

export function getBottomBarLeftCss(handedness: Handedness): string {
  const widthExpr = getBottomBarWidthCss();
  if (handedness === 'left') {
    return `${BOTTOM_BAR_EDGE_PADDING_PX}px`;
  }
  if (handedness === 'right') {
    return `calc(100% - ${BOTTOM_BAR_EDGE_PADDING_PX}px - ${widthExpr})`;
  }
  return `calc(50% - ${widthExpr} / 2)`;
}
