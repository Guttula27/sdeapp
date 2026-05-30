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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutletsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const outlets_service_1 = require("./outlets.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const preferred_language_1 = require("../../common/language/preferred-language");
let OutletsController = class OutletsController {
    constructor(service) {
        this.service = service;
    }
    create(dto) {
        return this.service.create(dto);
    }
    findByBusiness(businessId, lang) {
        return this.service.findByBusiness(businessId, lang);
    }
    publicList() {
        return this.service.listPublic();
    }
    findOne(id, lang) {
        return this.service.findOne(id, lang);
    }
    dashboard(id) {
        return this.service.getDashboard(id);
    }
    update(id, dto) {
        return this.service.update(id, dto);
    }
    createSection(outletId, dto) {
        return this.service.createSection(outletId, dto);
    }
    getSections(outletId) {
        return this.service.getSections(outletId);
    }
    createTable(outletId, dto) {
        return this.service.createTable(outletId, dto);
    }
    admin(id) {
        return this.service.findAdmin(id);
    }
    addImage(id, body) {
        return this.service.addImage(id, body.url);
    }
    removeImage(imageId) {
        return this.service.removeImage(imageId);
    }
    openStatus(id) {
        return this.service.getOpenStatus(id);
    }
    getTokenCounter(id) {
        return this.service.getTokenCounter(id);
    }
    setTokenCounter(id, body) {
        return this.service.setTokenCounter(id, body);
    }
    resetTokenCounter(id) {
        return this.service.resetTokenCounter(id);
    }
    getHours(id) {
        return this.service.getHours(id);
    }
    setHours(id, body) {
        return this.service.setHours(id, body.ranges || []);
    }
};
exports.OutletsController = OutletsController;
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [outlets_service_1.CreateOutletDto]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('business/:businessId'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('businessId')),
    __param(1, (0, preferred_language_1.PreferredLanguage)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "findByBusiness", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('public-list'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "publicList", null);
__decorate([
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, preferred_language_1.PreferredLanguage)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/dashboard'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':outletId/sections'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, outlets_service_1.CreateSectionDto]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "createSection", null);
__decorate([
    (0, common_1.Get)(':outletId/sections'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('outletId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "getSections", null);
__decorate([
    (0, common_1.Post)(':outletId/tables'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, outlets_service_1.CreateTableDto]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "createTable", null);
__decorate([
    (0, common_1.Get)(':id/admin'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "admin", null);
__decorate([
    (0, common_1.Post)(':id/images'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "addImage", null);
__decorate([
    (0, common_1.Delete)(':id/images/:imageId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('imageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "removeImage", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/open-status'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "openStatus", null);
__decorate([
    (0, common_1.Get)(':id/token-counter'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "getTokenCounter", null);
__decorate([
    (0, common_1.Patch)(':id/token-counter'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "setTokenCounter", null);
__decorate([
    (0, common_1.Post)(':id/token-counter/reset'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "resetTokenCounter", null);
__decorate([
    (0, common_1.Get)(':id/hours'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "getHours", null);
__decorate([
    (0, common_1.Put)(':id/hours'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OutletsController.prototype, "setHours", null);
exports.OutletsController = OutletsController = __decorate([
    (0, swagger_1.ApiTags)('Outlets'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('outlets'),
    __metadata("design:paramtypes", [outlets_service_1.OutletsService])
], OutletsController);
//# sourceMappingURL=outlets.controller.js.map