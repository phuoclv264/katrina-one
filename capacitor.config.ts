/// <reference types="@capgo/capacitor-updater" />
import type { CapacitorConfig, PluginsConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const updaterConfig: PluginsConfig['CapacitorUpdater'] = {
  appId: 'com.katrinaone.app',
  autoUpdate: false,
  allowModifyUrl: true,
  allowModifyAppId: true,
  appReadyTimeout: 10000,
  responseTimeout: 20,
  keepUrlPathAfterReload: true,
};

const config: CapacitorConfig = {
  appId: 'com.katrinaone.app',
  appName: 'Katrina One',
  webDir: 'out',
  plugins: {
    CapacitorUpdater: updaterConfig,
    Keyboard: {
      resize: KeyboardResize.None,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    adjustMarginsForEdgeToEdge: "auto",
    webContentsDebuggingEnabled: true,
  }
};

export default config;
