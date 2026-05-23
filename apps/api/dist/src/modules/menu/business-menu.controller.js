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
exports.BusinessMenuController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const menu_service_1 = require("./menu.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const preferred_language_1 = require("../../common/language/preferred-language");
let BusinessMenuController = class BusinessMenuController {
    constructor(menuService) {
        this.menuService = menuService;
    }
    getMenu(businessId, lang) {
        return this.menuService.getBusinessMenu(businessId, lang);
    }
    createCategory(businessId, body) {
        return this.menuService.createBusinessCategory(businessId, body);
    }
    updateCategory(id, body) {
        return this.menuService.updateBusinessCategory(id, body);
    }
    deleteCategory(id) {
        return this.menuService.deleteBusinessCategory(id);
    }
    createSubcategory(categoryId, body) {
        return this.menuService.createBusinessSubcategory(categoryId, body);
    }
    updateSubcategory(id, body) {
        return this.menuService.updateSubcategory(id, body);
    }
    createItem(subcategoryId, body) {
        return this.menuService.createBusinessItem(subcategoryId, body);
    }
    updateItem(id, body) {
        return this.menuService.updateItem(id, body);
    }
    deleteItem(id) {
        return this.menuService.deleteItem(id);
    }
    createVariant(itemId, body) {
        return this.menuService.createVariant(itemId, body);
    }
    updateVariant(id, body) {
        return this.menuService.updateVariant(id, body);
    }
    deleteVariant(id) {
        return this.menuService.deleteVariant(id);
    }
};
exports.BusinessMenuController = BusinessMenuController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('businessId')),
    __param(1, (0, preferred_language_1.PreferredLanguage)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "getMenu", null);
__decorate([
    (0, common_1.Post)('categories'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('businessId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('categories/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Post)('categories/:categoryId/subcategories'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('categoryId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "createSubcategory", null);
__decorate([
    (0, common_1.Patch)('subcategories/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "updateSubcategory", null);
__decorate([
    (0, common_1.Post)('subcategories/:subcategoryId/items'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('subcategoryId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "createItem", null);
__decorate([
    (0, common_1.Patch)('items/:id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Delete)('items/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "deleteItem", null);
__decorate([
    (0, common_1.Post)('items/:itemId/variants'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('itemId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "createVariant", null);
__decorate([
    (0, common_1.Patch)('variants/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "updateVariant", null);
__decorate([
    (0, common_1.Delete)('variants/:id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BusinessMenuController.prototype, "deleteVariant", null);
exports.BusinessMenuController = BusinessMenuController = __decorate([
    (0, swagger_1.ApiTags)('Business Menu'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('businesses/:businessId/menu'),
    __metadata("design:paramtypes", [menu_service_1.MenuService])
], BusinessMenuController);
//# sourceMappingURL=business-menu.controller.js.map