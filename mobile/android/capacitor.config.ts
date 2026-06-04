import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the PayNPik customer Android wrapper.
 *
 * Strategy: the APK is a thin shell that loads the deployed PWA at
 * its public URL. No JS is bundled into the APK; web deploys roll
 * out instantly to installed users, no app-store update needed.
 *
 * If you ever want an offline-first APK that ships the built JS,
 * remove the `server.url` block and instead set `webDir` to the
 * built `apps/customer/dist/` path, then run `npx cap copy` before
 * each build.
 */
const config: CapacitorConfig = {
  // Reverse-DNS app identifier. Must be unique across the Play
  // Store if you ever publish. Changing it later breaks updates
  // for existing installs — set it once and leave it.
  appId: 'cloud.vezeor.paynpik.customer',
  appName: 'PayNPik',

  // webDir is required even when using server.url — Capacitor still
  // writes a fallback index.html here so the WebView has something
  // to load if network is unreachable on first launch. Pointing at
  // a tiny placeholder keeps the APK small.
  webDir: 'src',

  // Load the production PWA directly. Subsequent navigation, service
  // worker registration, and caching all happen inside the WebView
  // exactly as on Chrome.
  server: {
    url: 'https://order.vezeor.cloud',
    // androidScheme controls how local files (when webDir is used)
    // and Capacitor plugin bridges identify themselves. Keep https
    // so mixed-content rules match the production PWA.
    androidScheme: 'https',
    // Domains that are allowed to navigate the WebView. The PWA also
    // calls api.vezeor.cloud — listed here so external links to
    // checkout / receipts open in-app rather than bouncing to Chrome.
    allowNavigation: [
      'order.vezeor.cloud',
      'api.vezeor.cloud',
      // Razorpay checkout SDK iframe origins. Without these,
      // the payment flow would launch Chrome instead of staying
      // in-app, breaking the back-to-app return.
      '*.razorpay.com',
      'api.razorpay.com',
    ],
    // cleartext: false — disallow plain HTTP (matches PWA security).
    cleartext: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#f97316', // brand orange
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#f97316',
    },
  },

  android: {
    // Allow back button to close the activity when there's no
    // browser history left, instead of becoming a no-op.
    backgroundColor: '#ffffff',
    // Override the default WebView user agent so analytics can
    // distinguish APK traffic from chrome.
    appendUserAgent: 'PayNPikAndroid/1.0',
  },
};

export default config;
