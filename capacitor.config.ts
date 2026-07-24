import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.trainer.fitness',
  appName: 'Cadence',
  webDir: 'out',
  server: {
    // Point to live Vercel deployment — no static export needed.
    // Set CAPACITOR_SERVER_URL env var to override for local dev.
    url: process.env.CAPACITOR_SERVER_URL ?? 'https://trainer-app-mvp-recovered.vercel.app',
    hostname: 'trainer-app-mvp-recovered.vercel.app',
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0E1319',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0E1319',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
