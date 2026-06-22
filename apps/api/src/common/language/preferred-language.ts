import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Resolves the preferred language for the current request.
 *
 * Priority:
 *   1. explicit `?lang=` query (highest — admin/debug override)
 *   2. `Accept-Language` header (the browser's live signal — updates the
 *      moment the user changes language in the SPA, before any JWT
 *      refresh happens)
 *   3. authenticated user's preferredLanguage (from the JWT payload —
 *      stale until next login, so used only as a fallback)
 *   4. `null` (caller treats as English)
 *
 * Earlier versions had #2 and #3 swapped, which caused language switches
 * to not take effect until the user re-logged-in: PATCH
 * /users/me/language updates the DB but doesn't re-issue the JWT, so
 * `req.user.preferredLanguage` stayed stale and was being preferred
 * over the freshly-updated Accept-Language header.
 */
// Region/script-strip a BCP-47 tag down to its base language code
// (`en-US` → `en`, `hi-IN` → `hi`, `zh-Hant` → `zh`). The translation
// table is keyed by base codes (`en`, `hi`, …); without this normalize
// step, every US-English browser triggers a translation hydrate that
// returns zero rows. Net rendering stays correct (English source
// wins by fallback) but the queries are wasted.
//
// Caveat: collapses `zh-Hans` and `zh-Hant` to the same `zh`. India
// scope has no such pair today, but worth noting if anyone adds one.
function normalizeLanguageCode(raw: string): string {
  return raw.trim().toLowerCase().split('-')[0];
}

export function preferredLanguageFromRequest(req: any): string | null {
  if (!req) return null;
  const q = req.query?.lang;
  if (typeof q === 'string' && q.trim()) return normalizeLanguageCode(q);
  const accept = req.headers?.['accept-language'];
  if (typeof accept === 'string' && accept.trim()) {
    const first = accept.split(',')[0]?.split(';')[0];
    if (first && first.trim()) return normalizeLanguageCode(first);
  }
  if (req.user?.preferredLanguage) return normalizeLanguageCode(String(req.user.preferredLanguage));
  return null;
}

export const PreferredLanguage = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null =>
    preferredLanguageFromRequest(ctx.switchToHttp().getRequest()),
);
