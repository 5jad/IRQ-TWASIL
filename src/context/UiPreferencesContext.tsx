import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  AccentPreset,
  Handedness,
  NumeralSystem,
  ReportTargetType,
  Theme,
  User,
} from '../types';
import {
  ALLOWED_ACCENTS,
  ALLOWED_HANDEDNESS,
  ALLOWED_NUMERALS,
  ALLOWED_THEMES,
  GUEST_USER,
  readStoredPrefs,
  writeStoredPrefs,
} from './contextHelpers';

export interface UiPreferencesContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accent: AccentPreset;
  setAccent: (accent: AccentPreset) => void;
  handedness: Handedness;
  setHandedness: (handedness: Handedness) => void;
  fontScale: number;
  setFontScale: (scale: number) => void;
  numeralSystem: NumeralSystem;
  setNumeralSystem: (sys: NumeralSystem) => void;
  reduceMotion: boolean;
  setReduceMotion: (val: boolean) => void;
  dataSaver: boolean;
  setDataSaver: (val: boolean) => void;

  isBottomBarVisible: boolean;
  setIsBottomBarVisible: (val: boolean) => void;
  isRecentChatsOpen: boolean;
  setIsRecentChatsOpen: (val: boolean) => void;
  isComposerOpen: boolean;
  setIsComposerOpen: (val: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;

  appToast: { message: string; tone: 'info' | 'error' | 'success' } | null;
  showAppToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
  dismissAppToast: () => void;

  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (val: boolean) => void;
  reportModalData: {
    isOpen: boolean;
    targetType: ReportTargetType;
    targetTitle?: string;
    targetId?: string;
  };
  openReportModal: (
    targetType: ReportTargetType,
    targetTitle?: string,
    targetId?: string
  ) => void;
  closeReportModal: () => void;
  shareModalData: { isOpen: boolean; title: string; url: string };
  openShareModal: (title: string, url: string) => void;
  closeShareModal: () => void;
  callModalData: { isOpen: boolean; user: User; isVideoCall: boolean };
  openCallModal: (user: User, isVideoCall: boolean) => void;
  closeCallModal: () => void;
  activeStoryUser: User | null;
  setActiveStoryUser: (user: User | null) => void;
  openStoryViewer: (user: User) => void;
  closeStoryViewer: () => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextType | undefined>(undefined);

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const initialPrefs = readStoredPrefs();

  const [theme, setThemeState] = useState<Theme>(() =>
    initialPrefs.theme && ALLOWED_THEMES.includes(initialPrefs.theme)
      ? initialPrefs.theme
      : 'system'
  );
  const [accent, setAccentState] = useState<AccentPreset>(() =>
    initialPrefs.accent && ALLOWED_ACCENTS.includes(initialPrefs.accent)
      ? initialPrefs.accent
      : 'teal'
  );
  const [handedness, setHandednessState] = useState<Handedness>(() =>
    initialPrefs.handedness && ALLOWED_HANDEDNESS.includes(initialPrefs.handedness)
      ? initialPrefs.handedness
      : 'center'
  );
  const [fontScale, setFontScaleState] = useState<number>(() => {
    const s = initialPrefs.fontScale;
    return typeof s === 'number' && s >= 0.8 && s <= 1.5 ? s : 1;
  });
  const [numeralSystem, setNumeralSystemState] = useState<NumeralSystem>(() =>
    initialPrefs.numeralSystem && ALLOWED_NUMERALS.includes(initialPrefs.numeralSystem)
      ? initialPrefs.numeralSystem
      : 'arabic-indic'
  );
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => {
    if (typeof initialPrefs.reduceMotion === 'boolean') return initialPrefs.reduceMotion;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [dataSaver, setDataSaverState] = useState<boolean>(() =>
    typeof initialPrefs.dataSaver === 'boolean' ? initialPrefs.dataSaver : false
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeStoredPrefs({ ...readStoredPrefs(), theme: t });
  }, []);

  const setAccent = useCallback((a: AccentPreset) => {
    setAccentState(a);
    writeStoredPrefs({ ...readStoredPrefs(), accent: a });
  }, []);

  const setHandedness = useCallback((h: Handedness) => {
    setHandednessState(h);
    writeStoredPrefs({ ...readStoredPrefs(), handedness: h });
  }, []);

  const setFontScale = useCallback((s: number) => {
    setFontScaleState(s);
    writeStoredPrefs({ ...readStoredPrefs(), fontScale: s });
  }, []);

  const setNumeralSystem = useCallback((n: NumeralSystem) => {
    setNumeralSystemState(n);
    writeStoredPrefs({ ...readStoredPrefs(), numeralSystem: n });
  }, []);

  const setReduceMotion = useCallback((r: boolean) => {
    setReduceMotionState(r);
    writeStoredPrefs({ ...readStoredPrefs(), reduceMotion: r });
  }, []);

  const setDataSaver = useCallback((d: boolean) => {
    setDataSaverState(d);
    writeStoredPrefs({ ...readStoredPrefs(), dataSaver: d });
  }, []);

  const [isBottomBarVisible, setIsBottomBarVisible] = useState<boolean>(true);
  const [isRecentChatsOpen, setIsRecentChatsOpen] = useState<boolean>(false);
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const [appToast, setAppToast] = useState<{
    message: string;
    tone: 'info' | 'error' | 'success';
  } | null>(null);
  const appToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissAppToast = useCallback(() => {
    if (appToastTimerRef.current) {
      clearTimeout(appToastTimerRef.current);
      appToastTimerRef.current = null;
    }
    setAppToast(null);
  }, []);

  const showAppToast = useCallback(
    (message: string, tone: 'info' | 'error' | 'success' = 'info') => {
      setAppToast({ message, tone });
      if (appToastTimerRef.current) clearTimeout(appToastTimerRef.current);
      appToastTimerRef.current = setTimeout(() => {
        setAppToast(null);
      }, 3600);
    },
    []
  );

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [reportModalData, setReportModalData] = useState<{
    isOpen: boolean;
    targetType: ReportTargetType;
    targetTitle?: string;
    targetId?: string;
  }>({ isOpen: false, targetType: 'post' });
  const [shareModalData, setShareModalData] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
  }>({ isOpen: false, title: '', url: '' });
  const [callModalData, setCallModalData] = useState<{
    isOpen: boolean;
    user: User;
    isVideoCall: boolean;
  }>({ isOpen: false, user: GUEST_USER, isVideoCall: false });
  const [activeStoryUser, setActiveStoryUser] = useState<User | null>(null);

  const openReportModal = useCallback(
    (targetType: ReportTargetType, targetTitle?: string, targetId?: string) => {
      setReportModalData({ isOpen: true, targetType, targetTitle, targetId });
    },
    []
  );
  const closeReportModal = useCallback(() => {
    setReportModalData((prev) => ({ ...prev, isOpen: false }));
  }, []);
  const openShareModal = useCallback((title: string, url: string) => {
    setShareModalData({ isOpen: true, title, url });
  }, []);
  const closeShareModal = useCallback(() => {
    setShareModalData((prev) => ({ ...prev, isOpen: false }));
  }, []);
  const openCallModal = useCallback((user: User, isVideoCall: boolean) => {
    setCallModalData({ isOpen: true, user, isVideoCall });
  }, []);
  const closeCallModal = useCallback(() => {
    setCallModalData((prev) => ({ ...prev, isOpen: false }));
  }, []);
  const openStoryViewer = useCallback((user: User) => {
    setActiveStoryUser(user);
  }, []);
  const closeStoryViewer = useCallback(() => {
    setActiveStoryUser(null);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let appliedTheme = theme;
    if (theme === 'system') {
      const isDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      appliedTheme = isDark ? 'dark' : 'light';
    }

    root.setAttribute('data-theme', appliedTheme);
    if (appliedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.setAttribute('data-accent', accent);
    root.style.setProperty('--font-scale', String(fontScale));

    if (reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSchemeChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        root.setAttribute('data-theme', newTheme);
        if (newTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };
      media.addEventListener('change', handleSchemeChange);
      return () => media.removeEventListener('change', handleSchemeChange);
    }
  }, [theme, accent, fontScale, reduceMotion]);

  return (
    <UiPreferencesContext.Provider
      value={{
        theme,
        setTheme,
        accent,
        setAccent,
        handedness,
        setHandedness,
        fontScale,
        setFontScale,
        numeralSystem,
        setNumeralSystem,
        reduceMotion,
        setReduceMotion,
        dataSaver,
        setDataSaver,
        isBottomBarVisible,
        setIsBottomBarVisible,
        isRecentChatsOpen,
        setIsRecentChatsOpen,
        isComposerOpen,
        setIsComposerOpen,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        appToast,
        showAppToast,
        dismissAppToast,
        isAuthModalOpen,
        setIsAuthModalOpen,
        reportModalData,
        openReportModal,
        closeReportModal,
        shareModalData,
        openShareModal,
        closeShareModal,
        callModalData,
        openCallModal,
        closeCallModal,
        activeStoryUser,
        setActiveStoryUser,
        openStoryViewer,
        closeStoryViewer,
      }}
    >
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences(): UiPreferencesContextType {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) {
    throw new Error('useUiPreferences must be used within UiPreferencesProvider');
  }
  return ctx;
}
