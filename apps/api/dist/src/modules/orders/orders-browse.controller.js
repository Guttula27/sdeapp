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
exports.OrdersBrowseController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const orders_service_1 = require("./orders.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const preferred_language_1 = require("../../common/language/preferred-language");
let OrdersBrowseController = class OrdersBrowseController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    findAll(lang, businessId, outletId, status, page, limit) {
        return this.ordersService.findAllScoped({ businessId, outletId, status, page, limit }, lang);
    }
    findOne(id, lang) {
        return this.ordersService.findOne(id, lang);
    }
};
exports.OrdersBrowseController = OrdersBrowseController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Browse orders across outlets (read-only). Scope via query.' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, preferred_language_1.PreferredLanguage)()),
    __param(1, (0, common_1.Query)('businessId')),
    __param(2, (0, common_1.Query)('outletId')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Number, Number]),
    __metadata("design:returntype", void 0)
], OrdersBrowseController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, preferred_language_1.PreferredLanguage)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OrdersBrowseController.prototype, "findOne", null);
exports.OrdersBrowseController = OrdersBrowseController = __decorate([
    (0, swagger_1.ApiTags)('Orders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersBrowseController);
//# sourceMappingURL=orders-browse.controller.js.map