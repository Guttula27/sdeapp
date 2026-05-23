import { Injectable, Logger } from '@nestjs/common';
import { TranslationProvider } from './translation-provider';

/**
 * Lingva is a free public proxy in front of Google Translate. No API key
 * needed but rate-limited; intended as a stop-gap until BHASHINI credentials
 * are in place. Override the host with LINGVA_URL.
 */
@Injectable()
export class LingvaTranslationProvider implements TranslationProvider {
  private readonly logger = new Logger(LingvaTranslationProvider.name);
  private readonly hosts: string[];

  constructor() {
    const env = process.env.LINGVA_URL?.trim();
    this.hosts = env ? [env.replace(/\/$/, '')] : [
      'https://lingva.ml',
      'https://lingva.lunar.icu',
      'https://translate.plausibility.cloud',
    ];
  }

  // Per-host fetch timeout (ms). Without this the Node `fetch` hangs forever
  // when a Lingva mirror is unreachable, blocking every menu/category/item
  // create call (each fans out to N enabled languages via this provider).
  // Keep small — translation is best-effort and we fall back to source text.
  private static readonly FETCH_TIMEOUT_MS = 1500;
  // Circuit-breaker: once a host returns an error, skip it for this long. Stops
  // a single create-category call (which translates to N langs in parallel) from
  // re-trying the same dead host N times in the same request.
  private static readonly HOST_BLOCK_MS = 60_000;
  private static blockedHosts = new Map<string, number>();

  async translate(text: string, fromCode: string, toCode: string): Promise<string> {
    if (!text) return text;
    if (fromCode === toCode) return text;

    const encoded = encodeURIComponent(text);
    let lastError: unknown = null;
    const now = Date.now();

    for (const host of this.hosts) {
      const blockedUntil = LingvaTranslationProvider.blockedHosts.get(host) ?? 0;
      if (blockedUntil > now) {
        // Within cooldown — skip without burning the request budget.
        lastError = new Error(`${host} cooling down`);
        continue;
      }
      try {
        const res = await fetch(`${host}/api/v1/${fromCode}/${toCode}/${encoded}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(LingvaTranslationProvider.FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
          LingvaTranslationProvider.blockedHosts.set(host, now + LingvaTranslationProvider.HOST_BLOCK_MS);
          lastError = new Error(`${host} ${res.status}`);
          continue;
        }
        const data: any = await res.json();
        if (typeof data?.translation === 'string' && data.translation.trim()) {
          return data.translation;
        }
        lastError = new Error(`${host} returned no translation`);
      } catch (e) {
        LingvaTranslationProvider.blockedHosts.set(host, now + LingvaTranslationProvider.HOST_BLOCK_MS);
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Lingva failed');
  }
}
