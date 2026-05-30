-- DropForeignKey
ALTER TABLE `paynpik_audit_logs` DROP FOREIGN KEY `audit_logs_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_business_images` DROP FOREIGN KEY `business_images_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_businesses` DROP FOREIGN KEY `businesses_subscriptionId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_categories` DROP FOREIGN KEY `categories_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_categories` DROP FOREIGN KEY `categories_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_consumption_logs` DROP FOREIGN KEY `consumption_logs_materialId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_alerts` DROP FOREIGN KEY `customer_alerts_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_alerts` DROP FOREIGN KEY `customer_alerts_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_tag_assignments` DROP FOREIGN KEY `customer_tag_assignments_customerTagId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_tag_assignments` DROP FOREIGN KEY `customer_tag_assignments_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_tag_assignments` DROP FOREIGN KEY `customer_tag_assignments_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_tag_prices` DROP FOREIGN KEY `customer_tag_prices_customerTagId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_tag_prices` DROP FOREIGN KEY `customer_tag_prices_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_tag_prices` DROP FOREIGN KEY `customer_tag_prices_variantId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_customer_tags` DROP FOREIGN KEY `customer_tags_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_disputes` DROP FOREIGN KEY `disputes_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_facilities` DROP FOREIGN KEY `facilities_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_favorites` DROP FOREIGN KEY `favorites_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_favorites` DROP FOREIGN KEY `favorites_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_invoices` DROP FOREIGN KEY `invoices_subscriptionId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_item_images` DROP FOREIGN KEY `item_images_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_item_tags` DROP FOREIGN KEY `item_tags_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_item_toppings` DROP FOREIGN KEY `item_toppings_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_item_toppings` DROP FOREIGN KEY `item_toppings_toppingId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_items` DROP FOREIGN KEY `items_kitchenStationId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_items` DROP FOREIGN KEY `items_subcategoryId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_kitchen_stations` DROP FOREIGN KEY `kitchen_stations_currentWorkerId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_kitchen_stations` DROP FOREIGN KEY `kitchen_stations_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_material_categories` DROP FOREIGN KEY `material_categories_parentId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_materials` DROP FOREIGN KEY `materials_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_materials` DROP FOREIGN KEY `materials_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_message_templates` DROP FOREIGN KEY `message_templates_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_message_templates` DROP FOREIGN KEY `message_templates_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_options` DROP FOREIGN KEY `options_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_item_reviews` DROP FOREIGN KEY `order_item_reviews_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_item_reviews` DROP FOREIGN KEY `order_item_reviews_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_item_reviews` DROP FOREIGN KEY `order_item_reviews_orderItemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_item_reviews` DROP FOREIGN KEY `order_item_reviews_paybackPaymentId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_item_reviews` DROP FOREIGN KEY `order_item_reviews_replyByUserId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_items` DROP FOREIGN KEY `order_items_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_items` DROP FOREIGN KEY `order_items_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_items` DROP FOREIGN KEY `order_items_variantId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_status_history` DROP FOREIGN KEY `order_status_history_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_orders` DROP FOREIGN KEY `orders_customerId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_orders` DROP FOREIGN KEY `orders_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_orders` DROP FOREIGN KEY `orders_sectionId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_orders` DROP FOREIGN KEY `orders_staffId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_orders` DROP FOREIGN KEY `orders_tableId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_outlet_customers` DROP FOREIGN KEY `outlet_customers_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_outlet_customers` DROP FOREIGN KEY `outlet_customers_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_outlet_hours` DROP FOREIGN KEY `outlet_hours_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_outlet_images` DROP FOREIGN KEY `outlet_images_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_outlets` DROP FOREIGN KEY `outlets_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_outlets` DROP FOREIGN KEY `outlets_facilityId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_payments` DROP FOREIGN KEY `payments_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_purchase_orders` DROP FOREIGN KEY `purchase_orders_materialId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_purchase_orders` DROP FOREIGN KEY `purchase_orders_vendorId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_qr_codes` DROP FOREIGN KEY `qr_codes_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_qr_codes` DROP FOREIGN KEY `qr_codes_tableId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_role_responsibilities` DROP FOREIGN KEY `role_responsibilities_responsibilityId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_role_responsibilities` DROP FOREIGN KEY `role_responsibilities_roleId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_roles` DROP FOREIGN KEY `roles_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_roles` DROP FOREIGN KEY `roles_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_sections` DROP FOREIGN KEY `sections_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_service_station_tables` DROP FOREIGN KEY `service_station_tables_stationId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_service_station_tables` DROP FOREIGN KEY `service_station_tables_tableId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_service_station_workers` DROP FOREIGN KEY `service_station_workers_stationId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_service_station_workers` DROP FOREIGN KEY `service_station_workers_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_service_stations` DROP FOREIGN KEY `service_stations_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_service_stations` DROP FOREIGN KEY `service_stations_tableTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_sessions` DROP FOREIGN KEY `sessions_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_subcategories` DROP FOREIGN KEY `subcategories_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_subscriptions` DROP FOREIGN KEY `subscriptions_planId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_table_type_prices` DROP FOREIGN KEY `table_type_prices_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_table_type_prices` DROP FOREIGN KEY `table_type_prices_tableTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_table_type_prices` DROP FOREIGN KEY `table_type_prices_variantId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_table_types` DROP FOREIGN KEY `table_types_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_tables` DROP FOREIGN KEY `tables_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_tables` DROP FOREIGN KEY `tables_sectionId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_tables` DROP FOREIGN KEY `tables_tableTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_topping_options` DROP FOREIGN KEY `topping_options_toppingId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_toppings` DROP FOREIGN KEY `toppings_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_translations` DROP FOREIGN KEY `translations_languageCode_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_user_responsibilities` DROP FOREIGN KEY `user_responsibilities_responsibilityId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_user_responsibilities` DROP FOREIGN KEY `user_responsibilities_userId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_users` DROP FOREIGN KEY `users_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_users` DROP FOREIGN KEY `users_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_users` DROP FOREIGN KEY `users_roleId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_variants` DROP FOREIGN KEY `variants_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_vendors` DROP FOREIGN KEY `vendors_businessId_fkey`;

