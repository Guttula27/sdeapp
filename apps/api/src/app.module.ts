import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './config/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { OutletsModule } from './modules/outlets/outlets.module';
import { MenuModule } from './modules/menu/menu.module';
import { MenusModule } from './modules/menus/menus.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QrModule } from './modules/qr/qr.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { LeadsModule } from './modules/leads/leads.module';
import { KitchenStationsModule } from './modules/kitchen-stations/kitchen-stations.module';
import { ServiceStationsModule } from './modules/service-stations/service-stations.module';
import { CustomerTagsModule } from './modules/customer-tags/customer-tags.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ToppingsModule } from './modules/toppings/toppings.module';
import { TableTypesModule } from './modules/table-types/table-types.module';
import { RolesModule } from './modules/roles/roles.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { TranslationsModule } from './modules/translations/translations.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { MessageTemplatesModule } from './modules/message-templates/message-templates.module';
import { CustomerAlertsModule } from './modules/customer-alerts/customer-alerts.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ClustersModule } from './modules/clusters/clusters.module';
import { ClusterOrdersModule } from './modules/cluster-orders/cluster-orders.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { OffersModule } from './modules/offers/offers.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PrintersModule } from './modules/printers/printers.module';
import { PlatformSettingsModule } from './modules/platform-settings/platform-settings.module';
import { LoggerModule } from './config/logger/logger.module';
import { RequestLogMiddleware } from './config/logger/request-log.middleware';
import { CryptoModule } from './config/crypto/crypto.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    LoggerModule,
    CryptoModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    OutletsModule,
    MenuModule,
    MenusModule,
    OrdersModule,
    PaymentsModule,
    InventoryModule,
    VendorsModule,
    SubscriptionsModule,
    NotificationsModule,
    QrModule,
    ReportsModule,
    DisputesModule,
    LeadsModule,
    KitchenStationsModule,
    ServiceStationsModule,
    CustomerTagsModule,
    CustomersModule,
    ToppingsModule,
    TableTypesModule,
    RolesModule,
    LanguagesModule,
    TranslationsModule,
    IntegrationsModule,
    MessageTemplatesModule,
    CustomerAlertsModule,
    ReviewsModule,
    ClustersModule,
    ClusterOrdersModule,
    CouponsModule,
    DiscountsModule,
    OffersModule,
    RewardsModule,
    PricingModule,
    PrintersModule,
    PlatformSettingsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLogMiddleware).forRoutes('*');
  }
}
