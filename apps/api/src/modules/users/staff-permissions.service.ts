import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import {
  ActorScope,
  scopeFor,
  isGrantable,
  assertGrantable,
} from '../../common/permissions/scope';

export interface SetOverridesDto {
  grants?: string[];   // permission names to add on top of the user's role
  revokes?: string[];  // permission names to revoke from the user's role
}

@Injectable()
export class StaffPermissionsService {
  constructor(private prisma: PrismaService) {}

  /** Whether the actor can manage permissions for the given target staff user. */
  private canManage(scope: ActorScope, target: { businessId: string | null; outletId: string | null }): boolean {
    if (scope.kind === 'platform') return true;
    if (target.businessId !== scope.businessId) return false;
    if (scope.kind === 'business') return true;
    // outlet admin: can only manage staff in their own outlet
    return target.outletId === scope.outletId;
  }

  private assertCanManage(scope: ActorScope, target: { businessId: string | null; outletId: string | null }) {
    if (!this.canManage(scope, target)) {
      throw new ForbiddenException('You cannot manage permissions for this staff member');
    }
  }

  /**
   * Returns the role's responsibilities, the user's overrides, and the effective set.
   * Also includes whether each permission is grantable by the calling actor.
   */
  async getForUser(actor: any, targetId: string) {
    const scope = scopeFor(actor);

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        name: true,
        businessId: true,
        outletId: true,
        role: {
          select: {
            id: true,
            name: true,
            isSystem: true,
            businessId: true,
            outletId: true,
            responsibilities: {
              include: { responsibility: true },
            },
          },
        },
        responsibilities: { include: { responsibility: true } },
      },
    });
    if (!user) throw new NotFoundException('Staff member not found');
    this.assertCanManage(scope, user);

    const rolePerms = new Set(user.role?.responsibilities.map((rr) => rr.responsibility.name) ?? []);
    const grants  = new Set(user.responsibilities.filter((ur) => ur.granted).map((ur) => ur.responsibility.name));
    const revokes = new Set(user.responsibilities.filter((ur) => !ur.granted).map((ur) => ur.responsibility.name));

    const effective = new Set<string>();
    for (const name of rolePerms) if (!revokes.has(name)) effective.add(name);
    for (const name of grants) effective.add(name);

    const all = await this.prisma.responsibility.findMany({ orderBy: [{ module: 'asc' }, { name: 'asc' }] });
    const permissions = all.map((r) => ({
      id: r.id,
      name: r.name,
      module: r.module,
      description: r.description,
      inRole: rolePerms.has(r.name),
      granted: grants.has(r.name),
      revoked: revokes.has(r.name),
      effective: effective.has(r.name),
      grantable: isGrantable(scope, r.name),
    }));

    return {
      userId: user.id,
      userName: user.name,
      role: user.role
        ? { id: user.role.id, name: user.role.name, isSystem: user.role.isSystem }
        : null,
      effective: Array.from(effective).sort(),
      permissions,
    };
  }

  /**
   * Replace the user's overrides. `grants` and `revokes` are exact sets.
   * - Anything in `grants` that's already in the role is a no-op.
   * - Anything in `revokes` that's not in the role is a no-op.
   * - Each permission must be grantable by the calling actor (defends against escalation).
   */
  async setOverrides(actor: any, targetId: string, dto: SetOverridesDto) {
    const scope = scopeFor(actor);

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        businessId: true,
        outletId: true,
        role: { select: { responsibilities: { select: { responsibility: { select: { name: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('Staff member not found');
    this.assertCanManage(scope, user);

    const grants  = Array.from(new Set(dto.grants  ?? []));
    const revokes = Array.from(new Set(dto.revokes ?? []));
    const overlap = grants.filter((g) => revokes.includes(g));
    if (overlap.length) {
      throw new BadRequestException(`Permissions cannot be both granted and revoked: ${overlap.join(', ')}`);
    }

    // Validate every name + actor's right to touch each one.
    for (const name of [...grants, ...revokes]) {
      assertGrantable(scope, name);
    }

    const responsibilities = await this.prisma.responsibility.findMany({
      where: { name: { in: [...grants, ...revokes] } },
      select: { id: true, name: true },
    });
    const unknown = [...grants, ...revokes].filter((n) => !responsibilities.find((r) => r.name === n));
    if (unknown.length) {
      throw new BadRequestException(`Unknown responsibilities: ${unknown.join(', ')}`);
    }
    const idByName = new Map(responsibilities.map((r) => [r.name, r.id]));

    // Skip noop grants (already in role) — they should not create a UserResponsibility row.
    const roleNames = new Set(user.role?.responsibilities.map((rr) => rr.responsibility.name) ?? []);
    const effectiveGrants  = grants.filter((g) => !roleNames.has(g));
    const effectiveRevokes = revokes.filter((r) => roleNames.has(r));

    await this.prisma.$transaction([
      this.prisma.userResponsibility.deleteMany({ where: { userId: targetId } }),
      this.prisma.userResponsibility.createMany({
        data: [
          ...effectiveGrants.map((n) => ({ userId: targetId, responsibilityId: idByName.get(n)!, granted: true })),
          ...effectiveRevokes.map((n) => ({ userId: targetId, responsibilityId: idByName.get(n)!, granted: false })),
        ],
      }),
    ]);

    return this.getForUser(actor, targetId);
  }
}
