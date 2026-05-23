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
exports.TableTypesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const table_types_service_1 = require("./table-types.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
let TableTypesController = class TableTypesController {
    constructor(service) {
        this.service = service;
    }
    list(outletId) {
        return this.service.list(outletId);
    }
    create(outletId, body) {
        return this.service.create(outletId, body);
    }
    update(id, body) {
        return this.service.update(id, body);
    }
    remove(id) {
        return this.service.remove(id);
    }
    setItemPrice(tableTypeId, itemId, variantId, body) {
        const gst = body.gstRate === undefined ? undefined : body.gstRate === null ? null : Number(body.gstRate);
        return this.service.setItemPrice(tableTypeId, itemId, Number(body.price), variantId, gst);
    }
    clearItemPrice(tableTypeId, itemId, variantId) {
        return this.service.clearItemPrice(tableTypeId, itemId, variantId);
    }
    addTable(outletId, tableTypeId, body) {
        return this.service.addTable(outletId, tableTypeId, body);
    }
    removeTable(tableId) {
        return this.service.removeTable(tableId);
    }
};
exports.TableTypesController = TableTypesController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('outletId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "remove", null);
__decorate([
    (0, common_1.Put)(':tableTypeId/prices/:itemId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('tableTypeId')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, common_1.Query)('variantId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "setItemPrice", null);
__decorate([
    (0, common_1.Delete)(':tableTypeId/prices/:itemId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('tableTypeId')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, common_1.Query)('variantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "clearItemPrice", null);
__decorate([
    (0, common_1.Post)(':tableTypeId/tables'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, common_1.Param)('tableTypeId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "addTable", null);
__decorate([
    (0, common_1.Delete)('tables/:tableId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('tableId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TableTypesController.prototype, "removeTable", null);
exports.TableTypesController = TableTypesController = __decorate([
    (0, swagger_1.ApiTags)('TableTypes'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('outlets/:outletId/table-types'),
    __metadata("design:paramtypes", [table_types_service_1.TableTypesService])
], TableTypesController);
//# sourceMappingURL=table-types.controller.js.map