-- AlterTable
ALTER TABLE `paynpik_businesses` ADD COLUMN `multipleMenusEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `paynpik_categories` ADD COLUMN `menuId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `paynpik_order_items` ADD COLUMN `menuId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `paynpik_menus` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(250) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `paynpik_menus_businessId_displayOrder_idx`(`businessId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_menu_timing_slots` (
    `id` VARCHAR(191) NOT NULL,
    `menuId` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,

    INDEX `paynpik_menu_timing_slots_menuId_dayOfWeek_idx`(`menuId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_outlet_menus` (
    `id` VARCHAR(191) NOT NULL,
    `outletId` VARCHAR(191) NOT NULL,
    `menuId` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `overrideTimings` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `paynpik_outlet_menus_outletId_displayOrder_idx`(`outletId`, `displayOrder`),
    UNIQUE INDEX `paynpik_outlet_menus_outletId_menuId_key`(`outletId`, `menuId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_outlet_menu_timing_slots` (
    `id` VARCHAR(191) NOT NULL,
    `outletMenuId` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,

    INDEX `paynpik_outlet_menu_timing_slots_outletMenuId_dayOfWeek_idx`(`outletMenuId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `paynpik_categories_menuId_idx` ON `paynpik_categories`(`menuId`);

-- CreateIndex
CREATE INDEX `paynpik_order_items_menuId_idx` ON `paynpik_order_items`(`menuId`);

