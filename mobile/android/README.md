# VEZEOR Customer — Android wrapper

A thin native Android shell that loads the deployed PWA in a Capacitor
WebView. The app behaves exactly like the PWA — same codebase, same
backend, same look — but installable as an APK.

## Environments

The wrapper is **env-driven**. Each environment lives in
`env/<name>.json` and picks its own app id, app name, and server URL.
This lets staging and (future) production APKs coexist on a single
device without colliding.

| Env | App name | App ID | Loads |
|------|----------|--------|-------|
| `staging` (default) | `VEZEOR` | `cloud.vezeor.paynpik.customer.staging` | `https://order.vezeor.cloud` |
| `production` (not yet created) | — | — | — |

When you're ready to ship production:

1. `cp env/staging.json env/production.json`
2. Edit `env/production.json` — change `appId`, `appName`, `serverUrl`,
   and the navigation allowlist to your production domain.
3. In `.github/workflows/android-release.yml`, change the matrix
   `env_name` line to `env_name: [staging, production]`.
4. Push a tag (`git tag mobile-v1.0.0 && git push --tags`) — the CI
   builds both APKs and attaches them to a GitHub Release.

Why this architecture (not TWA, not a bundled APK):

- **Web updates roll out automatically.** The APK contains no JS;
  every launch fetches the latest bundle from the deploy. No app-store
  resubmission for a frontend change.
- **Full native APIs.** Vibration / audio / camera all work through
  Capacitor plugins.
- **No Digital Asset Links** required (unlike TWA).

---

## One-time setup on a build machine

You need:

- **Node.js 20+** (any platform — Mac, Linux, Windows)
- **Android Studio Iguana or newer** (for `sdkmanager`, `gradle`,
  emulator). Free from https://developer.android.com/studio.
- **JDK 17** (Android Studio bundles a JDK; if you prefer to use your
  own, install JDK 17 — Android Gradle Plugin 8.x requires it).
- **An Android Studio AVD** (emulator) OR a physical Android device
  with USB debugging on, for testing.

After installing Android Studio:

1. Open Android Studio → **Settings → Languages & Frameworks →
   Android SDK** → ensure SDK 34 (or current latest) is installed.
2. Add the SDK location to your shell env:
   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"   # mac default
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
   ```
3. Verify:
   ```bash
   adb --version
   sdkmanager --version
   ```

---

## Build the APK locally (first time)

```bash
cd mobile/android

# 1. Install Capacitor + plugin deps
npm install

# 2. Generate the native Android project (creates android/ folder).
#    Run once; afterwards `npx cap sync` keeps it in lockstep.
APP_ENV=staging npx cap add android

# 3. Sync the env-driven Capacitor config + plugins into the project.
APP_ENV=staging npx cap sync android
```

Or use the package-script shortcuts:

```bash
npm run build:staging:debug    # unsigned APK, fine for sideload tests
npm run build:staging:release  # signed APK (needs keystore.properties)
```

At this point you'll have `mobile/android/android/` — a fully native
Gradle project. Open it in Android Studio, OR build via CLI:

### Option A: Build from Android Studio (recommended for first run)

```bash
npx cap open android
```

That launches Android Studio with the project loaded. Then:

- **Run → Run 'app'** → pick an emulator or a connected device.
- For a release APK: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
  Output: `mobile/android/android/app/build/outputs/apk/debug/app-debug.apk`.

### Option B: Build from the command line

```bash
cd mobile/android/android

# Debug APK (unsigned, for testing — installs on emulator + dev devices)
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# Release APK (signed, for distribution — see "Signing" below first)
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

---

## Subsequent builds (after pulling a config change)

```bash
cd mobile/android
npm install       # if deps changed
npx cap sync android
cd android && ./gradlew assembleDebug
```

You do NOT need to rebuild every time the web app changes — the APK
just loads `https://order.vezeor.cloud`. A web deploy is enough.

---

## Signing for production

