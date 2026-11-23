import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBottomBarDragOffset,
  getBottomBarAnchorLeft,
  getBottomBarLeftCss,
  getBottomBarWidth,
  getBottomBarWidthCss,
  resolveBottomBarDrop,
} from './bottomBarUtils';

test('tiny movements below threshold keep current handedness', () => {
  assert.equal(resolveBottomBarDrop('center', 6, 200), 'center');
  assert.equal(resolveBottomBarDrop('right', -10, 250), 'right');
  assert.equal(resolveBottomBarDrop('left', 12, 300), 'left');
});

test('dragging right from center snaps directly to right hand', () => {
  assert.equal(resolveBottomBarDrop('center', 28, 180), 'right');
});

test('dragging left from center snaps directly to left hand', () => {
  assert.equal(resolveBottomBarDrop('center', -28, 180), 'left');
});

test('dragging across from left to right steps to center on short swipe and right on long swipe', () => {
  assert.equal(resolveBottomBarDrop('left', 32, 240), 'center');
  assert.equal(resolveBottomBarDrop('left', 75, 240), 'right');
  assert.equal(resolveBottomBarDrop('left', 18, 22), 'right'); // fast flick
});

test('dragging across from right to left steps to center on short swipe and left on long swipe', () => {
  assert.equal(resolveBottomBarDrop('right', -32, 240), 'center');
  assert.equal(resolveBottomBarDrop('right', -75, 240), 'left');
  assert.equal(resolveBottomBarDrop('right', -18, 22), 'left'); // fast flick
});

test('anchor calculation leaves meaningful horizontal separation on 360px and 390px screens', () => {
  const w390 = getBottomBarWidth(390);
  assert.equal(w390, 304);
  const left390 = getBottomBarAnchorLeft('left', 390, w390);
  const center390 = getBottomBarAnchorLeft('center', 390, w390);
  const right390 = getBottomBarAnchorLeft('right', 390, w390);
  assert.equal(left390, 12);
  assert.equal(center390, 43);
  assert.equal(right390, 74);

  const w360 = getBottomBarWidth(360);
  assert.equal(w360, 304);
  assert.equal(getBottomBarAnchorLeft('left', 360, w360), 12);
  assert.equal(getBottomBarAnchorLeft('right', 360, w360), 44);
});

test('drag clamping rubber-bands gently past edges', () => {
  const barW = getBottomBarWidth(390);
  const clampedRightFromCenter = clampBottomBarDragOffset(100, 'center', 390, barW);
  // maxOffset is 74 - 43 = 31; rubber-band caps within 31..47
  assert.ok(clampedRightFromCenter > 31 && clampedRightFromCenter <= 47);
});

test('CSS width and left formulas use container % instead of vw to prevent route/scrollbar drift', () => {
  const widthCss = getBottomBarWidthCss();
  assert.ok(!widthCss.includes('vw'));
  assert.ok(widthCss.includes('100%'));

  for (const handedness of ['left', 'center', 'right'] as const) {
    const leftCss = getBottomBarLeftCss(handedness);
    assert.ok(!leftCss.includes('vw'), `${handedness} CSS must not use vw: ${leftCss}`);
  }
  assert.equal(getBottomBarLeftCss('left'), '12px');
  assert.ok(getBottomBarLeftCss('center').startsWith('calc(50% - '));
  assert.ok(getBottomBarLeftCss('right').startsWith('calc(100% - 12px - '));
});
