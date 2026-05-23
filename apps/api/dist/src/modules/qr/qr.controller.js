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
exports.QrController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const qr_service_1 = require("./qr.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let QrController = class QrController {
    constructor(service) {
        this.service = service;
    }
    generateOutlet(outletId) {
        const customerUrl = process.env.CUSTOMER_URL || 'http://localhost:5174';
        return this.service.generateOutletQR(outletId, customerUrl);
    }
    generateTable(tableId, outletId) {
        const customerUrl = process.env.CUSTOMER_URL || 'http://localhost:5174';
        return this.service.generateTableQR(tableId, outletId, customerUrl);
    }
    validate(code) {
        return this.service.validateQR(code);
    }
    getOutletQRs(outletId) {
        return this.service.getOutletQRs(outletId);
    }
};
exports.QrController = QrController;
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('outlet/:outletId'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('outletId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QrController.prototype, "generateOutlet", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('table/:tableId'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('tableId')),
    __param(1, (0, common_1.Query)('outletId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], QrController.prototype, "generateTable", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('validate/:code'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QrController.prototype, "validate", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('outlet/:outletId'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('outletId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QrController.prototype, "getOutletQRs", null);
exports.QrController = QrController = __decorate([
    (0, swagger_1.ApiTags)('QR Codes'),
    (0, common_1.Controller)('qr'),
    __metadata("design:paramtypes", [qr_service_1.QrService])
], QrController);
//# sourceMappingURL=qr.controller.js.map