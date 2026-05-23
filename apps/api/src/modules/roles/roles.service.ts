import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import {
  ActorScope,
  PLATFORM_ONLY,
  BUSINESS_ONLY,
  scopeFor,
  isGrantable,
  assertGrantable,
} from '../../common/permissions/scope';

export interface CreateRoleDto {
  name: string;
  description?: string;
  businessId?: string;
  outletId?: string;
  responsibilityNames?: string[];
}

export interface ToggleResponsibilityDto {
  responsibilityName: string;
  enabled: boolean;
}

type Scope = ActorScope;

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /** Resolve the actor's scope. */
  private scopeFor(user: any): Scope {
    return scopeFor(user);
  }

  /** Whether the actor can read this role (visibility-only check). */
  private canRead(scope: Scope, role: { businessId: string | null; outletId: string | null }): boolean {
    if (scope.kind === 'platform') return true;
    if (scope.kind === 'business') return role.businessId === scope.businessId;
    // outlet: can read roles in their business (helps see what's available)
    return role.businessId === scope.businessId;
  }

  /** Whether the actor can mutate this role. */
  private canEdit(scope: Scope, role: { businessId: string | null; outletId: string | null; isSystem: boolean }): boolean {
    if (scope.kind === 'platform') return true; // platform admin can edit any role (incl. system + templates)
    if (role.isSystem) return false;
    if (scope.kind === 'business') {
      return role.businessId === scope.businessId;
    }
    // outlet admin can edit any role inside their business — including
    // business-scoped roles whose outletId is null. Templates live at
    // platform scope (businessId null) so they're excluded automatically.
    return role.businessId === scope.businessId;
  }

  /** Throws unless the actor can read the given role. */
  private assertCanRead(scope: Scope, role: { businessId: string | null; outletId: string | null }) {
    if (!this.canRead(scope, role)) {
      throw new ForbiddenException('You do not have access to this role');
    }
  }

  /** Throws unless the actor can mutate the given role. */
  private assertCanEdit(scope: Scope, role: { businessId: string | null; outletId: string | null; isSystem: boolean }) {
    if (!this.canEdit(scope, role)) {
      if (role.isSystem) throw new ForbiddenException('System roles can only be edited by platform admins');
      throw new ForbiddenException('You can only edit roles in your own scope');
    }
  }

  /** Throws if the actor isn't allowed to grant this permission. */
  private assertGrantable(scope: Scope, responsibilityName: string) {
    assertGrantable(scope, responsibilityName);
  }

  /** Catalogue of all responsibilities, optionally filtered to what the actor can grant. */
  async listResponsibilities(user: any) {
    const scope = this.scopeFor(user);
    const all = await this.prisma.responsibility.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
    return all.map((r) => ({ ...r, grantable: isGrantable(scope, r.name) }));
  }

  /** List roles visible to the actor (read-scope; mutability surfaced via `editable`). */
  async list(user: any) {
    const scope = this.scopeFor(user);
    // Platform admin sees only platform-level roles (system + templates).
    // Per-tenant copies of template roles are hidden here and managed from
    // within each business's own Roles page.
    const where =
      scope.kind === 'platform'
        ? { OR: [{ isSystem: true }, { isTemplate: true }] }
        : { businessId: scope.businessId, isTemplate: false }; // owners + outlet admins see every role in their business

    const roles = await this.prisma.role.findMany({
      where,
      include: {
        responsibilities: { include: { responsibility: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      businessId: r.businessId,
      outletId: r.outletId,
      userCount: r._count.users,
      responsibilities: r.responsibilities.map((rr) => rr.responsibility.name),
      editable: this.canEdit(scope, r),
    }));
  }

  async findOne(user: any, id: string) {
    const scope = this.scopeFor(user);
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { responsibilities: { include: { responsibility: true } }, _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    this.assertCanRead(scope, role);
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      businessId: role.businessId,
      outletId: role.outletId,
      userCount: role._count.users,
      responsibilities: role.responsibilities.map((rr) => rr.responsibility.name),
      editable: this.canEdit(scope, role),
    };
  }

  async create(user: any, dto: CreateRoleDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Name is required');

    const scope = this.scopeFor(user);

    // Resolve the target scope: businessId/outletId on the new role.
    let businessId: string | null = null;
    let outletId: string | null = null;

    if (scope.kind === 'platform') {
      // Platform admin chooses freely. outletId requires businessId.
      if (dto.outletId) {
        const outlet = await this.prisma.outlet.findUnique({ where: { id: dto.outletId }, select: { businessId: true } });
        if (!outlet) throw new BadRequestException('Outlet not found');
        businessId = outlet.businessId;
        outletId = dto.outletId;
      } else if (dto.businessId) {
        const biz = await this.prisma.business.findUnique({ where: { id: dto.businessId }, select: { id: true } });
        if (!biz) throw new BadRequestException('Business not found');
        businessId = dto.businessId;
      }
    } else if (scope.kind === 'business') {
      businessId = scope.businessId;
      if (dto.outletId) {
        const outlet = await this.prisma.outlet.findUnique({ where: { id: dto.outletId }, select: { businessId: true } });
        if (!outlet || outlet.businessId !== scope.businessId) {
          throw new ForbiddenException('Outlet does not belong to your business');
        }
        outletId = dto.outletId;
      }
    } else {
      // Outlet admin can only create outlet-scoped roles in their own outlet.
      businessId = scope.businessId;
      outletId = scope.outletId;
    }

    // Enforce permission grantability for every requested responsibility.
    const requested = (dto.responsibilityNames ?? []).filter(Boolean);
    requested.forEach((n) => this.assertGrantable(scope, n));

    // Look up responsibility ids.
    const resps = requested.length
      ? await this.prisma.responsibility.findMany({ where: { name: { in: requested } }, select: { id: true, name: true } })
      : [];
    const unknown = requested.filter((n) => !resps.find((r) => r.name === n));
    if (unknown.length) {
      throw new BadRequestException(`Unknown responsibilities: ${unknown.join(', ')}`);
    }

    // Uniqueness check within the scope (case-insensitive).
    const duplicate = await this.prisma.role.findFirst({
      // MySQL's default collation is case-insensitive, so `equals` is the
      // right operator (Prisma doesn't accept `mode` on the MySQL connector).
      where: { name: { equals: name }, businessId, outletId },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('A role with this name already exists in this scope');

    const role = await this.prisma.role.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        businessId,
        outletId,
        responsibilities: { create: resps.map((r) => ({ responsibilityId: r.id })) },
      },
      include: { responsibilities: { include: { responsibility: true } } },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      businessId: role.businessId,
      outletId: role.outletId,
      userCount: 0,
      responsibilities: role.responsibilities.map((rr) => rr.responsibility.name),
    };
  }

  async update(user: any, id: string, dto: Partial<Pick<CreateRoleDto, 'name' | 'description'>>) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    this.assertCanEdit(this.scopeFor(user), role);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be renamed');

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name?.trim() || undefined,
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
      },
    });
  }

  async toggleResponsibility(user: any, id: string, dto: ToggleResponsibilityDto) {
    const scope = this.scopeFor(user);

    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    this.assertCanEdit(scope, role);
    this.assertGrantable(scope, dto.responsibilityName);

    const responsibility = await this.prisma.responsibility.findUnique({
      where: { name: dto.responsibilityName },
      select: { id: true },
    });
    if (!responsibility) throw new BadRequestException('Unknown responsibility');

    // Targets to mutate: the role itself, plus every per-business copy when
    // this is a template (so platform-admin edits propagate to tenants).
    const targetRoleIds = role.isTemplate
      ? [
          role.id,
          ...(
            await this.prisma.role.findMany({
              where: { name: role.name, isTemplate: false, businessId: { not: null } },
              select: { id: true },
            })
          ).map((r) => r.id),
        ]
      : [role.id];

    if (dto.enabled) {
      await this.prisma.roleResponsibility.createMany({
        data: targetRoleIds.map((roleId) => ({ roleId, responsibilityId: responsibility.id })),
        skipDuplicates: true,
      });
    } else {
      await this.prisma.roleResponsibility.deleteMany({
        where: { roleId: { in: targetRoleIds }, responsibilityId: responsibility.id },
      });
    }

    return this.findOne(user, id);
  }

  async remove(user: any, id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    this.assertCanEdit(this.scopeFor(user), role);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');
    if (role._count.users > 0) {
      throw new ConflictException('Reassign all users before deleting this role');
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  }
}
