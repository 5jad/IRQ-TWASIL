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

export function syncAndroidStatusBar(theme: Theme): void {
  if (!isCapacitorNative() || typeof window === 'undefined') return;

  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || theme === 'high-contrast' || (theme === 'system' && prefersDark);

  void import('@capacitor/status-bar')
    .then(async ({ StatusBar, Style }) => {
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({
        color: theme === 'high-contrast' ? '#000000' : isDark ? '#0B1220' : '#FAF9F7',
      });
    })
    .catch(() => {});
}