-- AddForeignKey
ALTER TABLE `paynpik_users` ADD CONSTRAINT `paynpik_users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `paynpik_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_users` ADD CONSTRAINT `paynpik_users_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_users` ADD CONSTRAINT `paynpik_users_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_roles` ADD CONSTRAINT `paynpik_roles_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_roles` ADD CONSTRAINT `paynpik_roles_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_user_responsibilities` ADD CONSTRAINT `paynpik_user_responsibilities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_user_responsibilities` ADD CONSTRAINT `paynpik_user_responsibilities_responsibilityId_fkey` FOREIGN KEY (`responsibilityId`) REFERENCES `paynpik_responsibilities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_translations` ADD CONSTRAINT `paynpik_translations_languageCode_fkey` FOREIGN KEY (`languageCode`) REFERENCES `paynpik_languages`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_role_responsibilities` ADD CONSTRAINT `paynpik_role_responsibilities_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `paynpik_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_role_responsibilities` ADD CONSTRAINT `paynpik_role_responsibilities_responsibilityId_fkey` FOREIGN KEY (`responsibilityId`) REFERENCES `paynpik_responsibilities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_sessions` ADD CONSTRAINT `paynpik_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_audit_logs` ADD CONSTRAINT `paynpik_audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_facilities` ADD CONSTRAINT `paynpik_facilities_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_businesses` ADD CONSTRAINT `paynpik_businesses_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `paynpik_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_business_images` ADD CONSTRAINT `paynpik_business_images_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlets` ADD CONSTRAINT `paynpik_outlets_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlets` ADD CONSTRAINT `paynpik_outlets_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `paynpik_facilities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_sections` ADD CONSTRAINT `paynpik_sections_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_tables` ADD CONSTRAINT `paynpik_tables_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `paynpik_sections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_tables` ADD CONSTRAINT `paynpik_tables_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_tables` ADD CONSTRAINT `paynpik_tables_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_qr_codes` ADD CONSTRAINT `paynpik_qr_codes_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_qr_codes` ADD CONSTRAINT `paynpik_qr_codes_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `paynpik_tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_categories` ADD CONSTRAINT `paynpik_categories_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_categories` ADD CONSTRAINT `paynpik_categories_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_categories` ADD CONSTRAINT `paynpik_categories_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_subcategories` ADD CONSTRAINT `paynpik_subcategories_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `paynpik_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_menus` ADD CONSTRAINT `paynpik_menus_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_menu_timing_slots` ADD CONSTRAINT `paynpik_menu_timing_slots_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlet_menus` ADD CONSTRAINT `paynpik_outlet_menus_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlet_menus` ADD CONSTRAINT `paynpik_outlet_menus_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlet_menu_timing_slots` ADD CONSTRAINT `paynpik_outlet_menu_timing_slots_outletMenuId_fkey` FOREIGN KEY (`outletMenuId`) REFERENCES `paynpik_outlet_menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_items` ADD CONSTRAINT `paynpik_items_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `paynpik_subcategories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_items` ADD CONSTRAINT `paynpik_items_kitchenStationId_fkey` FOREIGN KEY (`kitchenStationId`) REFERENCES `paynpik_kitchen_stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_item_images` ADD CONSTRAINT `paynpik_item_images_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_variants` ADD CONSTRAINT `paynpik_variants_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_options` ADD CONSTRAINT `paynpik_options_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_item_tags` ADD CONSTRAINT `paynpik_item_tags_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_kitchen_stations` ADD CONSTRAINT `paynpik_kitchen_stations_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_kitchen_stations` ADD CONSTRAINT `paynpik_kitchen_stations_currentWorkerId_fkey` FOREIGN KEY (`currentWorkerId`) REFERENCES `paynpik_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_orders` ADD CONSTRAINT `paynpik_orders_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_orders` ADD CONSTRAINT `paynpik_orders_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `paynpik_sections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_orders` ADD CONSTRAINT `paynpik_orders_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `paynpik_tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_orders` ADD CONSTRAINT `paynpik_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `paynpik_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_orders` ADD CONSTRAINT `paynpik_orders_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `paynpik_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_items` ADD CONSTRAINT `paynpik_order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_items` ADD CONSTRAINT `paynpik_order_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_items` ADD CONSTRAINT `paynpik_order_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_items` ADD CONSTRAINT `paynpik_order_items_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_item_reviews` ADD CONSTRAINT `paynpik_order_item_reviews_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `paynpik_order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_item_reviews` ADD CONSTRAINT `paynpik_order_item_reviews_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_item_reviews` ADD CONSTRAINT `paynpik_order_item_reviews_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `paynpik_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_item_reviews` ADD CONSTRAINT `paynpik_order_item_reviews_replyByUserId_fkey` FOREIGN KEY (`replyByUserId`) REFERENCES `paynpik_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_item_reviews` ADD CONSTRAINT `paynpik_order_item_reviews_paybackPaymentId_fkey` FOREIGN KEY (`paybackPaymentId`) REFERENCES `paynpik_payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_order_status_history` ADD CONSTRAINT `paynpik_order_status_history_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_payments` ADD CONSTRAINT `paynpik_payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_disputes` ADD CONSTRAINT `paynpik_disputes_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_material_categories` ADD CONSTRAINT `paynpik_material_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `paynpik_material_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_materials` ADD CONSTRAINT `paynpik_materials_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_materials` ADD CONSTRAINT `paynpik_materials_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `paynpik_material_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_vendors` ADD CONSTRAINT `paynpik_vendors_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_purchase_orders` ADD CONSTRAINT `paynpik_purchase_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `paynpik_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_purchase_orders` ADD CONSTRAINT `paynpik_purchase_orders_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `paynpik_materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_consumption_logs` ADD CONSTRAINT `paynpik_consumption_logs_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `paynpik_materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_subscriptions` ADD CONSTRAINT `paynpik_subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `paynpik_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_invoices` ADD CONSTRAINT `paynpik_invoices_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `paynpik_subscriptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_tags` ADD CONSTRAINT `paynpik_customer_tags_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_tag_prices` ADD CONSTRAINT `paynpik_customer_tag_prices_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_tag_prices` ADD CONSTRAINT `paynpik_customer_tag_prices_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_tag_prices` ADD CONSTRAINT `paynpik_customer_tag_prices_customerTagId_fkey` FOREIGN KEY (`customerTagId`) REFERENCES `paynpik_customer_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_tag_assignments` ADD CONSTRAINT `paynpik_customer_tag_assignments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_tag_assignments` ADD CONSTRAINT `paynpik_customer_tag_assignments_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_tag_assignments` ADD CONSTRAINT `paynpik_customer_tag_assignments_customerTagId_fkey` FOREIGN KEY (`customerTagId`) REFERENCES `paynpik_customer_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_toppings` ADD CONSTRAINT `paynpik_toppings_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_topping_options` ADD CONSTRAINT `paynpik_topping_options_toppingId_fkey` FOREIGN KEY (`toppingId`) REFERENCES `paynpik_toppings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_item_toppings` ADD CONSTRAINT `paynpik_item_toppings_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_item_toppings` ADD CONSTRAINT `paynpik_item_toppings_toppingId_fkey` FOREIGN KEY (`toppingId`) REFERENCES `paynpik_toppings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlet_images` ADD CONSTRAINT `paynpik_outlet_images_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlet_hours` ADD CONSTRAINT `paynpik_outlet_hours_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_favorites` ADD CONSTRAINT `paynpik_favorites_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_favorites` ADD CONSTRAINT `paynpik_favorites_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlet_customers` ADD CONSTRAINT `paynpik_outlet_customers_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_outlet_customers` ADD CONSTRAINT `paynpik_outlet_customers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_table_types` ADD CONSTRAINT `paynpik_table_types_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_table_type_prices` ADD CONSTRAINT `paynpik_table_type_prices_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_table_type_prices` ADD CONSTRAINT `paynpik_table_type_prices_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_table_type_prices` ADD CONSTRAINT `paynpik_table_type_prices_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_service_stations` ADD CONSTRAINT `paynpik_service_stations_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_service_stations` ADD CONSTRAINT `paynpik_service_stations_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_service_station_workers` ADD CONSTRAINT `paynpik_service_station_workers_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `paynpik_service_stations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_service_station_workers` ADD CONSTRAINT `paynpik_service_station_workers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_service_station_tables` ADD CONSTRAINT `paynpik_service_station_tables_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `paynpik_service_stations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_service_station_tables` ADD CONSTRAINT `paynpik_service_station_tables_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `paynpik_tables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_alerts` ADD CONSTRAINT `paynpik_customer_alerts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_customer_alerts` ADD CONSTRAINT `paynpik_customer_alerts_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_message_templates` ADD CONSTRAINT `paynpik_message_templates_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_message_templates` ADD CONSTRAINT `paynpik_message_templates_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `paynpik_business_images` RENAME INDEX `business_images_businessId_displayOrder_idx` TO `paynpik_business_images_businessId_displayOrder_idx`;

