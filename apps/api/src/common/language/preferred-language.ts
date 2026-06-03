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
export function preferredLanguageFromRequest(req: any): string | null {
  if (!req) return null;
  const q = req.query?.lang;
  if (typeof q === 'string' && q.trim()) return q.trim().toLowerCase();
  const accept = req.headers?.['accept-language'];
  if (typeof accept === 'string' && accept.trim()) {
    const first = accept.split(',')[0]?.split(';')[0]?.trim().toLowerCase();
    if (first) return first;
  }
  if (req.user?.preferredLanguage) return String(req.user.preferredLanguage).toLowerCase();
  return null;
}

export const PreferredLanguage = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null =>
    preferredLanguageFromRequest(ctx.switchToHttp().getRequest()),
);
