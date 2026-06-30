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
      launchShowDuration: 2000,
      launchFadeOutDuration: 300,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
