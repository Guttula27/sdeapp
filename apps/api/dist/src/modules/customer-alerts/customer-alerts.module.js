"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerAlertsModule = void 0;
const common_1 = require("@nestjs/common");
const customer_alerts_controller_1 = require("./customer-alerts.controller");
const customer_alerts_service_1 = require("./customer-alerts.service");
const lifecycle_dispatcher_service_1 = require("./lifecycle-dispatcher.service");
const notifications_module_1 = require("../notifications/notifications.module");
const orders_module_1 = require("../orders/orders.module");
let CustomerAlertsModule = class CustomerAlertsModule {
};
exports.CustomerAlertsModule = CustomerAlertsModule;
exports.CustomerAlertsModule = CustomerAlertsModule = __decorate([
    (0, common_1.Module)({
        imports: [notifications_module_1.NotificationsModule, (0, common_1.forwardRef)(() => orders_module_1.OrdersModule)],
        controllers: [customer_alerts_controller_1.CustomerAlertsController],
        providers: [customer_alerts_service_1.CustomerAlertsService, lifecycle_dispatcher_service_1.LifecycleDispatcherService],
        exports: [customer_alerts_service_1.CustomerAlertsService, lifecycle_dispatcher_service_1.LifecycleDispatcherService],
    })
], CustomerAlertsModule);
//# sourceMappingURL=customer-alerts.module.js.map