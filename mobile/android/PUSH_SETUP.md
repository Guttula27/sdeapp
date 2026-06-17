# FCM push setup for the Capacitor Android wrapper

The JS side is wired (`apps/customer/src/utils/pushSetup.ts`) and the
plugin is in `mobile/android/package.json`. To enable FCM delivery
on the APK you also need the Google services Gradle plugin in the
native build. Capacitor's `cap sync` does NOT do this for you.

## One-time setup (per fresh checkout)

```bash
cd mobile/android
# Generate the native Android scaffold (only needed the first time)
APP_ENV=staging npx cap add android      # or production for prod build

# Copy the @capacitor/push-notifications native code + AndroidManifest
# entries into the scaffold.
APP_ENV=staging npx cap sync android
```

After the scaffold exists, edit two Gradle files (one-time, then they
stay in the project):

### `mobile/android/android/build.gradle`

Inside the top-level `buildscript { dependencies { ... } }` block, add:

```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

### `mobile/android/android/app/build.gradle`

At the very bottom of the file, add:

```gradle
apply plugin: 'com.google.gms.google-services'
```

Confirm `mobile/android/android/app/google-services.json` exists
(should already — committed at 689c1989; safe to commit as it's
client-side identifiers only, no secret).

## Every build after that

```bash
cd mobile/android
APP_ENV=staging npm run build:staging:debug
# or
APP_ENV=staging npm run build:staging:release
```

`cap sync` runs automatically as part of those npm scripts.

## How to test

1. Build a debug APK with the steps above. Install on an Android device.
2. Sign in to the customer PWA in the APK. The first time, you'll get
   a system permission prompt for notifications — tap Allow.
3. Open browser dev tools (Chrome `chrome://inspect`) on the WebView
   running in the APK. Confirm `[push]` console logs show a token
   being POSTed to `/push/register`.
4. Verify the row exists in the backend DB:
   ```sql
   SELECT id, kind, platform, LEFT(token, 24) AS token_prefix
   FROM paynpik_push_subscriptions
   WHERE userId = '<your-user-id>';
   ```
5. Background or kill the app. Trigger any customer alert (e.g. mark
   an order ready from the kitchen page). Expect a system notification
   tray entry with the alert title + body, and the default Android
   notification sound.

## Troubleshooting

- **"No notification permission" toast on Android 13+** — the user
  declined or auto-revoked the permission. Re-prompt requires user
  action via the OS settings; the app boot only re-asks if it sees
  the OS permission state flip back to `prompt`.
- **No token POST** — usually means `google-services.json` is missing
  or the Gradle plugin lines weren't added. `adb logcat | grep
  FirebaseApp` will surface init errors.
- **Token posted but no notifications** — check the API logs for
  `FCM send failed` lines. The most common cause is a stale token
  that survived an app reinstall; PushService prunes these
  automatically on the next dispatch attempt.
