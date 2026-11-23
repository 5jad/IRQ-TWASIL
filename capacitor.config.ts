import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'iq.tawasul.app',
  appName: 'IRQ تواصل',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#FAF9F7',
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
