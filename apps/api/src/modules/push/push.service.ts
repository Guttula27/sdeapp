import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../config/prisma/prisma.service';

/**
 * Push delivery — FCM for the Capacitor Android wrapper, Web Push for
 * browser PWAs. This service owns the firebase-admin initialisation
 * and the per-channel dispatch; the caller (lifecycle dispatcher)
 * resolves the user's PushSubscriptions and asks us to fan them out.
 *
 * Credentials resolution (first match wins):
 *
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  — JSON string inline (prod
 *      pattern: dump the service-account JSON into a single env var
 *      so the deploy environment can hold it without shipping a file).
 *
 *   2. FIREBASE_SERVICE_ACCOUNT_PATH  — absolute path to the JSON
 *      file (dev pattern: keep the file outside the repo and point
 *      at it from .env.local).
 *
 *   3. Nothing — Firebase admin is left uninitialised. send() short-
 *      circuits with a warn log so the app still boots and the
 *      existing Socket.IO + WhatsApp/SMS paths still fire. This lets
 *      a dev clone the repo and run without Firebase set up.
 */
@Injectable()
export class PushService implements OnModuleDestroy {
  private readonly log = new Logger(PushService.name);
  private app: admin.app.App | null = null;
  private initAttempted = false;

  constructor(private prisma: PrismaService) {}

  /** Pull credentials from env on first send, init firebase-admin once. */
  private ensureInit(): admin.app.App | null {
    if (this.initAttempted) return this.app;
    this.initAttempted = true;

    const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const path   = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    let raw: string | null = null;
    if (inline && inline.trim()) {
      raw = inline.trim();
    } else if (path && path.trim()) {
      try { raw = readFileSync(path.trim(), 'utf8'); }
      catch (e: any) {
        this.log.warn(`Could not read service account from ${path}: ${e?.message}`);
        return null;
      }
    } else {
      this.log.warn('FIREBASE_SERVICE_ACCOUNT_JSON / _PATH not set — push notifications disabled.');
      return null;
    }

    let credentials: admin.ServiceAccount;
    try { credentials = JSON.parse(raw); }
    catch (e: any) {
      this.log.error(`Invalid service-account JSON: ${e?.message}`);
      return null;
    }
    try {
      // Use a named app so multiple imports of admin in the same
      // process don't collide with the default app.
      this.app = admin.initializeApp(
        { credential: admin.credential.cert(credentials) },
        'paynpik-push',
      );
      this.log.log(`firebase-admin initialised for project ${(credentials as any).project_id}`);
    } catch (e: any) {
      // initializeApp throws if the named app already exists — re-use it.
      if (e?.code === 'app/duplicate-app') {
        this.app = admin.app('paynpik-push');
      } else {
        this.log.error(`firebase-admin init failed: ${e?.message}`);
        return null;
      }
    }
    return this.app;
  }

  /**
   * Fan-out send for a single user. Caller passes the userId; we
   * pull every active FCM token for that user, send a multicast,
   * and prune any token the FCM API reports as unregistered /
   * invalid (tokens cycle when an app is reinstalled or the user
   * revokes notification permission).
   *
   * Web Push (browser PWA) tokens come later — same method, just a
   * separate code path. Today only FCM is implemented.
   */
  async sendToUser(userId: string, payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
    // Channel hint surfaced to the Android side; the customer SW
    // / native side picks the matching tone / vibration pattern.
    // Mirrors the existing in-app "ringtone" string.
    ringtone?: string | null;
  }): Promise<{ sent: number; failed: number; pruned: number }> {
    const app = this.ensureInit();
    if (!app) return { sent: 0, failed: 0, pruned: 0 };

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId, kind: 'FCM' },
      select: { id: true, token: true },
    });
    if (subs.length === 0) return { sent: 0, failed: 0, pruned: 0 };

    const tokens = subs.map((s) => s.token).filter((t): t is string => !!t);
    if (tokens.length === 0) return { sent: 0, failed: 0, pruned: 0 };

    const data: Record<string, string> = { ...(payload.data ?? {}) };
    if (payload.ringtone) data.ringtone = payload.ringtone;

    try {
      const messaging = admin.messaging(app);
      const res = await messaging.sendEachForMulticast({
        tokens,
        // notification.{title,body} drives the OS-rendered notification
        // when the app is backgrounded / killed. data.* is delivered to
        // the running app via the Capacitor PushNotifications listener,
        // so the foreground experience can choose its own UI.
        notification: { title: payload.title, body: payload.body },
        data,
        android: {
          // Priority high → heads-up display, full-screen ringtone,
          // wake from doze. channelId pins to the dedicated
          // 'order_updates' channel registered client-side at FCM
          // setup time. That channel is set up at IMPORTANCE_HIGH
          // with system default sound + vibration, so customers see
          // it as a distinct row in Android's notification settings
          // and can't silence every Paynpik alert by toggling the
          // catch-all default channel. Devices that pre-date the
          // channel registration fall back to the plugin's default
          // channel — same audible behaviour, just no per-channel
          // OS toggle.
          priority: 'high',
          notification: {
            channelId: 'order_updates',
            sound: 'default',
            defaultVibrateTimings: true,
            visibility: 'public',
          },
        },
      });

      // Drop tokens FCM reports as unrecoverable so future fan-outs
      // don't keep retrying them. The two terminal errors that mean
      // "this token is gone" are unregistered + invalid-argument.
      const stale: string[] = [];
      res.responses.forEach((r, i) => {
        if (!r.success) {
          const code = (r.error as any)?.code as string | undefined;
          if (code === 'messaging/registration-token-not-registered'
            || code === 'messaging/invalid-registration-token'
            || code === 'messaging/invalid-argument') {
            stale.push(tokens[i]);
          }
        }
      });
      let pruned = 0;
      if (stale.length) {
        const r = await this.prisma.pushSubscription.deleteMany({
          where: { userId, token: { in: stale } },
        });
        pruned = r.count;
      }

      return { sent: res.successCount, failed: res.failureCount, pruned };
    } catch (e: any) {
      this.log.error(`FCM send failed for user ${userId}: ${e?.message}`);
      return { sent: 0, failed: tokens.length, pruned: 0 };
    }
  }

  /**
   * Upsert a subscription row. Called by POST /push/register after
   * the client gets a fresh token. Re-registering the same token is
   * cheap (just bumps updatedAt).
   */
  async registerToken(input: {
    userId: string;
    kind: 'FCM' | 'WEBPUSH';
    token: string;
    platform?: string | null;
  }) {
    if (!input.token) throw new Error('Token is required');
    return this.prisma.pushSubscription.upsert({
      where: { userId_token: { userId: input.userId, token: input.token } },
      update: { platform: input.platform ?? null, kind: input.kind },
      create: {
        userId: input.userId,
        kind: input.kind,
        token: input.token,
        platform: input.platform ?? null,
      },
    });
  }

  /** Drop a subscription (e.g. user revoked notification permission). */
  async unregisterToken(userId: string, token: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, token },
    });
  }

  async onModuleDestroy() {
    if (this.app) {
      try { await this.app.delete(); } catch { /* shutdown best-effort */ }
    }
  }
}
