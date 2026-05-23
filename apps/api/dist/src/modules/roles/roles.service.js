"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const scope_1 = require("../../common/permissions/scope");
let RolesService = class RolesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    scopeFor(user) {
        return (0, scope_1.scopeFor)(user);
    }
    canRead(scope, role) {
        if (scope.kind === 'platform')
            return true;
        if (scope.kind === 'business')
            return role.businessId === scope.businessId;
        return role.businessId === scope.businessId;
    }
    canEdit(scope, role) {
        if (scope.kind === 'platform')
            return true;
        if (role.isSystem)
            return false;
        if (scope.kind === 'business') {
            return role.businessId === scope.businessId;
        }
        return role.businessId === scope.businessId;
    }
    assertCanRead(scope, role) {
        if (!this.canRead(scope, role)) {
            throw new common_1.ForbiddenException('You do not have access to this role');
        }
    }
    assertCanEdit(scope, role) {
        if (!this.canEdit(scope, role)) {
            if (role.isSystem)
                throw new common_1.ForbiddenException('System roles can only be edited by platform admins');
            throw new common_1.ForbiddenException('You can only edit roles in your own scope');
        }
    }
    assertGrantable(scope, responsibilityName) {
        (0, scope_1.assertGrantable)(scope, responsibilityName);
    }
    async listResponsibilities(user) {
        const scope = this.scopeFor(user);
        const all = await this.prisma.responsibility.findMany({
            orderBy: [{ module: 'asc' }, { name: 'asc' }],
        });
        return all.map((r) => ({ ...r, grantable: (0, scope_1.isGrantable)(scope, r.name) }));
    }
    async list(user) {
        const scope = this.scopeFor(user);
        const where = scope.kind === 'platform'
            ? { OR: [{ isSystem: true }, { isTemplate: true }] }
            : { businessId: scope.businessId, isTemplate: false };
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
    async findOne(user, id) {
        const scope = this.scopeFor(user);
        const role = await this.prisma.role.findUnique({
            where: { id },
            include: { responsibilities: { include: { responsibility: true } }, _count: { select: { users: true } } },
        });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
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
    async create(user, dto) {
        const name = dto.name?.trim();
        if (!name)
            throw new common_1.BadRequestException('Name is required');
        const scope = this.scopeFor(user);
        let businessId = null;
        let outletId = null;
        if (scope.kind === 'platform') {
            if (dto.outletId) {
                const outlet = await this.prisma.outlet.findUnique({ where: { id: dto.outletId }, select: { businessId: true } });
                if (!outlet)
                    throw new common_1.BadRequestException('Outlet not found');
                businessId = outlet.businessId;
                outletId = dto.outletId;
            }
            else if (dto.businessId) {
                const biz = await this.prisma.business.findUnique({ where: { id: dto.businessId }, select: { id: true } });
                if (!biz)
                    throw new common_1.BadRequestException('Business not found');
                businessId = dto.businessId;
            }
        }
        else if (scope.kind === 'business') {
            businessId = scope.businessId;
            if (dto.outletId) {
                const outlet = await this.prisma.outlet.findUnique({ where: { id: dto.outletId }, select: { businessId: true } });
                if (!outlet || outlet.businessId !== scope.businessId) {
                    throw new common_1.ForbiddenException('Outlet does not belong to your business');
                }
                outletId = dto.outletId;
            }
        }
        else {
            businessId = scope.businessId;
            outletId = scope.outletId;
        }
        const requested = (dto.responsibilityNames ?? []).filter(Boolean);
        requested.forEach((n) => this.assertGrantable(scope, n));
        const resps = requested.length
            ? await this.prisma.responsibility.findMany({ where: { name: { in: requested } }, select: { id: true, name: true } })
            : [];
        const unknown = requested.filter((n) => !resps.find((r) => r.name === n));
        if (unknown.length) {
            throw new common_1.BadRequestException(`Unknown responsibilities: ${unknown.join(', ')}`);
        }
        const duplicate = await this.prisma.role.findFirst({
            where: { name: { equals: name }, businessId, outletId },
            select: { id: true },
        });
        if (duplicate)
            throw new common_1.ConflictException('A role with this name already exists in this scope');
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
    async update(user, id, dto) {
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        this.assertCanEdit(this.scopeFor(user), role);
        if (role.isSystem)
            throw new common_1.ForbiddenException('System roles cannot be renamed');
        return this.prisma.role.update({
            where: { id },
            data: {
                name: dto.name?.trim() || undefined,
                description: dto.description === undefined ? undefined : dto.description?.trim() || null,
            },
        });
    }
    async toggleResponsibility(user, id, dto) {
        const scope = this.scopeFor(user);
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        this.assertCanEdit(scope, role);
        this.assertGrantable(scope, dto.responsibilityName);
        const responsibility = await this.prisma.responsibility.findUnique({
            where: { name: dto.responsibilityName },
            select: { id: true },
        });
        if (!responsibility)
            throw new common_1.BadRequestException('Unknown responsibility');
        const targetRoleIds = role.isTemplate
            ? [
                role.id,
                ...(await this.prisma.role.findMany({
                    where: { name: role.name, isTemplate: false, businessId: { not: null } },
                    select: { id: true },
                })).map((r) => r.id),
            ]
            : [role.id];
        if (dto.enabled) {
            await this.prisma.roleResponsibility.createMany({
                data: targetRoleIds.map((roleId) => ({ roleId, responsibilityId: responsibility.id })),
                skipDuplicates: true,
            });
        }
        else {
            await this.prisma.roleResponsibility.deleteMany({
                where: { roleId: { in: targetRoleIds }, responsibilityId: responsibility.id },
            });
        }
        return this.findOne(user, id);
    }
    async remove(user, id) {
        const role = await this.prisma.role.findUnique({
            where: { id },
            include: { _count: { select: { users: true } } },
        });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        this.assertCanEdit(this.scopeFor(user), role);
        if (role.isSystem)
            throw new common_1.ForbiddenException('System roles cannot be deleted');
        if (role._count.users > 0) {
            throw new common_1.ConflictException('Reassign all users before deleting this role');
        }
        await this.prisma.role.delete({ where: { id } });
        return { message: 'Role deleted' };
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RolesService);
//# sourceMappingURL=roles.service.js.map