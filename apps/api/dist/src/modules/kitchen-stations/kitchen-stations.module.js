"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KitchenStationsModule = void 0;
const common_1 = require("@nestjs/common");
const kitchen_stations_controller_1 = require("./kitchen-stations.controller");
const kitchen_stations_service_1 = require("./kitchen-stations.service");
let KitchenStationsModule = class KitchenStationsModule {
};
exports.KitchenStationsModule = KitchenStationsModule;
exports.KitchenStationsModule = KitchenStationsModule = __decorate([
    (0, common_1.Module)({
        controllers: [kitchen_stations_controller_1.KitchenStationsController],
        providers: [kitchen_stations_service_1.KitchenStationsService],
        exports: [kitchen_stations_service_1.KitchenStationsService],
    })
], KitchenStationsModule);
//# sourceMappingURL=kitchen-stations.module.js.map