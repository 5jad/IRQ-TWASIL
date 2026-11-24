import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeChromeTopOffsets,
  resolveSystemBarAppearance,
} from './nativeAndroid';

test('resolveSystemBarAppearance selects dark bar icons on light themes and light icons on dark themes', () => {
  assert.deepEqual(resolveSystemBarAppearance('light', false), {
    isDark: false,
    backgroundColor: '#FAF9F7',
  });
  assert.deepEqual(resolveSystemBarAppearance('calm', true), {
    isDark: false,
    backgroundColor: '#F4F1EA',
  });
  assert.deepEqual(resolveSystemBarAppearance('dark', false), {
    isDark: true,
    backgroundColor: '#0A0F1A',
  });
  assert.deepEqual(resolveSystemBarAppearance('high-contrast', false), {
    isDark: true,
    backgroundColor: '#000000',
  });
  assert.deepEqual(resolveSystemBarAppearance('system', true), {
    isDark: true,
    backgroundColor: '#0A0F1A',
  });
  assert.deepEqual(resolveSystemBarAppearance('system', false), {
    isDark: false,
    backgroundColor: '#FAF9F7',
  });
});

test('computeChromeTopOffsets preserves status-bar safe area when top bar hides on scroll', () => {
  assert.deepEqual(computeChromeTopOffsets(true), {
    chromeTop: 'var(--header-h)',
    stripTop: 'var(--header-h)',
  });
  assert.deepEqual(computeChromeTopOffsets(false), {
    chromeTop: 'var(--sat)',
    stripTop: 'calc(-80px + var(--sat))',
  });
});
