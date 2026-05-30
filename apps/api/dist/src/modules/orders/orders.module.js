"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const orders_controller_1 = require("./orders.controller");
const orders_browse_controller_1 = require("./orders-browse.controller");
const orders_service_1 = require("./orders.service");
const orders_gateway_1 = require("./orders.gateway");
const customer_alerts_module_1 = require("../customer-alerts/customer-alerts.module");
const pricing_module_1 = require("../pricing/pricing.module");
const rewards_module_1 = require("../rewards/rewards.module");
const coupons_module_1 = require("../coupons/coupons.module");
const service_stations_module_1 = require("../service-stations/service-stations.module");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => customer_alerts_module_1.CustomerAlertsModule),
            pricing_module_1.PricingModule,
            rewards_module_1.RewardsModule,
            coupons_module_1.CouponsModule,
            service_stations_module_1.ServiceStationsModule,
        ],
        controllers: [orders_browse_controller_1.OrdersBrowseController, orders_controller_1.OrdersController],
        providers: [orders_service_1.OrdersService, orders_gateway_1.OrdersGateway],
        exports: [orders_service_1.OrdersService, orders_gateway_1.OrdersGateway],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map