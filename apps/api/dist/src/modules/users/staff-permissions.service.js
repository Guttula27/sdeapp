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
exports.StaffPermissionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const scope_1 = require("../../common/permissions/scope");
let StaffPermissionsService = class StaffPermissionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    canManage(scope, target) {
        if (scope.kind === 'platform')
            return true;
        if (target.businessId !== scope.businessId)
            return false;
        if (scope.kind === 'business')
            return true;
        return target.outletId === scope.outletId;
    }
    assertCanManage(scope, target) {
        if (!this.canManage(scope, target)) {
            throw new common_1.ForbiddenException('You cannot manage permissions for this staff member');
        }
    }
    async getForUser(actor, targetId) {
        const scope = (0, scope_1.scopeFor)(actor);
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
        if (!user)
            throw new common_1.NotFoundException('Staff member not found');
        this.assertCanManage(scope, user);
        const rolePerms = new Set(user.role?.responsibilities.map((rr) => rr.responsibility.name) ?? []);
        const grants = new Set(user.responsibilities.filter((ur) => ur.granted).map((ur) => ur.responsibility.name));
        const revokes = new Set(user.responsibilities.filter((ur) => !ur.granted).map((ur) => ur.responsibility.name));
        const effective = new Set();
        for (const name of rolePerms)
            if (!revokes.has(name))
                effective.add(name);
        for (const name of grants)
            effective.add(name);
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
            grantable: (0, scope_1.isGrantable)(scope, r.name),
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
    async setOverrides(actor, targetId, dto) {
        const scope = (0, scope_1.scopeFor)(actor);
        const user = await this.prisma.user.findUnique({
            where: { id: targetId },
            select: {
                id: true,
                businessId: true,
                outletId: true,
                role: { select: { responsibilities: { select: { responsibility: { select: { name: true } } } } } },
            },
        });
        if (!user)
            throw new common_1.NotFoundException('Staff member not found');
        this.assertCanManage(scope, user);
        const grants = Array.from(new Set(dto.grants ?? []));
        const revokes = Array.from(new Set(dto.revokes ?? []));
        const overlap = grants.filter((g) => revokes.includes(g));
        if (overlap.length) {
            throw new common_1.BadRequestException(`Permissions cannot be both granted and revoked: ${overlap.join(', ')}`);
        }
        for (const name of [...grants, ...revokes]) {
            (0, scope_1.assertGrantable)(scope, name);
        }
        const responsibilities = await this.prisma.responsibility.findMany({
            where: { name: { in: [...grants, ...revokes] } },
            select: { id: true, name: true },
        });
        const unknown = [...grants, ...revokes].filter((n) => !responsibilities.find((r) => r.name === n));
        if (unknown.length) {
            throw new common_1.BadRequestException(`Unknown responsibilities: ${unknown.join(', ')}`);
        }
        const idByName = new Map(responsibilities.map((r) => [r.name, r.id]));
        const roleNames = new Set(user.role?.responsibilities.map((rr) => rr.responsibility.name) ?? []);
        const effectiveGrants = grants.filter((g) => !roleNames.has(g));
        const effectiveRevokes = revokes.filter((r) => roleNames.has(r));
        await this.prisma.$transaction([
            this.prisma.userResponsibility.deleteMany({ where: { userId: targetId } }),
            this.prisma.userResponsibility.createMany({
                data: [
                    ...effectiveGrants.map((n) => ({ userId: targetId, responsibilityId: idByName.get(n), granted: true })),
                    ...effectiveRevokes.map((n) => ({ userId: targetId, responsibilityId: idByName.get(n), granted: false })),
                ],
            }),
        ]);
        return this.getForUser(actor, targetId);
    }
};
exports.StaffPermissionsService = StaffPermissionsService;
exports.StaffPermissionsService = StaffPermissionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StaffPermissionsService);
//# sourceMappingURL=staff-permissions.service.js.map