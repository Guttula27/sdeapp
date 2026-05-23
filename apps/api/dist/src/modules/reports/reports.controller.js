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
exports.ReportsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reports_service_1 = require("./reports.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
let ReportsController = class ReportsController {
    constructor(service) {
        this.service = service;
    }
    revenue(outletId, from, to) {
        return this.service.getRevenueReport(outletId, new Date(from), new Date(to));
    }
    itemSales(outletId, from, to) {
        return this.service.getItemSalesReport(outletId, new Date(from), new Date(to));
    }
    kitchen(outletId, from, to) {
        return this.service.getKitchenReport(outletId, new Date(from), new Date(to));
    }
    hourly(outletId, date) {
        return this.service.getHourlyOrders(outletId, new Date(date));
    }
    platformSummary(date) {
        return this.service.getPlatformSummary(date ? new Date(date) : new Date());
    }
    platformHourly(date) {
        return this.service.getPlatformHourly(date ? new Date(date) : new Date());
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('revenue'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('outletId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "revenue", null);
__decorate([
    (0, common_1.Get)('item-sales'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)('outletId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "itemSales", null);
__decorate([
    (0, common_1.Get)('kitchen'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('outletId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "kitchen", null);
__decorate([
    (0, common_1.Get)('hourly'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('outletId')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "hourly", null);
__decorate([
    (0, common_1.Get)('platform-summary'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "platformSummary", null);
__decorate([
    (0, common_1.Get)('platform-hourly'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "platformHourly", null);
exports.ReportsController = ReportsController = __decorate([
    (0, swagger_1.ApiTags)('Reports'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map