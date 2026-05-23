"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerTagsModule = void 0;
const common_1 = require("@nestjs/common");
const customer_tags_controller_1 = require("./customer-tags.controller");
const customer_tags_service_1 = require("./customer-tags.service");
let CustomerTagsModule = class CustomerTagsModule {
};
exports.CustomerTagsModule = CustomerTagsModule;
exports.CustomerTagsModule = CustomerTagsModule = __decorate([
    (0, common_1.Module)({
        controllers: [customer_tags_controller_1.CustomerTagsController],
        providers: [customer_tags_service_1.CustomerTagsService],
        exports: [customer_tags_service_1.CustomerTagsService],
    })
], CustomerTagsModule);
//# sourceMappingURL=customer-tags.module.js.map