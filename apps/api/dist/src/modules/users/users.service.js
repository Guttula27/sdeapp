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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const translations_service_1 = require("../translations/translations.service");
const bcrypt = require("bcryptjs");
let UsersService = class UsersService {
    constructor(prisma, translations) {
        this.prisma = prisma;
        this.translations = translations;
    }
    async hydrateOrders(orders, lang) {
        if (!lang || orders.length === 0)
            return;
        const items = orders.flatMap((o) => (o.items || []).map((oi) => oi.item).filter(Boolean));
        const variants = orders.flatMap((o) => (o.items || []).map((oi) => oi.variant).filter(Boolean));
        const outlets = orders.map((o) => o.outlet).filter(Boolean);
        await Promise.all([
            this.translations.hydrate('Item', items, ['name', 'description', 'shortDescription'], lang),
            this.translations.hydrate('Variant', variants, ['name'], lang),
            this.translations.hydrate('Outlet', outlets, ['name', 'description', 'address'], lang),
        ]);
    }
    async create(data) {
        const existing = await this.prisma.user.findUnique({ where: { phone: data.phone } });
        if (existing)
            throw new common_1.ConflictException('Phone already registered');
        const { password, ...rest } = data;
        const passwordHash = await bcrypt.hash(password, 12);
        return this.prisma.user.create({
            data: { ...rest, passwordHash },
            select: { id: true, name: true, phone: true, email: true, status: true, role: { select: { id: true, name: true } } },
        });
    }
    async findAll(businessId, outletId, page, limit) {
        const p = Number(page) || 1;
        const l = Number(limit) || 20;
        const where = { ...(businessId && { businessId }), ...(outletId && { outletId }) };
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: { id: true, name: true, phone: true, email: true, status: true, createdAt: true, role: { select: { id: true, name: true } }, outlet: { select: { id: true, name: true } } },
                skip: (p - 1) * l,
                take: l,
            }),
            this.prisma.user.count({ where }),
        ]);
        return { users, total, page: p, limit: l };
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true, name: true, phone: true, email: true, status: true,
                role: { include: { responsibilities: { include: { responsibility: true } } } },
                business: true, outlet: true, createdAt: true, updatedAt: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async update(id, data) {
        return this.prisma.user.update({
            where: { id },
            data,
            select: {
                id: true, name: true, phone: true, email: true, status: true,
                preferredUpiApp: true, profileImageUrl: true, alertRingtone: true, alertVolume: true,
                updatedAt: true,
            },
        });
    }
    async updatePassword(id, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (user.passwordHash) {
            const valid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!valid)
                throw new common_1.ConflictException('Current password is incorrect');
        }
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({
            where: { id },
            data: { passwordHash, mustChangePassword: false },
        });
        return { message: 'Password updated' };
    }
    async getOrderHistory(userId, page, limit, lang) {
        const p = Number(page) || 1;
        const l = Number(limit) || 10;
        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where: { customerId: userId },
                include: {
                    items: {
                        include: {
                            item: { select: { id: true, name: true, imageUrl: true } },
                            variant: { select: { id: true, name: true } },
                            review: { select: { id: true, rating: true } },
                        },
                    },
                    outlet: { select: { id: true, name: true, logoUrl: true } },
                    payments: { select: { id: true, mode: true, status: true, amount: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (p - 1) * l,
                take: l,
            }),
            this.prisma.order.count({ where: { customerId: userId } }),
        ]);
        await this.hydrateOrders(orders, lang);
        const stats = await this.prisma.order.aggregate({
            where: { customerId: userId, status: 'SERVED' },
            _sum: { totalAmount: true },
            _count: { id: true },
        });
        return {
            orders,
            total,
            page: p,
            limit: l,
            stats: {
                totalOrders: total,
                completedOrders: stats._count.id,
                totalSpent: stats._sum.totalAmount || 0,
            },
        };
    }
    async getCustomerStats(userId, from, to, lang) {
        const end = to || new Date();
        const start = from || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        const orders = await this.prisma.order.findMany({
            where: { customerId: userId, createdAt: { gte: start, lte: end } },
            select: {
                id: true, orderNumber: true, tokenNumber: true, status: true,
                totalAmount: true, createdAt: true, outletId: true,
                outlet: { select: { id: true, name: true, logoUrl: true } },
                items: { select: { quantity: true, item: { select: { id: true, name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
        await this.hydrateOrders(orders, lang);
        const daily = {};
        const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, value: 0 }));
        let totalValue = 0;
        for (const o of orders) {
            const day = o.createdAt.toISOString().slice(0, 10);
            if (!daily[day])
                daily[day] = { date: day, orders: 0, value: 0 };
            daily[day].orders++;
            daily[day].value += Number(o.totalAmount);
            const h = o.createdAt.getHours();
            hourly[h].orders++;
            hourly[h].value += Number(o.totalAmount);
            totalValue += Number(o.totalAmount);
        }
        return {
            range: { from: start.toISOString(), to: end.toISOString() },
            totalOrders: orders.length,
            totalValue,
            daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
            hourly,
            orders,
        };
    }
    async addFavorite(userId, itemId) {
        return this.prisma.favorite.upsert({
            where: { userId_itemId: { userId, itemId } },
            create: { userId, itemId },
            update: {},
        });
    }
    async removeFavorite(userId, itemId) {
        await this.prisma.favorite.deleteMany({ where: { userId, itemId } });
        return { success: true };
    }
    async listFavorites(userId, lang) {
        const favorites = await this.prisma.favorite.findMany({
            where: { userId },
            include: {
                item: {
                    include: {
                        variants: true,
                        subcategory: { include: { category: { include: { outlet: { select: { id: true, name: true } } } } } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (lang && favorites.length) {
            const items = favorites.map((f) => f.item).filter(Boolean);
            const variants = favorites.flatMap((f) => f.item?.variants ?? []);
            const subcategories = favorites.map((f) => f.item?.subcategory).filter(Boolean);
            const categories = favorites.map((f) => f.item?.subcategory?.category).filter(Boolean);
            const outlets = favorites.map((f) => f.item?.subcategory?.category?.outlet).filter(Boolean);
            await Promise.all([
                this.translations.hydrate('Item', items, ['name', 'description', 'shortDescription'], lang),
                this.translations.hydrate('Variant', variants, ['name'], lang),
                this.translations.hydrate('Subcategory', subcategories, ['name', 'description'], lang),
                this.translations.hydrate('Category', categories, ['name', 'description'], lang),
                this.translations.hydrate('Outlet', outlets, ['name'], lang),
            ]);
        }
        return favorites;
    }
    async setPreferredLanguage(userId, code) {
        if (!code)
            throw new common_1.ConflictException('Language code is required');
        const lang = await this.prisma.language.findUnique({ where: { code } });
        if (!lang || !lang.isEnabled) {
            throw new common_1.ConflictException('Language is not available');
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: { preferredLanguage: code },
            select: { id: true, preferredLanguage: true },
        });
    }
    async toggleStatus(id) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.prisma.user.update({
            where: { id },
            data: { status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        translations_service_1.TranslationsService])
], UsersService);
//# sourceMappingURL=users.service.js.map