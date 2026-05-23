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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const CUSTOMER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const CUSTOMER_JWT_EXPIRY = '30d';
const TEST_CUSTOMER_OTP = '123789';
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
        if (existing)
            throw new common_1.ConflictException('Phone number already registered');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                passwordHash,
            },
            select: { id: true, name: true, phone: true, email: true, status: true, createdAt: true },
        });
        const tokens = this.generateTokens(user.id, user.phone);
        return { user, ...tokens };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { phone: dto.phone },
            include: { role: { include: { responsibilities: { include: { responsibility: true } } } } },
        });
        if (!user || !user.passwordHash)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (user.status !== 'ACTIVE')
            throw new common_1.UnauthorizedException('Account is not active');
        const isValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isValid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        await this.prisma.session.create({
            data: {
                userId: user.id,
                token: this.jwtService.sign({ sub: user.id }),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        const { passwordHash, ...safeUser } = user;
        const tokens = this.generateTokens(user.id, user.phone);
        return { user: safeUser, ...tokens };
    }
    async logout(userId, token) {
        await this.prisma.session.deleteMany({ where: { userId, token } });
        return { message: 'Logged out successfully' };
    }
    async requestCustomerOtp(dto) {
        const phone = (dto.phone || '').trim();
        if (!phone)
            throw new common_1.BadRequestException('Phone is required');
        const existing = await this.prisma.user.findUnique({ where: { phone } });
        if (existing && existing.businessId) {
            throw new common_1.UnauthorizedException('Use the staff portal to sign in with this number');
        }
        console.log(`[OTP] phone=${phone} otp=${TEST_CUSTOMER_OTP} (test mode)`);
        return { message: 'OTP sent', phone };
    }
    async verifyCustomerOtp(dto) {
        const phone = (dto.phone || '').trim();
        if (!phone)
            throw new common_1.BadRequestException('Phone is required');
        if (dto.otp !== TEST_CUSTOMER_OTP)
            throw new common_1.UnauthorizedException('Invalid OTP');
        let user = await this.prisma.user.findUnique({
            where: { phone },
            include: { role: { include: { responsibilities: { include: { responsibility: true } } } } },
        });
        if (user && user.businessId) {
            throw new common_1.UnauthorizedException('Use the staff portal to sign in with this number');
        }
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    name: dto.name?.trim() || `Guest ${phone.slice(-4)}`,
                    phone,
                    status: 'ACTIVE',
                },
                include: { role: { include: { responsibilities: { include: { responsibility: true } } } } },
            });
        }
        else if (user.status !== 'ACTIVE') {
            throw new common_1.UnauthorizedException('Account is not active');
        }
        const accessToken = this.jwtService.sign({ sub: user.id, phone: user.phone }, { expiresIn: CUSTOMER_JWT_EXPIRY });
        const refreshToken = this.jwtService.sign({ sub: user.id, phone: user.phone }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: CUSTOMER_JWT_EXPIRY });
        await this.prisma.session.create({
            data: {
                userId: user.id,
                token: accessToken,
                expiresAt: new Date(Date.now() + CUSTOMER_SESSION_MS),
            },
        });
        const { passwordHash, ...safeUser } = user;
        return { user: safeUser, accessToken, refreshToken };
    }
    async validateUser(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                status: true,
                preferredUpiApp: true,
                preferredLanguage: true,
                profileImageUrl: true,
                alertRingtone: true,
                alertVolume: true,
                mustChangePassword: true,
                businessId: true,
                outletId: true,
                role: {
                    include: { responsibilities: { include: { responsibility: true } } },
                },
                responsibilities: { include: { responsibility: true } },
            },
        });
        if (!user)
            return null;
        const rolePerms = user.role?.responsibilities ?? [];
        const grants = user.responsibilities.filter((ur) => ur.granted);
        const revokes = new Set(user.responsibilities.filter((ur) => !ur.granted).map((ur) => ur.responsibility.name));
        const effective = [];
        const seen = new Set();
        for (const rp of rolePerms) {
            if (revokes.has(rp.responsibility.name))
                continue;
            effective.push(rp);
            seen.add(rp.responsibility.name);
        }
        for (const g of grants) {
            if (seen.has(g.responsibility.name))
                continue;
            effective.push({ roleId: user.role?.id ?? '', responsibilityId: g.responsibilityId, responsibility: g.responsibility });
            seen.add(g.responsibility.name);
        }
        const { responsibilities: _overrides, ...rest } = user;
        return {
            ...rest,
            role: user.role ? { ...user.role, responsibilities: effective } : null,
        };
    }
    generateTokens(userId, phone) {
        const payload = { sub: userId, phone };
        return {
            accessToken: this.jwtService.sign(payload),
            refreshToken: this.jwtService.sign(payload, {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: '7d',
            }),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map