"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const bull_1 = require("@nestjs/bull");
const prisma_module_1 = require("./config/prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const businesses_module_1 = require("./modules/businesses/businesses.module");
const outlets_module_1 = require("./modules/outlets/outlets.module");
const menu_module_1 = require("./modules/menu/menu.module");
const orders_module_1 = require("./modules/orders/orders.module");
const payments_module_1 = require("./modules/payments/payments.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const vendors_module_1 = require("./modules/vendors/vendors.module");
const subscriptions_module_1 = require("./modules/subscriptions/subscriptions.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const qr_module_1 = require("./modules/qr/qr.module");
const reports_module_1 = require("./modules/reports/reports.module");
const disputes_module_1 = require("./modules/disputes/disputes.module");
const leads_module_1 = require("./modules/leads/leads.module");
const kitchen_stations_module_1 = require("./modules/kitchen-stations/kitchen-stations.module");
const service_stations_module_1 = require("./modules/service-stations/service-stations.module");
const customer_tags_module_1 = require("./modules/customer-tags/customer-tags.module");
const customers_module_1 = require("./modules/customers/customers.module");
const toppings_module_1 = require("./modules/toppings/toppings.module");
const table_types_module_1 = require("./modules/table-types/table-types.module");
const roles_module_1 = require("./modules/roles/roles.module");
const languages_module_1 = require("./modules/languages/languages.module");
const translations_module_1 = require("./modules/translations/translations.module");
const integrations_module_1 = require("./modules/integrations/integrations.module");
const message_templates_module_1 = require("./modules/message-templates/message-templates.module");
const customer_alerts_module_1 = require("./modules/customer-alerts/customer-alerts.module");
const reviews_module_1 = require("./modules/reviews/reviews.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
            bull_1.BullModule.forRoot({
                redis: process.env.REDIS_URL || 'redis://localhost:6379',
            }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            businesses_module_1.BusinessesModule,
            outlets_module_1.OutletsModule,
            menu_module_1.MenuModule,
            orders_module_1.OrdersModule,
            payments_module_1.PaymentsModule,
            inventory_module_1.InventoryModule,
            vendors_module_1.VendorsModule,
            subscriptions_module_1.SubscriptionsModule,
            notifications_module_1.NotificationsModule,
            qr_module_1.QrModule,
            reports_module_1.ReportsModule,
            disputes_module_1.DisputesModule,
            leads_module_1.LeadsModule,
            kitchen_stations_module_1.KitchenStationsModule,
            service_stations_module_1.ServiceStationsModule,
            customer_tags_module_1.CustomerTagsModule,
            customers_module_1.CustomersModule,
            toppings_module_1.ToppingsModule,
            table_types_module_1.TableTypesModule,
            roles_module_1.RolesModule,
            languages_module_1.LanguagesModule,
            translations_module_1.TranslationsModule,
            integrations_module_1.IntegrationsModule,
            message_templates_module_1.MessageTemplatesModule,
            customer_alerts_module_1.CustomerAlertsModule,
            reviews_module_1.ReviewsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map