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
exports.KitchenStationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const kitchen_stations_service_1 = require("./kitchen-stations.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let KitchenStationsController = class KitchenStationsController {
    constructor(service) {
        this.service = service;
    }
    list(outletId) {
        return this.service.list(outletId);
    }
    listStaff(outletId) {
        return this.service.listOutletStaff(outletId);
    }
    mine(outletId, userId) {
        return this.service.findMine(outletId, userId);
    }
    create(outletId, body) {
        return this.service.create(outletId, body);
    }
    update(id, body) {
        return this.service.update(id, body);
    }
    setItems(id, body) {
        return this.service.setItems(id, body.itemIds);
    }
    delete(id) {
        return this.service.delete(id);
    }
};
exports.KitchenStationsController = KitchenStationsController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('outletId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], KitchenStationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('staff'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('outletId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], KitchenStationsController.prototype, "listStaff", null);
__decorate([
    (0, common_1.Get)('mine'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], KitchenStationsController.prototype, "mine", null);
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], KitchenStationsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], KitchenStationsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/items'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], KitchenStationsController.prototype, "setItems", null);
__decorate([
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], KitchenStationsController.prototype, "delete", null);
exports.KitchenStationsController = KitchenStationsController = __decorate([
    (0, swagger_1.ApiTags)('KitchenStations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('outlets/:outletId/kitchen-stations'),
    __metadata("design:paramtypes", [kitchen_stations_service_1.KitchenStationsService])
], KitchenStationsController);
//# sourceMappingURL=kitchen-stations.controller.js.map