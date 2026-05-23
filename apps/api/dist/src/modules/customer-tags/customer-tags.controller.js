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
exports.CustomerTagsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const customer_tags_service_1 = require("./customer-tags.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const preferred_language_1 = require("../../common/language/preferred-language");
let CustomerTagsController = class CustomerTagsController {
    constructor(service) {
        this.service = service;
    }
    list(outletId, lang) {
        return this.service.list(outletId, lang);
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
    setItemPrice(tagId, itemId, variantId, body) {
        const gst = body.gstRate === undefined ? undefined : body.gstRate === null ? null : Number(body.gstRate);
        return this.service.setItemPrice(tagId, itemId, Number(body.price), variantId, gst);
    }
    clearItemPrice(tagId, itemId, variantId) {
        return this.service.clearItemPrice(tagId, itemId, variantId);
    }
};
exports.CustomerTagsController = CustomerTagsController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, preferred_language_1.PreferredLanguage)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CustomerTagsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('outletId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CustomerTagsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CustomerTagsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomerTagsController.prototype, "remove", null);
__decorate([
    (0, common_1.Put)(':tagId/prices/:itemId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('tagId')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, common_1.Query)('variantId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", void 0)
], CustomerTagsController.prototype, "setItemPrice", null);
__decorate([
    (0, common_1.Delete)(':tagId/prices/:itemId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('tagId')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, common_1.Query)('variantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], CustomerTagsController.prototype, "clearItemPrice", null);
exports.CustomerTagsController = CustomerTagsController = __decorate([
    (0, swagger_1.ApiTags)('CustomerTags'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('outlets/:outletId/customer-tags'),
    __metadata("design:paramtypes", [customer_tags_service_1.CustomerTagsService])
], CustomerTagsController);
//# sourceMappingURL=customer-tags.controller.js.map