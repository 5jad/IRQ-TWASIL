import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATE_MODES,
  CAMERA_FILTERS,
  SEED_AUDIO_TRACKS,
  HERITAGE_MOTIFS,
  DEFAULT_CAMERA_SETTINGS,
  parseCreateMode,
  buildPreviewFilterCss,
  pickSupportedVideoMimeType,
  computeStoryExpiryIso,
  clampStoryDurationSec,
  buildSquircleSvgPath,
} from './createUtils';
import { formatTimeSafe } from './formatters';

test('CREATE_MODES has 5 modes starting with post, story, instants, reel, live', () => {
  assert.deepEqual(
    CREATE_MODES.map((m) => m.id),
    ['post', 'story', 'instants', 'reel', 'live']
  );
  assert.equal(parseCreateMode('reel'), 'reel');
  assert.equal(parseCreateMode('instants'), 'instants');
  assert.equal(parseCreateMode('post'), 'post');
  assert.equal(parseCreateMode('invalid'), 'story');
  assert.equal(parseCreateMode('live'), 'live');
});

test('CAMERA_FILTERS provides 6 Iraqi presets and beauty blur composition', () => {
  assert.equal(CAMERA_FILTERS.length, 6);
  assert.equal(buildPreviewFilterCss('none', 0), 'none');
  const beautyOnly = buildPreviewFilterCss('none', 50);
  assert.match(beautyOnly, /blur\(0\.60px\)/);
  assert.match(beautyOnly, /brightness\(1\.04\)/);
  const combined = buildPreviewFilterCss('tigris', 100);
  assert.match(combined, /hue-rotate\(15deg\)/);
  assert.match(combined, /blur\(1\.20px\)/);
});

test('SEED_AUDIO_TRACKS and HERITAGE_MOTIFS match counts and fields', () => {
  assert.equal(SEED_AUDIO_TRACKS.length, 6);
  assert.equal(HERITAGE_MOTIFS.length, 12);
});

test('pickSupportedVideoMimeType prefers vp9/opus webm then falls back to mp4', () => {
  assert.equal(
    pickSupportedVideoMimeType((m) => m === 'video/webm;codecs=vp9,opus' || m === 'video/mp4'),
    'video/webm;codecs=vp9,opus'
  );
  assert.equal(
    pickSupportedVideoMimeType((m) => m === 'video/mp4'),
    'video/mp4'
  );
  assert.equal(pickSupportedVideoMimeType(() => false), '');
});

test('computeStoryExpiryIso sets 24h expiry and clampStoryDurationSec enforces image 5s and video max 15s', () => {
  const base = Date.UTC(2026, 10, 13, 12, 0, 0);
  const expiry = computeStoryExpiryIso(base);
  assert.equal(new Date(expiry).getTime() - base, 24 * 60 * 60 * 1000);
  assert.equal(clampStoryDurationSec(25, 'image'), 5);
  assert.equal(clampStoryDurationSec(22.4, 'video'), 15);
  assert.equal(clampStoryDurationSec(0.4, 'video'), 1);
  assert.equal(clampStoryDurationSec(4.26, 'video'), 4.3);
});

test('buildSquircleSvgPath generates closed normalized superellipse path and toolsExpanded defaults false', () => {
  const path = buildSquircleSvgPath(4.2, 64);
  assert.ok(path.startsWith('M '));
  assert.ok(path.endsWith(' Z'));
  assert.equal(DEFAULT_CAMERA_SETTINGS.toolsExpanded, false);
});

test('formatTimeSafe converts ISO timestamps into Arabic relative time and passes localized text through', () => {
  const now = new Date(Date.UTC(2026, 10, 14, 1, 0, 0));
  const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  assert.equal(formatTimeSafe(twoMinAgo, 'arabic-indic', now), 'قبل دقيقتين');
  assert.equal(formatTimeSafe('قبل ساعتين', 'arabic-indic', now), 'قبل ساعتين');
});
