/**
 * Push notification bootstrap for the customer PWA.
 *
 * Two delivery surfaces share this entrypoint:
 *
 *   1. Capacitor Android wrapper — FCM via @capacitor/push-notifications.
 *      When `Capacitor.isNativePlatform()` is true we ask the OS for
 *      permission, hand back the FCM registration id, and post it to
 *      /push/register so the backend can fan out to this device.
 *
 *   2. Browser PWA (regular tab or "Add to Home Screen") — Web Push.
 *      Implemented in a follow-up. The branch is wired here so the
 *      caller only has one entrypoint; today it's a no-op.
 *
 * The function is fire-and-forget by design. Errors are surfaced via
 * a console.warn so they show up in remote logs without blocking the
 * PWA boot. The only meaningful side-effect on success is the
 * POST /push/register call to the backend.
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import api from '../services/api';

let registeredToken: string | null = null;

export async function setupPushNotifications(): Promise<void> {
  // Only meaningful when the user is signed in — the backend keys
  // every subscription by userId. Caller checks before invoking.
  if (Capacitor.isNativePlatform()) {
    await registerForFcm();
    return;
  }
  // Browser PWA branch — Web Push lands in a follow-up. Bail quietly
  // so callers can keep the same one-line invocation.
  return;
}

async function registerForFcm(): Promise<void> {
  try {
    const perm = await PushNotifications.checkPermissions();
    let status = perm.receive;
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      const req = await PushNotifications.requestPermissions();
      status = req.receive;
    }
    if (status !== 'granted') {
      // User declined. Don't retry on every boot — they can re-enable
      // from the OS settings; we'll pick it up on the next sign-in.
      return;
    }

    // Ensure a dedicated notification channel for order alerts so
    // both the FCM payload (which references channelId on Android
    // priority high) and our LocalNotifications mirror land in the
    // same per-channel sound / importance bucket. Creating the
    // channel is idempotent — the OS dedupes by id.
    try {
      await LocalNotifications.createChannel({
        id: 'paynpik-alerts',
        name: 'Order alerts',
        description: 'Order received, ready, served, parcel ready',
        importance: 5, // IMPORTANCE_HIGH — heads-up + sound + vibration
        visibility: 1, // VISIBILITY_PUBLIC
        sound: undefined, // system default ringtone
        vibration: true,
        lights: true,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[push] createChannel failed', e);
    }
    // LocalNotifications needs its own permission grant (separate
    // from PushNotifications on some Android API levels).
    try { await LocalNotifications.requestPermissions(); }
    catch { /* ignore */ }

    // Set up listeners *before* register() so we don't miss the first
    // token / notification events on cold boot.
    PushNotifications.addListener('registration', async (token) => {
      if (!token?.value || token.value === registeredToken) return;
      registeredToken = token.value;
      try {
        await api.post('/push/register', {
          kind: 'FCM',
          token: token.value,
          platform: 'android',
        });
      } catch (e) {
        // The customer's tab is signed in (caller-checked) — a failure
        // here usually means a transient network issue. The next boot
        // re-registers automatically.
        // eslint-disable-next-line no-console
        console.warn('[push] /push/register failed', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[push] FCM registration error', err);
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      // Foreground: the OS suppresses its own tray entry and hands us
      // the event so we can decide what to do. We mirror it into the
      // notification list via LocalNotifications so the customer
      // still sees the entry when they pull down the shade later
      // (the in-app loud alert is already triggered by the Socket.IO
      // customerAlert event, so no need to double-ring here).
      try {
        const data: any = notification.data || {};
        // A stable hash of orderId / alertId so re-delivery of the
        // same alert doesn't stack duplicates in the tray.
        const idSource = (data.alertId || data.orderId || `${Date.now()}`) as string;
        const trayId = idSource.split('').reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) | 0), 7) & 0x7fffffff;
        await LocalNotifications.schedule({
          notifications: [{
            id: trayId || Math.floor(Math.random() * 1_000_000),
            title: notification.title || 'Order update',
            body: notification.body || '',
            channelId: 'paynpik-alerts',
            smallIcon: 'ic_stat_icon_config_sample',
            extra: data,
          }],
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[push] LocalNotifications.schedule failed', e);
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // User tapped a notification (or its action button) — deep-link
      // into the right page. The dispatcher stamps orderId on the
      // data payload; we send the user to the tracking page if so.
      const data = action.notification?.data || {};
      const orderId = (data as any).orderId;
      if (orderId && typeof window !== 'undefined') {
        window.location.assign(`/order/${orderId}/track`);
      }
    });

    await PushNotifications.register();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[push] setup failed', e);
  }
}

/**
 * Called on explicit sign-out — drops the token from the backend so
 * the next user signing in on the same device gets a clean slate and
 * we don't accidentally push order alerts to a previous account.
 */
export async function teardownPushNotifications(): Promise<void> {
  if (!registeredToken) return;
  try {
    await api.delete('/push/register', { data: { token: registeredToken } });
  } catch {
    // best-effort
  }
  registeredToken = null;
  if (Capacitor.isNativePlatform()) {
    try {
      // Remove all listeners so they don't fire under the next session.
      await PushNotifications.removeAllListeners();
    } catch { /* ignore */ }
  }
}
