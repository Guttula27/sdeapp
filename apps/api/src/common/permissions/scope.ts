import { ForbiddenException } from '@nestjs/common';

// Platform-only perms are never grantable by business owners or outlet admins.
export const PLATFORM_ONLY = new Set([
  'PLATFORM_ADMIN',
  'VIEW_PLATFORM_REPORTS',
  'MANAGE_LEADS',
  'MANAGE_PLANS',
]);

// Outlet admins additionally cannot grant business-scope perms.
export const BUSINESS_ONLY = new Set([
  'MANAGE_BUSINESSES',
  'MANAGE_BUSINESS_IMAGES',
  'MANAGE_SUBSCRIPTIONS',
  'VIEW_INVOICES',
]);

export type ActorScope =
  | { kind: 'platform' }
  | { kind: 'business'; businessId: string }
  | { kind: 'outlet'; businessId: string; outletId: string };

export function scopeFor(user: any): ActorScope {
  if (!user?.businessId && !user?.outletId) return { kind: 'platform' };
  if (user.businessId && !user.outletId) {
    return { kind: 'business', businessId: user.businessId };
  }
  return { kind: 'outlet', businessId: user.businessId, outletId: user.outletId };
}

export function isGrantable(scope: ActorScope, responsibilityName: string): boolean {
  if (scope.kind === 'platform') return true;
  if (PLATFORM_ONLY.has(responsibilityName)) return false;
  if (scope.kind === 'outlet' && BUSINESS_ONLY.has(responsibilityName)) return false;
  return true;
}

export function assertGrantable(scope: ActorScope, responsibilityName: string): void {
  if (isGrantable(scope, responsibilityName)) return;
  if (PLATFORM_ONLY.has(responsibilityName)) {
    throw new ForbiddenException(`${responsibilityName} can only be granted by a platform admin`);
  }
  throw new ForbiddenException(`${responsibilityName} can only be granted at the business level`);
}
