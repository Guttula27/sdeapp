/**
 * Resolve the customer-facing origin (the PWA host) from the admin app.
 *
 * QR codes printed by the admin must point at the customer PWA, not at
 * the admin host. Three resolution rules in priority order:
 *
 *   1. VITE_CUSTOMER_URL — set in the build env. Always wins. This is the
 *      production-correct path: each env (staging / prod) sets its own
 *      value in .env or the deploy pipeline so the QR encodes the right
 *      host without code changes.
 *
 *   2. Local-dev fallback — admin runs on :5173, customer PWA on :5174.
 *      Swap ports if we're on the dev origin.
 *
 *   3. Prod convention fallback — the platform's subdomain convention is
 *      `admin.<root>` for the admin SPA, `order.<root>` for the customer
 *      PWA. If we're on `admin.<root>` and the build env didn't ship a
 *      VITE_CUSTOMER_URL, swap the subdomain. Without this rule the QR
 *      encodes admin.vezeor.cloud and the scan lands on the admin login.
 *
 * The previous shorthand `(window as any).VITE_CUSTOMER_URL` never gets
 * populated on prod builds (Vite inlines import.meta.env at build time;
 * it doesn't write to window). That's why this util exists.
 */
export function getCustomerOrigin(): string {
  const explicit = (import.meta as any).env?.VITE_CUSTOMER_URL as string | undefined;
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes(':5173')) return origin.replace(':5173', ':5174');
    if (/^https?:\/\/admin\./.test(origin)) {
      return origin.replace(/^(https?:\/\/)admin\./, '$1order.');
    }
  }
  return 'http://localhost:5174';
}