-- RenameIndex
ALTER TABLE `paynpik_businesses` RENAME INDEX `businesses_subscriptionId_key` TO `paynpik_businesses_subscriptionId_key`;

-- RenameIndex
ALTER TABLE `paynpik_categories` RENAME INDEX `categories_businessId_idx` TO `paynpik_categories_businessId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_categories` RENAME INDEX `categories_outletId_idx` TO `paynpik_categories_outletId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_customer_alerts` RENAME INDEX `customer_alerts_customerId_idx` TO `paynpik_customer_alerts_customerId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_customer_alerts` RENAME INDEX `customer_alerts_isRead_idx` TO `paynpik_customer_alerts_isRead_idx`;

-- RenameIndex
ALTER TABLE `paynpik_customer_alerts` RENAME INDEX `customer_alerts_orderId_idx` TO `paynpik_customer_alerts_orderId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_customer_tag_assignments` RENAME INDEX `customer_tag_assignments_userId_outletId_key` TO `paynpik_customer_tag_assignments_userId_outletId_key`;

-- RenameIndex
ALTER TABLE `paynpik_customer_tag_prices` RENAME INDEX `customer_tag_prices_itemId_variantId_customerTagId_key` TO `paynpik_customer_tag_prices_itemId_variantId_customerTagId_key`;

