import { ForbiddenException } from '@nestjs/common';

/**
 * Pull the set of effective responsibility names off the JWT user. Auth
 * service projects them onto `user.role.responsibilities` as a flat list
 * after applying per-user grants/revokes — see auth.service.ts.
 *
 * Defensive: the role shape changed across the codebase's lifetime so we
 * accept both `{ responsibility: { name } }` (current Prisma include shape)
 * and `{ name }` (projected) forms.
 */
export function userResponsibilities(user: any): Set<string> {
  const list: any[] = user?.role?.responsibilities ?? [];
  const names = list
    .map((r) => r?.responsibility?.name ?? r?.name)
    .filter((n): n is string => typeof n === 'string');
  return new Set(names);
}

export function hasResponsibility(user: any, name: string): boolean {
  return userResponsibilities(user).has(name);
}

/**
 * Throw 403 unless the user holds `name`. Use at the top of a controller
 * handler when @UseGuards alone isn't enough.
 */
export function assertResponsibility(user: any, name: string): void {
  if (!hasResponsibility(user, name)) {
    throw new ForbiddenException(`${name} permission required`);
  }
}
