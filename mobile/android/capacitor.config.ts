import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Multi-environment Capacitor config. The build selects an env file
 * via APP_ENV (default: staging). Each env file has its own appId
 * + name + server URL, so multiple builds can coexist on one device.
 *
 *   APP_ENV=staging    npm run android:sync    # env/staging.json
 *
 * To add a production target later: copy env/staging.json to
 * env/production.json, change appId / appName / serverUrl, then
 * build with APP_ENV=production. No code change needed.
 *
 * The APK ships zero JS — server.url points at the live PWA host
 * so web deploys reach installed users without an app-store update.
 */

type EnvConfig = {
  appId: string;
  appName: string;
  serverUrl: string;
  allowNavigation: string[];
};

const APP_ENV = (process.env.APP_ENV || 'staging').toLowerCase();
const envPath = resolve(__dirname, 'env', `${APP_ENV}.json`);
let envCfg: EnvConfig;
try {
  envCfg = JSON.parse(readFileSync(envPath, 'utf8'));
} catch (e) {
  throw new Error(
    `Capacitor build: could not load env config at ${envPath}. ` +
    `Set APP_ENV to one of the file names under env/ (e.g. APP_ENV=staging). ` +
    `Original error: ${(e as Error).message}`,
  );
}

console.log(`[capacitor] APP_ENV=${APP_ENV} → ${envCfg.appName} → ${envCfg.serverUrl}`);

const config: CapacitorConfig = {
  appId: envCfg.appId,
  appName: envCfg.appName,
  webDir: 'src',

  server: {
    url: envCfg.serverUrl,
    androidScheme: 'https',
    allowNavigation: envCfg.allowNavigation,
    cleartext: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0B4245',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0B4245',
    },
  },

  android: {
    backgroundColor: '#ffffff',
    appendUserAgent: `VezeorAndroid/${APP_ENV}-1.0`,
  },
};

export default config;