-- RenameIndex
ALTER TABLE `paynpik_customer_tags` RENAME INDEX `customer_tags_outletId_name_key` TO `paynpik_customer_tags_outletId_name_key`;

-- RenameIndex
ALTER TABLE `paynpik_favorites` RENAME INDEX `favorites_userId_idx` TO `paynpik_favorites_userId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_favorites` RENAME INDEX `favorites_userId_itemId_key` TO `paynpik_favorites_userId_itemId_key`;

-- RenameIndex
ALTER TABLE `paynpik_integration_configs` RENAME INDEX `integration_configs_channel_isDefault_idx` TO `paynpik_integration_configs_channel_isDefault_idx`;

-- RenameIndex
ALTER TABLE `paynpik_integration_configs` RENAME INDEX `integration_configs_channel_providerKey_key` TO `paynpik_integration_configs_channel_providerKey_key`;

-- RenameIndex
ALTER TABLE `paynpik_item_images` RENAME INDEX `item_images_itemId_displayOrder_idx` TO `paynpik_item_images_itemId_displayOrder_idx`;

-- RenameIndex
ALTER TABLE `paynpik_item_toppings` RENAME INDEX `item_toppings_itemId_toppingId_key` TO `paynpik_item_toppings_itemId_toppingId_key`;

-- RenameIndex
ALTER TABLE `paynpik_leads` RENAME INDEX `leads_createdAt_idx` TO `paynpik_leads_createdAt_idx`;

-- RenameIndex
ALTER TABLE `paynpik_leads` RENAME INDEX `leads_status_idx` TO `paynpik_leads_status_idx`;

