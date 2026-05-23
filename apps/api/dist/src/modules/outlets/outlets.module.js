"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutletsModule = void 0;
const common_1 = require("@nestjs/common");
const outlets_controller_1 = require("./outlets.controller");
const outlets_service_1 = require("./outlets.service");
let OutletsModule = class OutletsModule {
};
exports.OutletsModule = OutletsModule;
exports.OutletsModule = OutletsModule = __decorate([
    (0, common_1.Module)({
        controllers: [outlets_controller_1.OutletsController],
        providers: [outlets_service_1.OutletsService],
        exports: [outlets_service_1.OutletsService],
    })
], OutletsModule);
//# sourceMappingURL=outlets.module.js.map