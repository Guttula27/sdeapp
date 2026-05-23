-- AlterTable
ALTER TABLE `business_images` MODIFY `url` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `businesses` MODIFY `logoUrl` TEXT NULL,
    MODIFY `primaryImageUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `categories` MODIFY `imageUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `item_images` MODIFY `url` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `items` MODIFY `imageUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `outlet_images` MODIFY `url` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `outlets` MODIFY `logoUrl` TEXT NULL,
    MODIFY `primaryImageUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `qr_codes` MODIFY `imageUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `subcategories` MODIFY `imageUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `profileImageUrl` TEXT NULL;
