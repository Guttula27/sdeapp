import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { CustomerDuesModule } from './modules/customer-dues/customer-dues.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ToppingsModule } from './modules/toppings/toppings.module';
import { TableTypesModule } from './modules/table-types/table-types.module';
import { RolesModule } from './modules/roles/roles.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { TranslationsModule } from './modules/translations/translations.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { MessageTemplatesModule } from './modules/message-templates/message-templates.module';
import { CustomerAlertsModule } from './modules/customer-alerts/customer-alerts.module';
import { PushModule } from './modules/push/push.module';
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
import { ShiftsModule } from './modules/shifts/shifts.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { AggregatorsModule } from './modules/aggregators/aggregators.module';
import { SplitBillsModule } from './modules/split-bills/split-bills.module';
import { LoggerModule } from './config/logger/logger.module';
import { RequestLogMiddleware } from './config/logger/request-log.middleware';
import { CryptoModule } from './config/crypto/crypto.module';
import { RedisModule } from './config/redis/redis.module';

// Rate-limit buckets:
//   • global default — every request counts toward this; safety net.
//   • per-route override via @Throttle() — auth/payment surfaces.
// ThrottlerGuard must be wired as a global APP_GUARD (below); without
// that registration the @Throttle decorators are inert.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    BullModule.forRoot({
      // Bull's redis option accepts either a URL string or an
      // ioredis options object. We use the object form so REDIS_PASSWORD /
      // REDIS_USERNAME env vars (used by hosted Redis providers that
      // keep credentials out of the URL) carry through to the queue
      // connection — same pattern as RedisService. The URL is parsed
      // for host/port/db so an existing REDIS_URL keeps working.
      redis: (() => {
        const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
        return {
          host: url.hostname,
          port: Number(url.port || 6379),
          ...(url.pathname && url.pathname !== '/' ? { db: Number(url.pathname.slice(1)) || 0 } : {}),
          ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD }
              : url.password ? { password: decodeURIComponent(url.password) } : {}),
          ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME }
              : url.username ? { username: decodeURIComponent(url.username) } : {}),
        };
      })(),
    }),
    LoggerModule,
    CryptoModule,
    RedisModule,
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
    CustomerDuesModule,
    CustomersModule,
    ToppingsModule,
    TableTypesModule,
    RolesModule,
    LanguagesModule,
    TranslationsModule,
    IntegrationsModule,
    MessageTemplatesModule,
    CustomerAlertsModule,
    PushModule,
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
    ShiftsModule,
    RefundsModule,
    AggregatorsModule,
    SplitBillsModule,
  ],
  providers: [
    // Globally enforce ThrottlerModule's limits. Without this entry the
    // @Throttle() decorators (auth surfaces, payment verify) silently
    // do nothing — the rate-limit configuration only takes effect when
    // the guard is registered as APP_GUARD.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLogMiddleware).forRoutes('*');
  }
}
