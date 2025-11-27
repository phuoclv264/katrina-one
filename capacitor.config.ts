import type { CapacitorConfig, PluginsConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.katrinaone.app',
  appName: 'Katrina One',
  webDir: 'out',
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Body,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true,
    }
  },
  android: {
    adjustMarginsForEdgeToEdge: "auto",
  }
};

export default config;