The release APK must be signed before publishing or distributing.

1. Generate a signing key (do this **once** and keep it safe — losing
   it means you can never update the app):

   ```bash
   keytool -genkey -v -keystore vezeor-customer.keystore \
     -alias vezeor -keyalg RSA -keysize 2048 -validity 10000
   ```

   Move the resulting `vezeor-customer.keystore` somewhere safe (NOT
   into git). Note down the passwords you set.

2. Create `mobile/android/android/keystore.properties` (gitignored):

   ```properties
   storeFile=/absolute/path/to/vezeor-customer.keystore
   storePassword=your-keystore-password
   keyAlias=vezeor
   keyPassword=your-key-password
   ```

3. Update `mobile/android/android/app/build.gradle` — Capacitor's
   generated `build.gradle` includes commented-out signing config.
   Uncomment the `signingConfigs { release { … } }` block and ensure
   the `release` build type uses it.

4. Build:
   ```bash
   cd mobile/android/android
   ./gradlew assembleRelease
   ```

The resulting `app-release.apk` is signed and installable.

---

## Permissions

`AndroidManifest.xml` (managed by Capacitor) already requests:

| Permission | Why |
|------------|-----|
| `INTERNET` | The wrapper loads order.vezeor.cloud |
| `ACCESS_NETWORK_STATE` | Offline banner detection in the PWA |
| `VIBRATE` | Order-ready alert vibration |
| `CAMERA` | QR code scanner (table QR + customer QR) |
| `RECORD_AUDIO` | Only requested if you add voice features later — safe to remove |

If you want to remove any of these, edit
`mobile/android/android/app/src/main/AndroidManifest.xml` directly.

---

## Icons and splash screen

Capacitor uses the default Android icon until you replace it.

Replace `mobile/android/resources/icon.png` and
`mobile/android/resources/splash.png` (1024×1024 and 2732×2732
respectively), then run:

```bash
cd mobile/android
npx @capacitor/assets generate --android
npx cap sync android
```

That generates all the size variants Android expects (mipmap-mdpi
through xxxhdpi) and updates the native project.

For now those resource files don't exist — Android Studio's default
launcher icon will be used until you add them.

---

## What this APK actually does

On launch:

1. Native Android shell starts
2. Capacitor WebView is created with hardware acceleration
3. The WebView navigates directly to `https://order.vezeor.cloud`
4. The PWA's service worker registers as if installed via Chrome
5. Everything inside (login, menu, payments, alerts, vibration) runs
   the same as the web PWA

The "Add to Home Screen" path on Chrome and this wrapped APK produce
nearly identical UX. The APK is preferable when:

- You want Play Store distribution
- You want a desktop icon without going through Chrome
- You want to enforce a specific package identity for analytics
- You need a permission that Chrome PWAs can't grant (rare)

---

## Updating Capacitor

Periodically:

```bash
cd mobile/android
npm update @capacitor/core @capacitor/cli @capacitor/android
npx cap sync android
```

Test on an emulator before publishing.

---

## Troubleshooting

**"INSTALL_FAILED_VERSION_DOWNGRADE"** when installing on a device that
has a previous release — increment `android.defaultConfig.versionCode`
in `mobile/android/android/app/build.gradle`.

**WebView shows blank / "net::ERR_CACHE_MISS"** — pull-to-refresh OR
clear the WebView cache (`Settings → Apps → VEZEOR → Storage → Clear
cache`). The PWA's service worker should self-heal on the next launch.

**Vibration doesn't fire** — check `VIBRATE` is in the manifest AND the
device isn't in Do Not Disturb / silent / battery-saving mode (these
override app-level vibration on Android).

**Camera permission prompt doesn't appear** — Capacitor requests
permission on first use, not on launch. Navigate to the scan flow in
the PWA; the prompt should appear when html5-qrcode tries to access
the camera.

**Build fails with "ANDROID_HOME not set"** — see "One-time setup".