-- RenameIndex
ALTER TABLE `paynpik_message_templates` RENAME INDEX `message_templates_businessId_idx` TO `paynpik_message_templates_businessId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_message_templates` RENAME INDEX `message_templates_outletId_idx` TO `paynpik_message_templates_outletId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_message_templates` RENAME INDEX `message_templates_scope_channel_approvalStatus_idx` TO `paynpik_message_templates_scope_channel_approvalStatus_idx`;

-- RenameIndex
ALTER TABLE `paynpik_offers` RENAME INDEX `offers_couponCode_key` TO `paynpik_offers_couponCode_key`;

-- RenameIndex
ALTER TABLE `paynpik_order_item_reviews` RENAME INDEX `order_item_reviews_customerId_idx` TO `paynpik_order_item_reviews_customerId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_order_item_reviews` RENAME INDEX `order_item_reviews_itemId_idx` TO `paynpik_order_item_reviews_itemId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_order_item_reviews` RENAME INDEX `order_item_reviews_orderItemId_key` TO `paynpik_order_item_reviews_orderItemId_key`;

-- RenameIndex
ALTER TABLE `paynpik_order_item_reviews` RENAME INDEX `order_item_reviews_paybackPaymentId_key` TO `paynpik_order_item_reviews_paybackPaymentId_key`;

-- RenameIndex
ALTER TABLE `paynpik_orders` RENAME INDEX `orders_orderNumber_key` TO `paynpik_orders_orderNumber_key`;

-- RenameIndex
ALTER TABLE `paynpik_outlet_customers` RENAME INDEX `outlet_customers_outletId_idx` TO `paynpik_outlet_customers_outletId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_outlet_customers` RENAME INDEX `outlet_customers_outletId_userId_key` TO `paynpik_outlet_customers_outletId_userId_key`;

-- RenameIndex
ALTER TABLE `paynpik_outlet_hours` RENAME INDEX `outlet_hours_outletId_dayOfWeek_idx` TO `paynpik_outlet_hours_outletId_dayOfWeek_idx`;

-- RenameIndex
ALTER TABLE `paynpik_outlet_images` RENAME INDEX `outlet_images_outletId_displayOrder_idx` TO `paynpik_outlet_images_outletId_displayOrder_idx`;

-- RenameIndex
ALTER TABLE `paynpik_purchase_orders` RENAME INDEX `purchase_orders_poNumber_key` TO `paynpik_purchase_orders_poNumber_key`;

-- RenameIndex
ALTER TABLE `paynpik_qr_codes` RENAME INDEX `qr_codes_code_key` TO `paynpik_qr_codes_code_key`;

-- RenameIndex
ALTER TABLE `paynpik_qr_codes` RENAME INDEX `qr_codes_tableId_key` TO `paynpik_qr_codes_tableId_key`;

-- RenameIndex
ALTER TABLE `paynpik_responsibilities` RENAME INDEX `responsibilities_name_key` TO `paynpik_responsibilities_name_key`;

-- RenameIndex
ALTER TABLE `paynpik_roles` RENAME INDEX `roles_businessId_idx` TO `paynpik_roles_businessId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_roles` RENAME INDEX `roles_outletId_idx` TO `paynpik_roles_outletId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_service_station_tables` RENAME INDEX `service_station_tables_stationId_tableId_key` TO `paynpik_service_station_tables_stationId_tableId_key`;

-- RenameIndex
ALTER TABLE `paynpik_service_station_workers` RENAME INDEX `service_station_workers_stationId_userId_key` TO `paynpik_service_station_workers_stationId_userId_key`;

-- RenameIndex
ALTER TABLE `paynpik_service_stations` RENAME INDEX `service_stations_outletId_idx` TO `paynpik_service_stations_outletId_idx`;

-- RenameIndex
ALTER TABLE `paynpik_sessions` RENAME INDEX `sessions_token_key` TO `paynpik_sessions_token_key`;

