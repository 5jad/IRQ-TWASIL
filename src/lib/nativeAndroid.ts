import type { Theme } from '../types';
import { isCapacitorNative } from './runtimeUrl';

export function registerAndroidBackButton(onBack: () => boolean): () => void {
  if (!isCapacitorNative()) {
    return () => {};
  }

  let removed = false;
  let removeHandle: (() => Promise<void>) | null = null;

  void import('@capacitor/app')
    .then(({ App }) => {
      if (removed) return;
      return App.addListener('backButton', ({ canGoBack }) => {
        const handled = onBack();
        if (!handled) {
          if (canGoBack) {
            window.history.back();
          } else {
            void App.exitApp();
          }
        }
      });
    })
    .then((listener) => {
      if (!listener) return;
      if (removed) {
        void listener.remove();
      } else {
        removeHandle = () => listener.remove();
      }
    })
    .catch(() => {});

  return () => {
    removed = true;
    if (removeHandle) {
      void removeHandle();
    }
  };
}

export interface SystemBarAppearance {
  isDark: boolean;
  backgroundColor: string;
}

export function resolveSystemBarAppearance(
  theme: Theme,
  prefersDark: boolean
): SystemBarAppearance {
  const isDark =
    theme === 'dark' ||
    theme === 'high-contrast' ||
    (theme === 'system' && prefersDark);

  const backgroundColor =
    theme === 'high-contrast'
      ? '#000000'
      : isDark
      ? '#0A0F1A'
      : theme === 'calm'
      ? '#F4F1EA'
      : '#FAF9F7';

  return { isDark, backgroundColor };
}

export function computeChromeTopOffsets(isBottomBarVisible: boolean): {
  chromeTop: string;
  stripTop: string;
} {
  return {
    chromeTop: isBottomBarVisible ? 'var(--header-h)' : 'var(--sat)',
    stripTop: isBottomBarVisible ? 'var(--header-h)' : 'calc(-80px + var(--sat))',
  };
}

export function syncAndroidStatusBar(theme: Theme): void {
  if (!isCapacitorNative() || typeof window === 'undefined') return;

  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const { isDark, backgroundColor } = resolveSystemBarAppearance(theme, prefersDark);

  void import('@capacitor/core')
    .then(({ SystemBars, SystemBarsStyle }) =>
      SystemBars.setStyle({
        style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      })
    )
    .catch(() => {});

  void import('@capacitor/status-bar')
    .then(async ({ StatusBar, Style }) => {
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({ color: backgroundColor });
    })
    .catch(() => {});
}
