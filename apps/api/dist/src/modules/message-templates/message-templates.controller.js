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
exports.MessageTemplatesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const message_templates_service_1 = require("./message-templates.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let MessageTemplatesController = class MessageTemplatesController {
    constructor(service) {
        this.service = service;
    }
    list(user, channel, status, scope) {
        return this.service.list(user, { channel, status, scope });
    }
    pending() {
        return this.service.pendingQueue();
    }
    create(user, dto) {
        return this.service.create(user, dto);
    }
    update(id, user, dto) {
        return this.service.update(id, user, dto);
    }
    remove(id, user) {
        return this.service.remove(id, user);
    }
    submit(id, user) {
        return this.service.submit(id, user);
    }
    forward(id, dto) {
        return this.service.forwardToProvider(id, dto);
    }
    approve(id, dto = {}) {
        return this.service.markApproved(id, dto);
    }
    reject(id, dto) {
        return this.service.reject(id, dto);
    }
};
exports.MessageTemplatesController = MessageTemplatesController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('channel')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('pending'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "pending", null);
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, message_templates_service_1.UpsertTemplateDto]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/forward-to-provider'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_templates_service_1.ApproveProviderDto]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "forward", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_templates_service_1.RejectTemplateDto]),
    __metadata("design:returntype", void 0)
], MessageTemplatesController.prototype, "reject", null);
exports.MessageTemplatesController = MessageTemplatesController = __decorate([
    (0, swagger_1.ApiTags)('Message Templates'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('message-templates'),
    __metadata("design:paramtypes", [message_templates_service_1.MessageTemplatesService])
], MessageTemplatesController);
//# sourceMappingURL=message-templates.controller.js.map