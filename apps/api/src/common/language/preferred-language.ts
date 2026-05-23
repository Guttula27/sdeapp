import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Resolves the preferred language for the current request.
 * Priority: explicit `?lang=` query → authenticated user's preferredLanguage →
 * `Accept-Language` header (first tag) → `null` (caller treats as English).
 */
export function preferredLanguageFromRequest(req: any): string | null {
  if (!req) return null;
  const q = req.query?.lang;
  if (typeof q === 'string' && q.trim()) return q.trim().toLowerCase();
  if (req.user?.preferredLanguage) return String(req.user.preferredLanguage).toLowerCase();
  const accept = req.headers?.['accept-language'];
  if (typeof accept === 'string' && accept.trim()) {
    const first = accept.split(',')[0]?.split(';')[0]?.trim().toLowerCase();
    if (first) return first;
  }
  return null;
}

export const PreferredLanguage = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null =>
    preferredLanguageFromRequest(ctx.switchToHttp().getRequest()),
);
