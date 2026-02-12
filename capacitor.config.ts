/// <reference types="@capgo/capacitor-updater" />
import type { CapacitorConfig, PluginsConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

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
      resize: KeyboardResize.Body,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    adjustMarginsForEdgeToEdge: "auto",
  }
};

export default config;
