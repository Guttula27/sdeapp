import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './config/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { OutletsModule } from './modules/outlets/outlets.module';
import { MenuModule } from './modules/menu/menu.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    OutletsModule,
    MenuModule,
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
  ],
})
export class AppModule {}