-- RenameIndex
ALTER TABLE `paynpik_table_type_prices` RENAME INDEX `table_type_prices_itemId_variantId_tableTypeId_key` TO `paynpik_table_type_prices_itemId_variantId_tableTypeId_key`;

-- RenameIndex
ALTER TABLE `paynpik_table_types` RENAME INDEX `table_types_outletId_name_key` TO `paynpik_table_types_outletId_name_key`;

-- RenameIndex
ALTER TABLE `paynpik_toppings` RENAME INDEX `toppings_outletId_name_key` TO `paynpik_toppings_outletId_name_key`;

-- RenameIndex
ALTER TABLE `paynpik_translations` RENAME INDEX `translations_entityType_languageCode_idx` TO `paynpik_translations_entityType_languageCode_idx`;

-- RenameIndex
ALTER TABLE `paynpik_users` RENAME INDEX `users_email_key` TO `paynpik_users_email_key`;

-- RenameIndex
ALTER TABLE `paynpik_users` RENAME INDEX `users_phone_key` TO `paynpik_users_phone_key`;

-- ─── Data backfill ─────────────────────────────────────────────
-- Seed one default 'Main Menu' per existing business so every Category has
-- a menu to point to. id is deterministic (mdef_<businessId>) so the
-- migration is idempotent if the data side is re-run partially.
INSERT INTO `paynpik_menus`
    (`id`, `businessId`, `name`, `isActive`, `displayOrder`, `isDefault`, `createdAt`, `updatedAt`)
SELECT CONCAT('mdef_', `id`), `id`, 'Main Menu', 1, 0, 1, NOW(3), NOW(3)
FROM `paynpik_businesses`
WHERE NOT EXISTS (
    SELECT 1 FROM `paynpik_menus` m WHERE m.`businessId` = `paynpik_businesses`.`id` AND m.`isDefault` = 1
);

-- Point business-scoped categories at their business's default menu.
UPDATE `paynpik_categories` c
JOIN `paynpik_menus` m ON m.`businessId` = c.`businessId` AND m.`isDefault` = 1
SET c.`menuId` = m.`id`
WHERE c.`businessId` IS NOT NULL AND c.`menuId` IS NULL;

-- Point outlet-scoped categories at the menu of the outlet's parent business.
UPDATE `paynpik_categories` c
JOIN `paynpik_outlets` o ON o.`id` = c.`outletId`
JOIN `paynpik_menus` m ON m.`businessId` = o.`businessId` AND m.`isDefault` = 1
SET c.`menuId` = m.`id`
WHERE c.`outletId` IS NOT NULL AND c.`menuId` IS NULL;

-- Create OutletMenu (enabled) for every existing outlet × default-menu pair.
INSERT INTO `paynpik_outlet_menus`
    (`id`, `outletId`, `menuId`, `isEnabled`, `overrideTimings`, `displayOrder`, `createdAt`, `updatedAt`)
SELECT CONCAT('omdef_', o.`id`), o.`id`, m.`id`, 1, 0, 0, NOW(3), NOW(3)
FROM `paynpik_outlets` o
JOIN `paynpik_menus` m ON m.`businessId` = o.`businessId` AND m.`isDefault` = 1
WHERE NOT EXISTS (
    SELECT 1 FROM `paynpik_outlet_menus` om WHERE om.`outletId` = o.`id` AND om.`menuId` = m.`id`
);

-- Backfill OrderItem.menuId by chasing item → subcategory → category.
UPDATE `paynpik_order_items` oi
JOIN `paynpik_items` i        ON i.`id`            = oi.`itemId`
JOIN `paynpik_subcategories` s ON s.`id`            = i.`subcategoryId`
JOIN `paynpik_categories` cat ON cat.`id`          = s.`categoryId`
SET oi.`menuId` = cat.`menuId`
WHERE cat.`menuId` IS NOT NULL AND oi.`menuId` IS NULL;
