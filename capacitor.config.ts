/// <reference types="@capacitor-community/safe-area" />
/// <reference types="@capacitor/splash-screen" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.poolcup.app',
  appName: 'PoolCup',
  webDir: 'mobile/out',
  plugins: {
    SystemBars: {
      insetsHandling: 'disable',
    },
    SafeArea: {
      initialViewportFitCover: true,
      detectViewportFitCoverChanges: true,
    },
    SplashScreen: {
      backgroundColor: '#000000',
      launchAutoHide: false,
      launchShowDuration: 500,
      launchFadeOutDuration: 0,
      androidSplashResourceName: 'splash',
      androidScaleType: 'FIT_CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
