import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCropDragDelta,
  attachBlobCropSpec,
  clampZoom,
  computeCropLayout,
  computeServerCropSpec,
  consumeBlobCropSpec,
  detectImageFormat,
  MAX_CROP_ZOOM,
  MIN_CROP_ZOOM,
} from './cropUtils.ts';

test('computeCropLayout covers square crop for landscape image and allows horizontal pan', () => {
  // 1600x800 (2:1) image inside 300x300 box
  const layout = computeCropLayout({
    naturalWidth: 1600,
    naturalHeight: 800,
    boxWidth: 300,
    boxHeight: 300,
    zoom: 1,
    panX: 0,
    panY: 0,
    fitMode: 'cover',
  });

  assert.equal(layout.renderHeight, 300);
  assert.equal(layout.renderWidth, 600);
  assert.equal(layout.drawX, -150);
  assert.equal(layout.drawY, 0);
  assert.equal(layout.maxPanX, 0.5);
  assert.equal(layout.maxPanY, 0);
});

test('computeCropLayout clamps over-panned coordinates strictly to image edges', () => {
  const layout = computeCropLayout({
    naturalWidth: 1600,
    naturalHeight: 800,
    boxWidth: 300,
    boxHeight: 300,
    zoom: 1,
    panX: 2.5,
    panY: -1.5,
    fitMode: 'cover',
  });

  assert.equal(layout.clampedPanX, 0.5);
  assert.equal(layout.clampedPanY, 0);
  // Left edge aligned to 0 when shifted maximally right
  assert.equal(layout.drawX, 0);
  assert.equal(layout.drawY, 0);
});

test('computeCropLayout maps normalized pan identically between preview box and export canvas', () => {
  const preview = computeCropLayout({
    naturalWidth: 1200,
    naturalHeight: 1600,
    boxWidth: 320,
    boxHeight: 320,
    zoom: 1.5,
    panX: -0.2,
    panY: 0.35,
    fitMode: 'cover',
  });

  const exportCanvas = computeCropLayout({
    naturalWidth: 1200,
    naturalHeight: 1600,
    boxWidth: 1024,
    boxHeight: 1024,
    zoom: 1.5,
    panX: preview.clampedPanX,
    panY: preview.clampedPanY,
    fitMode: 'cover',
  });

  assert.ok(Math.abs(exportCanvas.drawX / 1024 - preview.drawX / 320) < 1e-9);
  assert.ok(Math.abs(exportCanvas.drawY / 1024 - preview.drawY / 320) < 1e-9);
  assert.ok(Math.abs(exportCanvas.renderWidth / 1024 - preview.renderWidth / 320) < 1e-9);
  assert.ok(Math.abs(exportCanvas.renderHeight / 1024 - preview.renderHeight / 320) < 1e-9);
});

test('computeCropLayout in contain mode fits entire image inside 3:1 cover frame without cutting edges', () => {
  // Portrait 600x900 inside 600x200 banner
  const layout = computeCropLayout({
    naturalWidth: 600,
    naturalHeight: 900,
    boxWidth: 600,
    boxHeight: 200,
    zoom: 1,
    panX: 0.5,
    panY: 0.5,
    fitMode: 'contain',
  });

  assert.ok(layout.renderHeight <= 200.0001);
  assert.ok(layout.renderWidth <= 600.0001);
  assert.equal(layout.clampedPanX, 0);
  assert.equal(layout.clampedPanY, 0);
});

test('applyCropDragDelta translates pointer pixels into clamped normalized pan', () => {
  const moved = applyCropDragDelta({
    panX: 0,
    panY: 0,
    deltaX: -60,
    deltaY: 999,
    naturalWidth: 1600,
    naturalHeight: 800,
    boxWidth: 300,
    boxHeight: 300,
    zoom: 1,
    fitMode: 'cover',
  });

  assert.ok(Math.abs(moved.panX - -0.2) < 1e-9);
  assert.equal(moved.panY, 0);
});

test('clampZoom keeps zoom inside valid bounds', () => {
  assert.equal(clampZoom(0.2), MIN_CROP_ZOOM);
  assert.equal(clampZoom(5), MAX_CROP_ZOOM);
  assert.equal(clampZoom(Number.NaN), MIN_CROP_ZOOM);
  assert.equal(clampZoom(1.75), 1.75);
});

test('detectImageFormat distinguishes png, gif, webp, and jpeg via mime or extension', () => {
  assert.equal(detectImageFormat('image/png', 'photo.jpg'), 'png');
  assert.equal(detectImageFormat('image/gif', 'anim.bin'), 'gif');
  assert.equal(detectImageFormat('', 'sticker.PNG'), 'png');
  assert.equal(detectImageFormat('application/octet-stream', 'avatar.GIF'), 'gif');
  assert.equal(detectImageFormat('image/webp', 'pic.webp'), 'webp');
  assert.equal(detectImageFormat('image/jpeg', 'pic.jpg'), 'jpeg');
});

test('computeServerCropSpec produces exact natural crop for cover and letterboxed placement for contain', () => {
  // 800x400 GIF panned fully right-aligned (panX = -0.5 shows right half [400..800])
  const coverSpec = computeServerCropSpec({
    naturalWidth: 800,
    naturalHeight: 400,
    boxWidth: 300,
    boxHeight: 300,
    zoom: 1,
    panX: -0.5,
    panY: 0,
    fitMode: 'cover',
    outputWidth: 512,
    outputHeight: 512,
  });

  assert.equal(coverSpec.sx, 400);
  assert.equal(coverSpec.sy, 0);
  assert.equal(coverSpec.sw, 400);
  assert.equal(coverSpec.sh, 400);
  assert.equal(coverSpec.dx, 0);
  assert.equal(coverSpec.dy, 0);
  assert.equal(coverSpec.dw, 512);
  assert.equal(coverSpec.dh, 512);

  // 400x800 portrait GIF inside 3:1 cover in contain mode -> centered 160x320 inside 960x320
  const containSpec = computeServerCropSpec({
    naturalWidth: 400,
    naturalHeight: 800,
    boxWidth: 300,
    boxHeight: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    fitMode: 'contain',
    outputWidth: 960,
    outputHeight: 320,
  });

  assert.equal(containSpec.sx, 0);
  assert.equal(containSpec.sy, 0);
  assert.equal(containSpec.sw, 400);
  assert.equal(containSpec.sh, 800);
  assert.equal(containSpec.dw, 160);
  assert.equal(containSpec.dh, 320);
  assert.equal(containSpec.dx, 400);
  assert.equal(containSpec.dy, 0);
});

test('attachBlobCropSpec and consumeBlobCropSpec store and consume crop metadata once', () => {
  const blob = new Blob(['gif-data'], { type: 'image/gif' });
  const spec = computeServerCropSpec({
    naturalWidth: 400,
    naturalHeight: 400,
    boxWidth: 300,
    boxHeight: 300,
    zoom: 1,
    panX: 0,
    panY: 0,
    fitMode: 'cover',
    outputWidth: 512,
    outputHeight: 512,
  });

  attachBlobCropSpec(blob, spec);
  assert.deepEqual(consumeBlobCropSpec(blob), spec);
  assert.equal(consumeBlobCropSpec(blob), undefined);
});

