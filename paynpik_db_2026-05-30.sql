-- MySQL dump 10.13  Distrib 8.0.46, for Linux (aarch64)
--
-- Host: localhost    Database: paynpik_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('19afae86-4aa0-497b-829d-ca08f5833948','9f885f5b985733d7ca21151ad24c80b21264dff22f9994de8e747b67622aea4c','2026-05-30 03:08:08.843','20260530120000_bundle_max_selections',NULL,NULL,'2026-05-30 03:08:08.811',1),('2061988e-f221-4d69-bf30-21ddd76d46b0','ee751efd28ace09dcb6958db5fa0a5262872e81e4ef25e842aee4213b43756f0','2026-05-30 03:08:06.948','20260525060914_table_type_menus',NULL,NULL,'2026-05-30 03:08:06.877',1),('2add7af2-cd0b-4f07-9c01-c82537f6d1e2','576433ec70d223085c0972c59c0857818798abaa76ec6f21c1cf467711c68d4b','2026-05-30 03:08:08.549','20260527042217_parcel_station',NULL,NULL,'2026-05-30 03:08:08.462',1),('36b6deb2-d15e-46bf-9eb8-7de7cad14071','5c9dd976c5b0fac33dd1024c8f7c1458d1b4709aec843a9d4ccbc82cbbd0b0ac','2026-05-30 03:08:08.460','20260527040637_kitchen_printers',NULL,NULL,'2026-05-30 03:08:08.329',1),('372447db-42ab-4874-93a6-6bb1fdd0e99c','61e4e2f24e8ae6d97ed126eb57954cca27ded4590074a012ed38fe5f4f2540c0','2026-05-30 03:08:08.251','20260526144250_add_promotions_and_rewards',NULL,NULL,'2026-05-30 03:08:07.348',1),('3898854b-1bd9-49cd-98c5-1312fc7859de','0e53ee4a3c8b4c2696275f08008fb8e763fe0cf66fb9bc6424d6bbf8366f24dd','2026-05-30 03:08:02.410','20260523024538_order_item_reviews',NULL,NULL,'2026-05-30 03:08:02.323',1),('4731d708-1aea-4acc-9a07-dfd6105092b5','6866e71344e17de9a03d1df4b2f990b8f6ea1ac9c57941a4366810f211991448','2026-05-30 03:08:08.327','20260526213749_order_item_bundle_link',NULL,NULL,'2026-05-30 03:08:08.252',1),('4966e131-9f56-484c-a5da-35777a1e35bd','05de5d8cd91e70b3fe640d6c7ad66c37df01ae2de4b61cfcd9dbc28897dc449b','2026-05-30 03:08:02.275','20260522120522_widen_url_columns',NULL,NULL,'2026-05-30 03:08:01.972',1),('4e862cc5-afa1-4c71-b0c6-d2a695305dc2','c17be077c6a8c0f83cdd330c6c03ae564f6fa493eb636cce6322d10eaf16c7f4','2026-05-30 03:08:01.971','20260522044542_init',NULL,NULL,'2026-05-30 03:07:59.048',1),('5695ccb0-517c-4cdd-8786-dbaf2d5a7a5f','bc7adce2bca9629d3cb17366eed45fb99c94f940b7875e731fb2f5878416be7f','2026-05-30 03:08:06.876','20260525052132_multiple_menus',NULL,NULL,'2026-05-30 03:08:02.949',1),('59f33898-84d1-4192-87aa-2f4108f08b8a','2bfc1f26dcab13bc294a8da13f008a03e9b615cea9edfc06b4d047edffeab960','2026-05-30 03:08:07.064','20260525125430_outlet_public_code',NULL,NULL,'2026-05-30 03:08:06.997',1),('6d9439e6-6a58-4ed9-84d0-eaec3e170a11','789ebbd3f6558786f7786f83f756a1ebdf10e1d035c48420c9dfa86921027586','2026-05-30 03:08:08.809','20260528043955_bundles_as_items',NULL,NULL,'2026-05-30 03:08:08.608',1),('70366606-27ce-4ff3-a838-23cc015952b1','2119bfafe84201416e553c9dede51a7fdd263dd8918c3cc41be4d7b969b4d972','2026-05-30 03:08:07.112','20260525154935_parcel_default_on',NULL,NULL,'2026-05-30 03:08:07.066',1),('79968245-5d4c-4260-8bfd-470ebb04c261','c09c26c8570c747459cdc25dd135c4356e9094c4e8115661e216b796150c6ee1','2026-05-30 03:08:08.607','20260527065936_order_sequences',NULL,NULL,'2026-05-30 03:08:08.551',1),('96c117e4-07af-490a-9190-6bacca6e30fb','97d220f97006c18e9ba012f4a22908dad8efc84dbbe3783015c5dacd96813137','2026-05-30 03:08:02.945','20260523130000_session_token_widen',NULL,NULL,'2026-05-30 03:08:02.937',1),('a9bab37d-6249-4cd6-b94a-20729255bb41','aad20aa792c68b7afdb23115a3571e2dc42e1134d27012d54d70ae81e603eb73','2026-05-30 03:08:06.995','20260525065216_outlet_multiple_menus_flag',NULL,NULL,'2026-05-30 03:08:06.949',1),('ae08a9a9-cfb3-4638-9442-e9ab0914267d','1861ebdbad2438d7d56a4092aa5324bb19c3a0e450bf8f6f666e398da312a14c','2026-05-30 03:08:02.321','20260522121458_order_postpaid_fields',NULL,NULL,'2026-05-30 03:08:02.277',1),('b96b19a3-617c-4537-89c3-29a842fd3ced','04ff1e3289da09ea890bf0e416dec79ec21569332daf0eb4bb55ca05427b5a0f','2026-05-30 03:08:02.513','20260523030000_review_reply_payback',NULL,NULL,'2026-05-30 03:08:02.412',1),('cebaddea-27da-4188-ab4a-2de5ff40c8df','4bf38084abbc9e611811d86528d5ebf92397a596a9b3bb93dcba056c60e77b6c','2026-05-30 03:08:02.935','20260523120000_paynpik_prefix',NULL,NULL,'2026-05-30 03:08:02.515',1),('d796fbb9-212b-43a9-83ba-4ebd950a0dab','d708aca8de5071a0078acd9e7d03ea231d146eb4f708a17ba3703953afe4183b','2026-05-30 03:08:07.346','20260526092000_idempotency_keys',NULL,NULL,'2026-05-30 03:08:07.333',1),('e8e17fee-3dc2-42a7-b73c-fb3829ed0268','1b7542b6d6759aaa935bdde09c7a5d20e5759c05d47a18e12739c46cfb4b4ccd','2026-05-30 03:08:07.331','20260525165326_cluster_schema',NULL,NULL,'2026-05-30 03:08:07.114',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_audit_logs`
--

DROP TABLE IF EXISTS `paynpik_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_audit_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oldValue` json DEFAULT NULL,
  `newValue` json DEFAULT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_audit_logs_userId_fkey` (`userId`),
  CONSTRAINT `paynpik_audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_audit_logs`
--

LOCK TABLES `paynpik_audit_logs` WRITE;
/*!40000 ALTER TABLE `paynpik_audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_business_images`
--

DROP TABLE IF EXISTS `paynpik_business_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_business_images` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_business_images_businessId_displayOrder_idx` (`businessId`,`displayOrder`),
  CONSTRAINT `paynpik_business_images_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_business_images`
--

LOCK TABLES `paynpik_business_images` WRITE;
/*!40000 ALTER TABLE `paynpik_business_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_business_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_businesses`
--

DROP TABLE IF EXISTS `paynpik_businesses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_businesses` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addressLine1` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addressLine2` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT 'India',
  `mapsLocation` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upiId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessType` enum('RESTAURANT','QSR','FOOD_COURT','CAFETERIA','PARCEL_OUTLET','DINE_IN','HYBRID') COLLATE utf8mb4_unicode_ci NOT NULL,
  `logoUrl` text COLLATE utf8mb4_unicode_ci,
  `primaryImageUrl` text COLLATE utf8mb4_unicode_ci,
  `status` enum('ACTIVE','INACTIVE','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `subscriptionId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `multipleMenusEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `thumbnailUrl` text COLLATE utf8mb4_unicode_ci,
  `publicCode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isCluster` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_businesses_subscriptionId_key` (`subscriptionId`),
  UNIQUE KEY `paynpik_businesses_publicCode_key` (`publicCode`),
  CONSTRAINT `paynpik_businesses_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `paynpik_subscriptions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_businesses`
--

LOCK TABLES `paynpik_businesses` WRITE;
/*!40000 ALTER TABLE `paynpik_businesses` DISABLE KEYS */;
INSERT INTO `paynpik_businesses` VALUES ('demo-business','Demo Restaurant',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'India',NULL,'29ABCDE1234F1Z5',NULL,'RESTAURANT',NULL,NULL,'ACTIVE','cmprtftnk001k100xm0ui1k1q','2026-05-30 03:53:22.431','2026-05-30 03:53:22.431',0,NULL,NULL,0);
/*!40000 ALTER TABLE `paynpik_businesses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_categories`
--

DROP TABLE IF EXISTS `paynpik_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_categories` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `imageUrl` text COLLATE utf8mb4_unicode_ci,
  `displayOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `menuId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_categories_outletId_idx` (`outletId`),
  KEY `paynpik_categories_businessId_idx` (`businessId`),
  KEY `paynpik_categories_menuId_idx` (`menuId`),
  CONSTRAINT `paynpik_categories_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_categories_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_categories_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_categories`
--

LOCK TABLES `paynpik_categories` WRITE;
/*!40000 ALTER TABLE `paynpik_categories` DISABLE KEYS */;
INSERT INTO `paynpik_categories` VALUES ('cmprtfu0w001q100x8rvdwp3y','Breakfast',NULL,1,1,'demo-outlet',NULL,'2026-05-30 03:53:22.881','2026-05-30 03:53:22.881',NULL),('cmprtfu1o001s100xqptzysa6','Main Course',NULL,2,1,'demo-outlet',NULL,'2026-05-30 03:53:22.909','2026-05-30 03:53:22.909',NULL),('cmprtfu1v001u100xbzrl3c8p','Beverages',NULL,3,1,'demo-outlet',NULL,'2026-05-30 03:53:22.915','2026-05-30 03:53:22.915',NULL);
/*!40000 ALTER TABLE `paynpik_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_cluster_members`
--

DROP TABLE IF EXISTS `paynpik_cluster_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_cluster_members` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clusterBusinessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `joinedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_cluster_members_outletId_key` (`outletId`),
  KEY `paynpik_cluster_members_clusterBusinessId_displayOrder_idx` (`clusterBusinessId`,`displayOrder`),
  CONSTRAINT `paynpik_cluster_members_clusterBusinessId_fkey` FOREIGN KEY (`clusterBusinessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_cluster_members_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_cluster_members`
--

LOCK TABLES `paynpik_cluster_members` WRITE;
/*!40000 ALTER TABLE `paynpik_cluster_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_cluster_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_cluster_orders`
--

DROP TABLE IF EXISTS `paynpik_cluster_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_cluster_orders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clusterOrderNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clusterBusinessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tableId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `taxAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `parcelAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalAmount` decimal(10,2) NOT NULL,
  `paymentMethod` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paymentStatus` enum('PENDING','SUCCESS','FAILED','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `razorpayOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpayPaymentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpaySignature` text COLLATE utf8mb4_unicode_ci,
  `routeTransfers` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_cluster_orders_clusterOrderNumber_key` (`clusterOrderNumber`),
  KEY `paynpik_cluster_orders_clusterBusinessId_idx` (`clusterBusinessId`),
  KEY `paynpik_cluster_orders_customerId_idx` (`customerId`),
  CONSTRAINT `paynpik_cluster_orders_clusterBusinessId_fkey` FOREIGN KEY (`clusterBusinessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_cluster_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `paynpik_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_cluster_orders`
--

LOCK TABLES `paynpik_cluster_orders` WRITE;
/*!40000 ALTER TABLE `paynpik_cluster_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_cluster_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_consumption_logs`
--

DROP TABLE IF EXISTS `paynpik_consumption_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_consumption_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `purpose` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `issuedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `materialId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_consumption_logs_materialId_fkey` (`materialId`),
  CONSTRAINT `paynpik_consumption_logs_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `paynpik_materials` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_consumption_logs`
--

LOCK TABLES `paynpik_consumption_logs` WRITE;
/*!40000 ALTER TABLE `paynpik_consumption_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_consumption_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_coupon_customers`
--

DROP TABLE IF EXISTS `paynpik_coupon_customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_coupon_customers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `couponId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_coupon_customers_couponId_userId_key` (`couponId`,`userId`),
  KEY `paynpik_coupon_customers_userId_idx` (`userId`),
  CONSTRAINT `paynpik_coupon_customers_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `paynpik_coupons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_coupon_customers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_coupon_customers`
--

LOCK TABLES `paynpik_coupon_customers` WRITE;
/*!40000 ALTER TABLE `paynpik_coupon_customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_coupon_customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_coupon_usages`
--

DROP TABLE IF EXISTS `paynpik_coupon_usages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_coupon_usages` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `couponId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clusterOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discountAmount` decimal(10,2) NOT NULL,
  `appliedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_coupon_usages_couponId_idx` (`couponId`),
  KEY `paynpik_coupon_usages_userId_idx` (`userId`),
  KEY `paynpik_coupon_usages_orderId_idx` (`orderId`),
  CONSTRAINT `paynpik_coupon_usages_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `paynpik_coupons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_coupon_usages_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_coupon_usages_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_coupon_usages`
--

LOCK TABLES `paynpik_coupon_usages` WRITE;
/*!40000 ALTER TABLE `paynpik_coupon_usages` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_coupon_usages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_coupons`
--

DROP TABLE IF EXISTS `paynpik_coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_coupons` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discountType` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discountValue` decimal(10,2) NOT NULL,
  `minBillAmount` decimal(10,2) DEFAULT NULL,
  `maxDiscountAmount` decimal(10,2) DEFAULT NULL,
  `validFrom` datetime(3) NOT NULL,
  `validUntil` datetime(3) NOT NULL,
  `maxUsesPerCustomer` int NOT NULL DEFAULT '1',
  `maxTotalUses` int DEFAULT NULL,
  `usesCount` int NOT NULL DEFAULT '0',
  `targetType` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_coupons_businessId_idx` (`businessId`),
  KEY `paynpik_coupons_outletId_idx` (`outletId`),
  KEY `paynpik_coupons_code_idx` (`code`),
  KEY `paynpik_coupons_isActive_validFrom_validUntil_idx` (`isActive`,`validFrom`,`validUntil`),
  CONSTRAINT `paynpik_coupons_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_coupons_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_coupons`
--

LOCK TABLES `paynpik_coupons` WRITE;
/*!40000 ALTER TABLE `paynpik_coupons` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_coupons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_customer_alerts`
--

DROP TABLE IF EXISTS `paynpik_customer_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_customer_alerts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `orderItemId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trigger` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ringtone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sentVia` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_APP',
  `whatsappError` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_customer_alerts_customerId_idx` (`customerId`),
  KEY `paynpik_customer_alerts_orderId_idx` (`orderId`),
  KEY `paynpik_customer_alerts_isRead_idx` (`isRead`),
  CONSTRAINT `paynpik_customer_alerts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_customer_alerts_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_customer_alerts`
--

LOCK TABLES `paynpik_customer_alerts` WRITE;
/*!40000 ALTER TABLE `paynpik_customer_alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_customer_alerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_customer_tag_assignments`
--

DROP TABLE IF EXISTS `paynpik_customer_tag_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_customer_tag_assignments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerTagId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_customer_tag_assignments_userId_outletId_key` (`userId`,`outletId`),
  KEY `paynpik_customer_tag_assignments_outletId_fkey` (`outletId`),
  KEY `paynpik_customer_tag_assignments_customerTagId_fkey` (`customerTagId`),
  CONSTRAINT `paynpik_customer_tag_assignments_customerTagId_fkey` FOREIGN KEY (`customerTagId`) REFERENCES `paynpik_customer_tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_customer_tag_assignments_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_customer_tag_assignments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_customer_tag_assignments`
--

LOCK TABLES `paynpik_customer_tag_assignments` WRITE;
/*!40000 ALTER TABLE `paynpik_customer_tag_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_customer_tag_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_customer_tag_prices`
--

DROP TABLE IF EXISTS `paynpik_customer_tag_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_customer_tag_prices` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variantId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerTagId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `gstRate` decimal(5,2) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_customer_tag_prices_itemId_variantId_customerTagId_key` (`itemId`,`variantId`,`customerTagId`),
  KEY `paynpik_customer_tag_prices_variantId_fkey` (`variantId`),
  KEY `paynpik_customer_tag_prices_customerTagId_fkey` (`customerTagId`),
  CONSTRAINT `paynpik_customer_tag_prices_customerTagId_fkey` FOREIGN KEY (`customerTagId`) REFERENCES `paynpik_customer_tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_customer_tag_prices_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_customer_tag_prices_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_customer_tag_prices`
--

LOCK TABLES `paynpik_customer_tag_prices` WRITE;
/*!40000 ALTER TABLE `paynpik_customer_tag_prices` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_customer_tag_prices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_customer_tags`
--

DROP TABLE IF EXISTS `paynpik_customer_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_customer_tags` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#f97316',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_customer_tags_outletId_name_key` (`outletId`,`name`),
  CONSTRAINT `paynpik_customer_tags_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_customer_tags`
--

LOCK TABLES `paynpik_customer_tags` WRITE;
/*!40000 ALTER TABLE `paynpik_customer_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_customer_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_discounts`
--

DROP TABLE IF EXISTS `paynpik_discounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_discounts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `targetType` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoryId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subcategoryId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discountType` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discountValue` decimal(10,2) NOT NULL,
  `minBillAmount` decimal(10,2) DEFAULT NULL,
  `maxDiscountAmount` decimal(10,2) DEFAULT NULL,
  `validFrom` datetime(3) DEFAULT NULL,
  `validUntil` datetime(3) DEFAULT NULL,
  `daysOfWeek` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startMinute` int DEFAULT NULL,
  `endMinute` int DEFAULT NULL,
  `isManualOnly` tinyint(1) NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_discounts_businessId_idx` (`businessId`),
  KEY `paynpik_discounts_outletId_idx` (`outletId`),
  KEY `paynpik_discounts_targetType_idx` (`targetType`),
  KEY `paynpik_discounts_categoryId_idx` (`categoryId`),
  KEY `paynpik_discounts_subcategoryId_idx` (`subcategoryId`),
  KEY `paynpik_discounts_itemId_idx` (`itemId`),
  KEY `paynpik_discounts_isActive_validFrom_validUntil_idx` (`isActive`,`validFrom`,`validUntil`),
  CONSTRAINT `paynpik_discounts_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_discounts_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `paynpik_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_discounts_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_discounts_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_discounts_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `paynpik_subcategories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_discounts`
--

LOCK TABLES `paynpik_discounts` WRITE;
/*!40000 ALTER TABLE `paynpik_discounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_discounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_disputes`
--

DROP TABLE IF EXISTS `paynpik_disputes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_disputes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `claimAmount` decimal(10,2) DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `resolution` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachments` json NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_disputes_orderId_fkey` (`orderId`),
  CONSTRAINT `paynpik_disputes_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_disputes`
--

LOCK TABLES `paynpik_disputes` WRITE;
/*!40000 ALTER TABLE `paynpik_disputes` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_disputes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_facilities`
--

DROP TABLE IF EXISTS `paynpik_facilities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_facilities` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facilityType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `totalSeating` int DEFAULT NULL,
  `operationalHours` json DEFAULT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_facilities_businessId_fkey` (`businessId`),
  CONSTRAINT `paynpik_facilities_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_facilities`
--

LOCK TABLES `paynpik_facilities` WRITE;
/*!40000 ALTER TABLE `paynpik_facilities` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_facilities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_favorites`
--

DROP TABLE IF EXISTS `paynpik_favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_favorites` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_favorites_userId_itemId_key` (`userId`,`itemId`),
  KEY `paynpik_favorites_userId_idx` (`userId`),
  KEY `paynpik_favorites_itemId_fkey` (`itemId`),
  CONSTRAINT `paynpik_favorites_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_favorites_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_favorites`
--

LOCK TABLES `paynpik_favorites` WRITE;
/*!40000 ALTER TABLE `paynpik_favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_idempotency_keys`
--

DROP TABLE IF EXISTS `paynpik_idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_idempotency_keys` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `statusCode` int NOT NULL,
  `body` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_idempotency_keys_key_key` (`key`),
  KEY `paynpik_idempotency_keys_expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_idempotency_keys`
--

LOCK TABLES `paynpik_idempotency_keys` WRITE;
/*!40000 ALTER TABLE `paynpik_idempotency_keys` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_idempotency_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_integration_configs`
--

DROP TABLE IF EXISTS `paynpik_integration_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_integration_configs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('WHATSAPP','SMS','EMAIL','PAYMENT_GATEWAY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `providerKey` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `providerName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `config` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_integration_configs_channel_providerKey_key` (`channel`,`providerKey`),
  KEY `paynpik_integration_configs_channel_isDefault_idx` (`channel`,`isDefault`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_integration_configs`
--

LOCK TABLES `paynpik_integration_configs` WRITE;
/*!40000 ALTER TABLE `paynpik_integration_configs` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_integration_configs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_invoices`
--

DROP TABLE IF EXISTS `paynpik_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_invoices` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `gstAmount` decimal(10,2) NOT NULL,
  `totalAmount` decimal(10,2) NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `dueDate` datetime(3) NOT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `subscriptionId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_invoices_subscriptionId_fkey` (`subscriptionId`),
  CONSTRAINT `paynpik_invoices_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `paynpik_subscriptions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_invoices`
--

LOCK TABLES `paynpik_invoices` WRITE;
/*!40000 ALTER TABLE `paynpik_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_item_bundle_children`
--

DROP TABLE IF EXISTS `paynpik_item_bundle_children`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_item_bundle_children` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentItemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `childItemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variantId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `displayOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_item_bundle_children_parentItemId_idx` (`parentItemId`),
  KEY `paynpik_item_bundle_children_childItemId_idx` (`childItemId`),
  KEY `paynpik_item_bundle_children_variantId_fkey` (`variantId`),
  CONSTRAINT `paynpik_item_bundle_children_childItemId_fkey` FOREIGN KEY (`childItemId`) REFERENCES `paynpik_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_item_bundle_children_parentItemId_fkey` FOREIGN KEY (`parentItemId`) REFERENCES `paynpik_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_item_bundle_children_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_item_bundle_children`
--

LOCK TABLES `paynpik_item_bundle_children` WRITE;
/*!40000 ALTER TABLE `paynpik_item_bundle_children` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_item_bundle_children` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_item_images`
--

DROP TABLE IF EXISTS `paynpik_item_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_item_images` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_item_images_itemId_displayOrder_idx` (`itemId`,`displayOrder`),
  CONSTRAINT `paynpik_item_images_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_item_images`
--

LOCK TABLES `paynpik_item_images` WRITE;
/*!40000 ALTER TABLE `paynpik_item_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_item_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_item_tags`
--

DROP TABLE IF EXISTS `paynpik_item_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_item_tags` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_item_tags_itemId_fkey` (`itemId`),
  CONSTRAINT `paynpik_item_tags_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_item_tags`
--

LOCK TABLES `paynpik_item_tags` WRITE;
/*!40000 ALTER TABLE `paynpik_item_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_item_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_item_toppings`
--

DROP TABLE IF EXISTS `paynpik_item_toppings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_item_toppings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toppingId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `priceAdd` decimal(10,2) DEFAULT NULL,
  `isRequired` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_item_toppings_itemId_toppingId_key` (`itemId`,`toppingId`),
  KEY `paynpik_item_toppings_toppingId_fkey` (`toppingId`),
  CONSTRAINT `paynpik_item_toppings_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_item_toppings_toppingId_fkey` FOREIGN KEY (`toppingId`) REFERENCES `paynpik_toppings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_item_toppings`
--

LOCK TABLES `paynpik_item_toppings` WRITE;
/*!40000 ALTER TABLE `paynpik_item_toppings` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_item_toppings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_items`
--

DROP TABLE IF EXISTS `paynpik_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shortDescription` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `longDescription` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thumbnailUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `imageUrl` text COLLATE utf8mb4_unicode_ci,
  `basePrice` decimal(10,2) NOT NULL,
  `gstRate` decimal(5,2) DEFAULT NULL,
  `parcelAvailable` tinyint(1) NOT NULL DEFAULT '1',
  `useCustomParcelCharge` tinyint(1) NOT NULL DEFAULT '0',
  `parcelCharge` decimal(10,2) DEFAULT NULL,
  `preparationTime` int DEFAULT NULL,
  `foodGrade` enum('VEG','NON_VEG','VEGAN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'VEG',
  `isAvailable` tinyint(1) NOT NULL DEFAULT '1',
  `isDisplayed` tinyint(1) NOT NULL DEFAULT '1',
  `isPopular` tinyint(1) NOT NULL DEFAULT '0',
  `isSpecial` tinyint(1) NOT NULL DEFAULT '0',
  `hasLimitedStock` tinyint(1) NOT NULL DEFAULT '0',
  `availableQuantity` int NOT NULL DEFAULT '0',
  `displayOrder` int NOT NULL DEFAULT '0',
  `subcategoryId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kitchenStationId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `isBundle` tinyint(1) NOT NULL DEFAULT '0',
  `maxBundleSelections` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_items_subcategoryId_fkey` (`subcategoryId`),
  KEY `paynpik_items_kitchenStationId_fkey` (`kitchenStationId`),
  CONSTRAINT `paynpik_items_kitchenStationId_fkey` FOREIGN KEY (`kitchenStationId`) REFERENCES `paynpik_kitchen_stations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_items_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `paynpik_subcategories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_items`
--

LOCK TABLES `paynpik_items` WRITE;
/*!40000 ALTER TABLE `paynpik_items` DISABLE KEYS */;
INSERT INTO `paynpik_items` VALUES ('cmprtfu2z0022100xrprd7wsx','Masala Dosa','Crispy dosa with spiced potato filling',NULL,NULL,NULL,NULL,80.00,NULL,1,0,NULL,10,'VEG',1,1,1,0,0,0,0,'cmprtfu21001w100xvwqw0f7m',NULL,'2026-05-30 03:53:22.955','2026-05-30 03:53:22.955',0,NULL),('cmprtfu3t0027100xewolbjh5','Idli (2 Pcs)',NULL,NULL,NULL,NULL,NULL,50.00,NULL,1,0,NULL,8,'VEG',1,1,0,0,0,0,0,'cmprtfu21001w100xvwqw0f7m',NULL,'2026-05-30 03:53:22.985','2026-05-30 03:53:22.985',0,NULL),('cmprtfu450029100x15ctwswr','Butter Chicken',NULL,NULL,NULL,NULL,NULL,280.00,NULL,1,0,NULL,20,'VEG',1,1,1,0,0,0,0,'cmprtfu2t001y100x034mw49c',NULL,'2026-05-30 03:53:22.998','2026-05-30 03:53:22.998',0,NULL),('cmprtfu4c002b100xd2zqlvni','Paneer Butter Masala',NULL,NULL,NULL,NULL,NULL,240.00,NULL,1,0,NULL,18,'VEG',1,1,0,0,0,0,0,'cmprtfu2t001y100x034mw49c',NULL,'2026-05-30 03:53:23.004','2026-05-30 03:53:23.004',0,NULL),('cmprtfu4g002d100x8pyv1o9f','Filter Coffee',NULL,NULL,NULL,NULL,NULL,40.00,NULL,1,0,NULL,3,'VEG',1,1,1,0,0,0,0,'cmprtfu2w0020100xzm8ai8ni',NULL,'2026-05-30 03:53:23.009','2026-05-30 03:53:23.009',0,NULL);
/*!40000 ALTER TABLE `paynpik_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_kitchen_stations`
--

DROP TABLE IF EXISTS `paynpik_kitchen_stations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_kitchen_stations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `isMaster` tinyint(1) NOT NULL DEFAULT '0',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `currentWorkerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `printerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_kitchen_stations_outletId_fkey` (`outletId`),
  KEY `paynpik_kitchen_stations_currentWorkerId_fkey` (`currentWorkerId`),
  KEY `paynpik_kitchen_stations_printerId_fkey` (`printerId`),
  CONSTRAINT `paynpik_kitchen_stations_currentWorkerId_fkey` FOREIGN KEY (`currentWorkerId`) REFERENCES `paynpik_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_kitchen_stations_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_kitchen_stations_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `paynpik_printers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_kitchen_stations`
--

LOCK TABLES `paynpik_kitchen_stations` WRITE;
/*!40000 ALTER TABLE `paynpik_kitchen_stations` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_kitchen_stations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_languages`
--

DROP TABLE IF EXISTS `paynpik_languages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_languages` (
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nativeName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_languages`
--

LOCK TABLES `paynpik_languages` WRITE;
/*!40000 ALTER TABLE `paynpik_languages` DISABLE KEYS */;
INSERT INTO `paynpik_languages` VALUES ('en','English','English',1,'2026-05-30 03:53:21.140','2026-05-30 03:53:21.140'),('hi','Hindi','हिन्दी',1,'2026-05-30 03:53:21.187','2026-05-30 03:53:21.187');
/*!40000 ALTER TABLE `paynpik_languages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_leads`
--

DROP TABLE IF EXISTS `paynpik_leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_leads` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `restaurantName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outletCount` int DEFAULT NULL,
  `businessType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT 'landing-page',
  `status` enum('NEW','CONTACTED','QUALIFIED','CONVERTED','LOST') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEW',
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_leads_status_idx` (`status`),
  KEY `paynpik_leads_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_leads`
--

LOCK TABLES `paynpik_leads` WRITE;
/*!40000 ALTER TABLE `paynpik_leads` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_material_categories`
--

DROP TABLE IF EXISTS `paynpik_material_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_material_categories` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_material_categories_parentId_fkey` (`parentId`),
  CONSTRAINT `paynpik_material_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `paynpik_material_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_material_categories`
--

LOCK TABLES `paynpik_material_categories` WRITE;
/*!40000 ALTER TABLE `paynpik_material_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_material_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_materials`
--

DROP TABLE IF EXISTS `paynpik_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_materials` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `currentStock` decimal(10,3) NOT NULL DEFAULT '0.000',
  `reorderLevel` decimal(10,3) DEFAULT NULL,
  `costPerUnit` decimal(10,2) DEFAULT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoryId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_materials_businessId_fkey` (`businessId`),
  KEY `paynpik_materials_categoryId_fkey` (`categoryId`),
  CONSTRAINT `paynpik_materials_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_materials_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `paynpik_material_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_materials`
--

LOCK TABLES `paynpik_materials` WRITE;
/*!40000 ALTER TABLE `paynpik_materials` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_materials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_menu_timing_slots`
--

DROP TABLE IF EXISTS `paynpik_menu_timing_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_menu_timing_slots` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `menuId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dayOfWeek` int NOT NULL,
  `startMinute` int NOT NULL,
  `endMinute` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_menu_timing_slots_menuId_dayOfWeek_idx` (`menuId`,`dayOfWeek`),
  CONSTRAINT `paynpik_menu_timing_slots_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_menu_timing_slots`
--

LOCK TABLES `paynpik_menu_timing_slots` WRITE;
/*!40000 ALTER TABLE `paynpik_menu_timing_slots` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_menu_timing_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_menus`
--

DROP TABLE IF EXISTS `paynpik_menus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_menus` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `displayOrder` int NOT NULL DEFAULT '0',
  `isDefault` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_menus_businessId_displayOrder_idx` (`businessId`,`displayOrder`),
  CONSTRAINT `paynpik_menus_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_menus`
--

LOCK TABLES `paynpik_menus` WRITE;
/*!40000 ALTER TABLE `paynpik_menus` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_menus` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_message_templates`
--

DROP TABLE IF EXISTS `paynpik_message_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_message_templates` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` enum('PLATFORM','BUSINESS','OUTLET') COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('WHATSAPP','SMS','EMAIL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('TRANSACTIONAL','PROMOTIONAL','UTILITY','AUTH') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TRANSACTIONAL',
  `trigger` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `language` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'en',
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json NOT NULL,
  `approvalStatus` enum('DRAFT','PENDING_PLATFORM','PENDING_PROVIDER','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `providerKey` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `providerTemplateId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submittedAt` datetime(3) DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `rejectionReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_message_templates_scope_channel_approvalStatus_idx` (`scope`,`channel`,`approvalStatus`),
  KEY `paynpik_message_templates_businessId_idx` (`businessId`),
  KEY `paynpik_message_templates_outletId_idx` (`outletId`),
  CONSTRAINT `paynpik_message_templates_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_message_templates_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_message_templates`
--

LOCK TABLES `paynpik_message_templates` WRITE;
/*!40000 ALTER TABLE `paynpik_message_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_message_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_offers`
--

DROP TABLE IF EXISTS `paynpik_offers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_offers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `validFrom` datetime(3) DEFAULT NULL,
  `validUntil` datetime(3) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `buyItemId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buyQuantity` int DEFAULT NULL,
  `buyVariantId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `daysOfWeek` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `endMinute` int DEFAULT NULL,
  `getItemId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `getQuantity` int DEFAULT NULL,
  `getVariantId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `minBillAmount` decimal(10,2) DEFAULT NULL,
  `startMinute` int DEFAULT NULL,
  `triggerType` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_offers_businessId_idx` (`businessId`),
  KEY `paynpik_offers_outletId_idx` (`outletId`),
  KEY `paynpik_offers_isActive_idx` (`isActive`),
  KEY `paynpik_offers_buyItemId_fkey` (`buyItemId`),
  KEY `paynpik_offers_getItemId_fkey` (`getItemId`),
  CONSTRAINT `paynpik_offers_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_offers_buyItemId_fkey` FOREIGN KEY (`buyItemId`) REFERENCES `paynpik_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_offers_getItemId_fkey` FOREIGN KEY (`getItemId`) REFERENCES `paynpik_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_offers_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_offers`
--

LOCK TABLES `paynpik_offers` WRITE;
/*!40000 ALTER TABLE `paynpik_offers` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_offers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_options`
--

DROP TABLE IF EXISTS `paynpik_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_options` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_options_itemId_fkey` (`itemId`),
  CONSTRAINT `paynpik_options_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_options`
--

LOCK TABLES `paynpik_options` WRITE;
/*!40000 ALTER TABLE `paynpik_options` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_order_item_reviews`
--

DROP TABLE IF EXISTS `paynpik_order_item_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_order_item_reviews` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderItemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` int NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `paybackAmount` decimal(10,2) DEFAULT NULL,
  `paybackPaymentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `repliedAt` datetime(3) DEFAULT NULL,
  `replyByUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replyText` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_order_item_reviews_orderItemId_key` (`orderItemId`),
  UNIQUE KEY `paynpik_order_item_reviews_paybackPaymentId_key` (`paybackPaymentId`),
  KEY `paynpik_order_item_reviews_itemId_idx` (`itemId`),
  KEY `paynpik_order_item_reviews_customerId_idx` (`customerId`),
  KEY `paynpik_order_item_reviews_replyByUserId_fkey` (`replyByUserId`),
  CONSTRAINT `paynpik_order_item_reviews_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `paynpik_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_item_reviews_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_item_reviews_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `paynpik_order_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_item_reviews_paybackPaymentId_fkey` FOREIGN KEY (`paybackPaymentId`) REFERENCES `paynpik_payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_item_reviews_replyByUserId_fkey` FOREIGN KEY (`replyByUserId`) REFERENCES `paynpik_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_order_item_reviews`
--

LOCK TABLES `paynpik_order_item_reviews` WRITE;
/*!40000 ALTER TABLE `paynpik_order_item_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_order_item_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_order_items`
--

DROP TABLE IF EXISTS `paynpik_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_order_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `totalPrice` decimal(10,2) NOT NULL,
  `gstRate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `gstAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','PREPARING','READY','SERVED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variantId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `menuId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bundleId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sequenceNumber` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_order_items_menuId_idx` (`menuId`),
  KEY `paynpik_order_items_orderId_fkey` (`orderId`),
  KEY `paynpik_order_items_itemId_fkey` (`itemId`),
  KEY `paynpik_order_items_variantId_fkey` (`variantId`),
  KEY `paynpik_order_items_bundleId_idx` (`bundleId`),
  CONSTRAINT `paynpik_order_items_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `paynpik_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_items_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_order_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_order_items`
--

LOCK TABLES `paynpik_order_items` WRITE;
/*!40000 ALTER TABLE `paynpik_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_order_status_history`
--

DROP TABLE IF EXISTS `paynpik_order_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_order_status_history` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('CREATED','QUEUED','PREPARING','READY','READY_FOR_PICKUP','OUT_FOR_SERVICE','SERVED','CANCELLED','DISPUTED','RESOLVED','FOR_REFUND','REFUND_COMPLETE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_order_status_history_orderId_fkey` (`orderId`),
  CONSTRAINT `paynpik_order_status_history_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_order_status_history`
--

LOCK TABLES `paynpik_order_status_history` WRITE;
/*!40000 ALTER TABLE `paynpik_order_status_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_order_status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_orders`
--

DROP TABLE IF EXISTS `paynpik_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_orders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenNumber` int DEFAULT NULL,
  `status` enum('CREATED','QUEUED','PREPARING','READY','READY_FOR_PICKUP','OUT_FOR_SERVICE','SERVED','CANCELLED','DISPUTED','RESOLVED','FOR_REFUND','REFUND_COMPLETE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREATED',
  `isParcel` tinyint(1) NOT NULL DEFAULT '0',
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `taxAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `sgstAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `cgstAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `parcelAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discountAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalAmount` decimal(10,2) NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sectionId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tableId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staffId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `billRequestedAt` datetime(3) DEFAULT NULL,
  `isPostpaid` tinyint(1) NOT NULL DEFAULT '0',
  `clusterOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activeSequence` int NOT NULL DEFAULT '1',
  `sequenceLabels` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_orders_orderNumber_key` (`orderNumber`),
  KEY `paynpik_orders_outletId_fkey` (`outletId`),
  KEY `paynpik_orders_sectionId_fkey` (`sectionId`),
  KEY `paynpik_orders_tableId_fkey` (`tableId`),
  KEY `paynpik_orders_customerId_fkey` (`customerId`),
  KEY `paynpik_orders_staffId_fkey` (`staffId`),
  KEY `paynpik_orders_clusterOrderId_idx` (`clusterOrderId`),
  CONSTRAINT `paynpik_orders_clusterOrderId_fkey` FOREIGN KEY (`clusterOrderId`) REFERENCES `paynpik_cluster_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `paynpik_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_orders_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_orders_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `paynpik_sections` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_orders_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `paynpik_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_orders_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `paynpik_tables` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_orders`
--

LOCK TABLES `paynpik_orders` WRITE;
/*!40000 ALTER TABLE `paynpik_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_outlet_customers`
--

DROP TABLE IF EXISTS `paynpik_outlet_customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_outlet_customers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_outlet_customers_outletId_userId_key` (`outletId`,`userId`),
  KEY `paynpik_outlet_customers_outletId_idx` (`outletId`),
  KEY `paynpik_outlet_customers_userId_fkey` (`userId`),
  CONSTRAINT `paynpik_outlet_customers_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_outlet_customers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_outlet_customers`
--

LOCK TABLES `paynpik_outlet_customers` WRITE;
/*!40000 ALTER TABLE `paynpik_outlet_customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_outlet_customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_outlet_hours`
--

DROP TABLE IF EXISTS `paynpik_outlet_hours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_outlet_hours` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dayOfWeek` int NOT NULL,
  `openTime` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `closeTime` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_outlet_hours_outletId_dayOfWeek_idx` (`outletId`,`dayOfWeek`),
  CONSTRAINT `paynpik_outlet_hours_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_outlet_hours`
--

LOCK TABLES `paynpik_outlet_hours` WRITE;
/*!40000 ALTER TABLE `paynpik_outlet_hours` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_outlet_hours` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_outlet_images`
--

DROP TABLE IF EXISTS `paynpik_outlet_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_outlet_images` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_outlet_images_outletId_displayOrder_idx` (`outletId`,`displayOrder`),
  CONSTRAINT `paynpik_outlet_images_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_outlet_images`
--

LOCK TABLES `paynpik_outlet_images` WRITE;
/*!40000 ALTER TABLE `paynpik_outlet_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_outlet_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_outlet_menu_timing_slots`
--

DROP TABLE IF EXISTS `paynpik_outlet_menu_timing_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_outlet_menu_timing_slots` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletMenuId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dayOfWeek` int NOT NULL,
  `startMinute` int NOT NULL,
  `endMinute` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_outlet_menu_timing_slots_outletMenuId_dayOfWeek_idx` (`outletMenuId`,`dayOfWeek`),
  CONSTRAINT `paynpik_outlet_menu_timing_slots_outletMenuId_fkey` FOREIGN KEY (`outletMenuId`) REFERENCES `paynpik_outlet_menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_outlet_menu_timing_slots`
--

LOCK TABLES `paynpik_outlet_menu_timing_slots` WRITE;
/*!40000 ALTER TABLE `paynpik_outlet_menu_timing_slots` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_outlet_menu_timing_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_outlet_menus`
--

DROP TABLE IF EXISTS `paynpik_outlet_menus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_outlet_menus` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `menuId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `overrideTimings` tinyint(1) NOT NULL DEFAULT '0',
  `displayOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_outlet_menus_outletId_menuId_key` (`outletId`,`menuId`),
  KEY `paynpik_outlet_menus_outletId_displayOrder_idx` (`outletId`,`displayOrder`),
  KEY `paynpik_outlet_menus_menuId_fkey` (`menuId`),
  CONSTRAINT `paynpik_outlet_menus_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_outlet_menus_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_outlet_menus`
--

LOCK TABLES `paynpik_outlet_menus` WRITE;
/*!40000 ALTER TABLE `paynpik_outlet_menus` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_outlet_menus` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_outlets`
--

DROP TABLE IF EXISTS `paynpik_outlets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_outlets` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletType` enum('SELF_SERVICE','SELF_SERVICE_PARCEL','DINE_IN_PREPAID','DINE_IN_POSTPAID','HYBRID') COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addressLine1` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addressLine2` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT 'India',
  `mapsLocation` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upiId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logoUrl` text COLLATE utf8mb4_unicode_ci,
  `primaryImageUrl` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `defaultPrepTime` int DEFAULT NULL,
  `parcelChargeEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `defaultParcelCharge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `nextOrderSequence` int NOT NULL DEFAULT '1',
  `tokenStartNumber` int NOT NULL DEFAULT '1',
  `nextTokenNumber` int NOT NULL DEFAULT '1',
  `gstApplicable` tinyint(1) NOT NULL DEFAULT '0',
  `gstPercent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `priceIncludesGst` tinyint(1) NOT NULL DEFAULT '0',
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facilityId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `multipleMenusEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `publicCode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpayLinkedAccountId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acceptRewardRedemption` tinyint(1) NOT NULL DEFAULT '1',
  `kitchenAllowManualPrint` tinyint(1) NOT NULL DEFAULT '0',
  `kitchenAutoPrint` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_outlets_publicCode_key` (`publicCode`),
  KEY `paynpik_outlets_businessId_fkey` (`businessId`),
  KEY `paynpik_outlets_facilityId_fkey` (`facilityId`),
  CONSTRAINT `paynpik_outlets_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_outlets_facilityId_fkey` FOREIGN KEY (`facilityId`) REFERENCES `paynpik_facilities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_outlets`
--

LOCK TABLES `paynpik_outlets` WRITE;
/*!40000 ALTER TABLE `paynpik_outlets` DISABLE KEYS */;
INSERT INTO `paynpik_outlets` VALUES ('demo-outlet','Demo Outlet - Koramangala','DINE_IN_POSTPAID','123, 80 Feet Road, Koramangala, Bengaluru - 560034',NULL,NULL,NULL,NULL,NULL,'India',NULL,NULL,NULL,'29ABCDE1234F1Z5',NULL,NULL,NULL,1,NULL,1,0.00,1,1,1,0,0.00,0,'demo-business',NULL,'2026-05-30 03:53:22.775','2026-05-30 03:53:22.775',0,NULL,NULL,1,0,0);
/*!40000 ALTER TABLE `paynpik_outlets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_payments`
--

DROP TABLE IF EXISTS `paynpik_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_payments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `mode` enum('UPI','CARD','CASH','WALLET','NET_BANKING') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','SUCCESS','FAILED','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `gatewayRef` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gatewayResponse` json DEFAULT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `isRefund` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `paynpik_payments_orderId_fkey` (`orderId`),
  CONSTRAINT `paynpik_payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_payments`
--

LOCK TABLES `paynpik_payments` WRITE;
/*!40000 ALTER TABLE `paynpik_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_plans`
--

DROP TABLE IF EXISTS `paynpik_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_plans` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monthlyCost` decimal(10,2) NOT NULL,
  `annualCost` decimal(10,2) NOT NULL,
  `maxOutlets` int NOT NULL,
  `maxUsers` int NOT NULL,
  `transactionLimit` int DEFAULT NULL,
  `storageLimit` int DEFAULT NULL,
  `features` json NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_plans`
--

LOCK TABLES `paynpik_plans` WRITE;
/*!40000 ALTER TABLE `paynpik_plans` DISABLE KEYS */;
INSERT INTO `paynpik_plans` VALUES ('plan-enterprise','Enterprise',NULL,7999.00,79999.00,9999,9999,NULL,NULL,'{\"kds\": true, \"pos\": true, \"whatsapp\": true, \"analytics\": true, \"inventory\": true, \"qrOrdering\": true, \"onlineOrdering\": true}',1,'2026-05-30 03:53:22.394','2026-05-30 03:53:22.394'),('plan-growth','Growth',NULL,2499.00,24999.00,10,50,25000,20,'{\"kds\": true, \"pos\": true, \"analytics\": true, \"inventory\": true, \"qrOrdering\": true}',1,'2026-05-30 03:53:22.388','2026-05-30 03:53:22.388'),('plan-starter','Starter',NULL,999.00,9999.00,2,10,5000,5,'{\"kds\": true, \"pos\": true, \"analytics\": false, \"inventory\": false, \"qrOrdering\": true}',1,'2026-05-30 03:53:22.340','2026-05-30 03:53:22.340');
/*!40000 ALTER TABLE `paynpik_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_printers`
--

DROP TABLE IF EXISTS `paynpik_printers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_printers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BLUETOOTH',
  `address` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_printers_outletId_idx` (`outletId`),
  CONSTRAINT `paynpik_printers_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_printers`
--

LOCK TABLES `paynpik_printers` WRITE;
/*!40000 ALTER TABLE `paynpik_printers` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_printers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_purchase_orders`
--

DROP TABLE IF EXISTS `paynpik_purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_purchase_orders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `poNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `totalAmount` decimal(10,2) NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `paymentStatus` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNPAID',
  `vendorId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `materialId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_purchase_orders_poNumber_key` (`poNumber`),
  KEY `paynpik_purchase_orders_vendorId_fkey` (`vendorId`),
  KEY `paynpik_purchase_orders_materialId_fkey` (`materialId`),
  CONSTRAINT `paynpik_purchase_orders_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `paynpik_materials` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_purchase_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `paynpik_vendors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_purchase_orders`
--

LOCK TABLES `paynpik_purchase_orders` WRITE;
/*!40000 ALTER TABLE `paynpik_purchase_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_qr_codes`
--

DROP TABLE IF EXISTS `paynpik_qr_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_qr_codes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('TABLE','OUTLET','CUSTOMER','PAYMENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `imageUrl` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tableId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_qr_codes_code_key` (`code`),
  UNIQUE KEY `paynpik_qr_codes_tableId_key` (`tableId`),
  KEY `paynpik_qr_codes_outletId_fkey` (`outletId`),
  CONSTRAINT `paynpik_qr_codes_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_qr_codes_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `paynpik_tables` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_qr_codes`
--

LOCK TABLES `paynpik_qr_codes` WRITE;
/*!40000 ALTER TABLE `paynpik_qr_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_qr_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_responsibilities`
--

DROP TABLE IF EXISTS `paynpik_responsibilities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_responsibilities` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_responsibilities_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_responsibilities`
--

LOCK TABLES `paynpik_responsibilities` WRITE;
/*!40000 ALTER TABLE `paynpik_responsibilities` DISABLE KEYS */;
INSERT INTO `paynpik_responsibilities` VALUES ('cmprtfsq50000100x3fsh6syf','PLATFORM_ADMIN','Full platform administration access','PLATFORM'),('cmprtfsqm0001100x92ybrjgp','MANAGE_MENU','Manage categories and subcategories','MENU'),('cmprtfsqp0002100xb53ddbu2','VIEW_PLATFORM_REPORTS','View platform-wide summary & hourly reports','PLATFORM'),('cmprtfsr10003100xvv524hmj','VIEW_ORDERS','View orders list & details','ORDERS'),('cmprtfsra0004100xzhcyo4u7','UPDATE_ITEM_STATUS','Update kitchen item status (start/ready)','ORDERS'),('cmprtfsra0005100xjfanlpoh','MANAGE_OUTLET_HOURS','Update outlet operating hours','OUTLETS'),('cmprtfsra0006100xa4pcgman','MANAGE_KITCHEN_STATIONS','Manage kitchen stations and item routing','KITCHEN'),('cmprtfsrc0007100xpzfpdywd','UPDATE_ORDER_STATUS','Move orders through workflow states','ORDERS'),('cmprtfsrc0008100x6ud3gb0d','MANAGE_LEADS','View and update sales leads','PLATFORM'),('cmprtfsrc0009100xfk5afci5','VIEW_VENDORS','View vendors','INVENTORY'),('cmprtfsrg000a100xf25egw6x','MANAGE_OUTLET_IMAGES','Upload or remove outlet images','OUTLETS'),('cmprtfsrg000b100xk8ned8zy','MANAGE_PLANS','Create or update subscription plans','PLATFORM'),('cmprtfsrk000c100xby7tekbc','CREATE_ORDER','Create new orders','ORDERS'),('cmprtfsrm000d100x58pxq5fl','MANAGE_MENU_ITEMS','Create, update or remove items, variants and images','MENU'),('cmprtfsrm000e100xfy6c7kcm','VIEW_KITCHEN_REPORTS','View kitchen efficiency reports','REPORTS'),('cmprtfsrn000f100xmz8ma9cq','VIEW_STAFF','View staff users','USERS'),('cmprtfsrp000g100xqd36utx9','VIEW_BUSINESSES','View businesses list & details','BUSINESSES'),('cmprtfsrr000h100xvjmvpg9e','COLLECT_PAYMENT','Initiate and confirm payments','PAYMENTS'),('cmprtfss0000i100xmh5u829q','MANAGE_STAFF','Invite, update or toggle staff','USERS'),('cmprtfss2000j100x4ztoi53h','MANAGE_ROLES','Manage custom roles and responsibilities','USERS'),('cmprtfss2000k100xw471ekd1','MANAGE_BUSINESSES','Create, update or toggle businesses','BUSINESSES'),('cmprtfss2000l100xp2j21azl','VIEW_CUSTOMERS','View customer list','CUSTOMERS'),('cmprtfss2000m100xrkszw7w3','TOGGLE_ITEM_AVAILABILITY','Quickly toggle item availability','MENU'),('cmprtfss2000n100xuhaiswkz','MANAGE_BUSINESS_IMAGES','Upload or remove business images','BUSINESSES'),('cmprtfssg000o100xptyg467o','MANAGE_CUSTOMERS','Create or update customer records','CUSTOMERS'),('cmprtfssj000p100xwkwac0ub','MANAGE_VENDORS','Create, update or remove vendors','INVENTORY'),('cmprtfssn000q100xvgyrapkj','MANAGE_CUSTOMER_TAGS','Manage customer tags and tag-based pricing','CUSTOMERS'),('cmprtfsso000r100xsw4j90gi','IMPORT_MENU','Import a menu from another outlet','MENU'),('cmprtfsso000s100xbkrt4wu1','ASSIGN_CUSTOMER_TAGS','Assign tags to customer profiles','CUSTOMERS'),('cmprtfsso000t100x380m4kdy','VIEW_REPORTS','View revenue, item-sales and hourly reports','REPORTS'),('cmprtfssx000u100xved04tov','VIEW_OUTLETS','View outlets list & details','OUTLETS'),('cmprtfst0000v100xtvwo10ju','MANAGE_TOPPINGS','Manage toppings and item topping assignments','MENU'),('cmprtfst3000w100x1737c2q7','VIEW_QR_CODES','View QR codes for outlet & tables','QR'),('cmprtfst7000x100xblim2sjt','MANAGE_QR_CODES','Generate or regenerate QR codes','QR'),('cmprtfst9000y100xxo33cqde','MANAGE_SUBSCRIPTIONS','Subscribe a business to a plan','BILLING'),('cmprtfst9000z100xktbi1d6c','VIEW_DISPUTES','View disputes for an outlet','DISPUTES'),('cmprtfstb0010100xbm67022v','VIEW_PAYMENTS','View payment history per order','PAYMENTS'),('cmprtfstb0011100xhatuzgjs','MANAGE_OUTLETS','Create or update outlets','OUTLETS'),('cmprtfstb0012100xidlg5llf','VIEW_KITCHEN','View the kitchen display / KDS queue','KITCHEN'),('cmprtfsth0013100x8i30nzaq','VIEW_OWN_ORDERS','View own order history','CUSTOMER'),('cmprtfstj0014100xkgiphjlb','MANAGE_DISPUTES','Respond to and resolve disputes','DISPUTES'),('cmprtfstk0015100xstxybhdl','MANAGE_FAVORITES','Add or remove favorite items','CUSTOMER'),('cmprtfstk0016100x6xyvsx3v','PLACE_CUSTOMER_ORDER','Place orders from the customer app','CUSTOMER'),('cmprtfstk0017100xx944q9oj','VIEW_INVENTORY','View raw materials and stock levels','INVENTORY'),('cmprtfstk0018100x2i62bw4i','RAISE_DISPUTE','Raise a dispute on an order','CUSTOMER'),('cmprtfstr0019100x69joh0gy','CANCEL_ORDER','Cancel existing orders','ORDERS'),('cmprtfstt001a100x2bmdnnl0','MANAGE_PURCHASE_ORDERS','Create and receive purchase orders','INVENTORY'),('cmprtfstv001b100x5zr2pn2c','MANAGE_INVENTORY','Create raw materials and record consumption','INVENTORY'),('cmprtfstv001c100x3fu7nvsx','VIEW_INVOICES','View invoices for a business','BILLING'),('cmprtfstv001d100x6926l9em','MANAGE_SECTIONS','Manage sections within an outlet','OUTLETS'),('cmprtfstv001e100xya3qalit','MANAGE_TABLES','Create or remove tables','OUTLETS'),('cmprtfsu4001f100xbv1mtu4g','MANAGE_TABLE_TYPES','Manage table types and table-type pricing','OUTLETS'),('cmprtfsu6001g100xvvus2c8r','VIEW_MENU','View menu items, categories and subcategories','MENU');
/*!40000 ALTER TABLE `paynpik_responsibilities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_reward_accounts`
--

DROP TABLE IF EXISTS `paynpik_reward_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_reward_accounts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `balance` int NOT NULL DEFAULT '0',
  `lifetimeEarned` int NOT NULL DEFAULT '0',
  `lifetimeRedeemed` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_reward_accounts_userId_key` (`userId`),
  CONSTRAINT `paynpik_reward_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_reward_accounts`
--

LOCK TABLES `paynpik_reward_accounts` WRITE;
/*!40000 ALTER TABLE `paynpik_reward_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_reward_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_reward_config`
--

DROP TABLE IF EXISTS `paynpik_reward_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_reward_config` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `earnRate` decimal(8,4) NOT NULL DEFAULT '0.1000',
  `redeemRate` decimal(8,4) NOT NULL DEFAULT '1.0000',
  `minRedemptionPoints` int NOT NULL DEFAULT '50',
  `maxRedemptionPercent` decimal(5,2) NOT NULL DEFAULT '50.00',
  `expiryDays` int DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_reward_config`
--

LOCK TABLES `paynpik_reward_config` WRITE;
/*!40000 ALTER TABLE `paynpik_reward_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_reward_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_reward_transactions`
--

DROP TABLE IF EXISTS `paynpik_reward_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_reward_transactions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `points` int NOT NULL,
  `amountValue` decimal(10,2) DEFAULT NULL,
  `balanceAfter` int NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clusterOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiresAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paynpik_reward_transactions_userId_idx` (`userId`),
  KEY `paynpik_reward_transactions_accountId_idx` (`accountId`),
  KEY `paynpik_reward_transactions_orderId_idx` (`orderId`),
  KEY `paynpik_reward_transactions_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `paynpik_reward_transactions_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `paynpik_reward_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_reward_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_reward_transactions`
--

LOCK TABLES `paynpik_reward_transactions` WRITE;
/*!40000 ALTER TABLE `paynpik_reward_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_reward_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_role_responsibilities`
--

DROP TABLE IF EXISTS `paynpik_role_responsibilities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_role_responsibilities` (
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `responsibilityId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`roleId`,`responsibilityId`),
  KEY `paynpik_role_responsibilities_responsibilityId_fkey` (`responsibilityId`),
  CONSTRAINT `paynpik_role_responsibilities_responsibilityId_fkey` FOREIGN KEY (`responsibilityId`) REFERENCES `paynpik_responsibilities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_role_responsibilities_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `paynpik_roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_role_responsibilities`
--

LOCK TABLES `paynpik_role_responsibilities` WRITE;
/*!40000 ALTER TABLE `paynpik_role_responsibilities` DISABLE KEYS */;
INSERT INTO `paynpik_role_responsibilities` VALUES ('platform-admin-role','cmprtfsq50000100x3fsh6syf'),('business-owner-role','cmprtfsqm0001100x92ybrjgp'),('business-owner-template','cmprtfsqm0001100x92ybrjgp'),('outlet-admin-role','cmprtfsqm0001100x92ybrjgp'),('platform-admin-role','cmprtfsqm0001100x92ybrjgp'),('platform-admin-role','cmprtfsqp0002100xb53ddbu2'),('business-owner-role','cmprtfsr10003100xvv524hmj'),('business-owner-template','cmprtfsr10003100xvv524hmj'),('cashier-role','cmprtfsr10003100xvv524hmj'),('kitchen-manager-role','cmprtfsr10003100xvv524hmj'),('outlet-admin-role','cmprtfsr10003100xvv524hmj'),('platform-admin-role','cmprtfsr10003100xvv524hmj'),('business-owner-role','cmprtfsra0004100xzhcyo4u7'),('business-owner-template','cmprtfsra0004100xzhcyo4u7'),('kitchen-manager-role','cmprtfsra0004100xzhcyo4u7'),('outlet-admin-role','cmprtfsra0004100xzhcyo4u7'),('platform-admin-role','cmprtfsra0004100xzhcyo4u7'),('business-owner-role','cmprtfsra0005100xjfanlpoh'),('business-owner-template','cmprtfsra0005100xjfanlpoh'),('outlet-admin-role','cmprtfsra0005100xjfanlpoh'),('platform-admin-role','cmprtfsra0005100xjfanlpoh'),('business-owner-role','cmprtfsra0006100xa4pcgman'),('business-owner-template','cmprtfsra0006100xa4pcgman'),('kitchen-manager-role','cmprtfsra0006100xa4pcgman'),('outlet-admin-role','cmprtfsra0006100xa4pcgman'),('platform-admin-role','cmprtfsra0006100xa4pcgman'),('business-owner-role','cmprtfsrc0007100xpzfpdywd'),('business-owner-template','cmprtfsrc0007100xpzfpdywd'),('kitchen-manager-role','cmprtfsrc0007100xpzfpdywd'),('outlet-admin-role','cmprtfsrc0007100xpzfpdywd'),('platform-admin-role','cmprtfsrc0007100xpzfpdywd'),('platform-admin-role','cmprtfsrc0008100x6ud3gb0d'),('business-owner-role','cmprtfsrc0009100xfk5afci5'),('business-owner-template','cmprtfsrc0009100xfk5afci5'),('outlet-admin-role','cmprtfsrc0009100xfk5afci5'),('platform-admin-role','cmprtfsrc0009100xfk5afci5'),('store-manager-role','cmprtfsrc0009100xfk5afci5'),('business-owner-role','cmprtfsrg000a100xf25egw6x'),('business-owner-template','cmprtfsrg000a100xf25egw6x'),('outlet-admin-role','cmprtfsrg000a100xf25egw6x'),('platform-admin-role','cmprtfsrg000a100xf25egw6x'),('platform-admin-role','cmprtfsrg000b100xk8ned8zy'),('business-owner-role','cmprtfsrk000c100xby7tekbc'),('business-owner-template','cmprtfsrk000c100xby7tekbc'),('cashier-role','cmprtfsrk000c100xby7tekbc'),('outlet-admin-role','cmprtfsrk000c100xby7tekbc'),('platform-admin-role','cmprtfsrk000c100xby7tekbc'),('business-owner-role','cmprtfsrm000d100x58pxq5fl'),('business-owner-template','cmprtfsrm000d100x58pxq5fl'),('outlet-admin-role','cmprtfsrm000d100x58pxq5fl'),('platform-admin-role','cmprtfsrm000d100x58pxq5fl'),('business-owner-role','cmprtfsrm000e100xfy6c7kcm'),('business-owner-template','cmprtfsrm000e100xfy6c7kcm'),('kitchen-manager-role','cmprtfsrm000e100xfy6c7kcm'),('outlet-admin-role','cmprtfsrm000e100xfy6c7kcm'),('platform-admin-role','cmprtfsrm000e100xfy6c7kcm'),('business-owner-role','cmprtfsrn000f100xmz8ma9cq'),('business-owner-template','cmprtfsrn000f100xmz8ma9cq'),('outlet-admin-role','cmprtfsrn000f100xmz8ma9cq'),('platform-admin-role','cmprtfsrn000f100xmz8ma9cq'),('business-owner-role','cmprtfsrp000g100xqd36utx9'),('business-owner-template','cmprtfsrp000g100xqd36utx9'),('outlet-admin-role','cmprtfsrp000g100xqd36utx9'),('platform-admin-role','cmprtfsrp000g100xqd36utx9'),('business-owner-role','cmprtfsrr000h100xvjmvpg9e'),('business-owner-template','cmprtfsrr000h100xvjmvpg9e'),('cashier-role','cmprtfsrr000h100xvjmvpg9e'),('outlet-admin-role','cmprtfsrr000h100xvjmvpg9e'),('platform-admin-role','cmprtfsrr000h100xvjmvpg9e'),('business-owner-role','cmprtfss0000i100xmh5u829q'),('business-owner-template','cmprtfss0000i100xmh5u829q'),('outlet-admin-role','cmprtfss0000i100xmh5u829q'),('platform-admin-role','cmprtfss0000i100xmh5u829q'),('business-owner-role','cmprtfss2000j100x4ztoi53h'),('business-owner-template','cmprtfss2000j100x4ztoi53h'),('outlet-admin-role','cmprtfss2000j100x4ztoi53h'),('platform-admin-role','cmprtfss2000j100x4ztoi53h'),('business-owner-role','cmprtfss2000k100xw471ekd1'),('business-owner-template','cmprtfss2000k100xw471ekd1'),('platform-admin-role','cmprtfss2000k100xw471ekd1'),('business-owner-role','cmprtfss2000l100xp2j21azl'),('business-owner-template','cmprtfss2000l100xp2j21azl'),('cashier-role','cmprtfss2000l100xp2j21azl'),('outlet-admin-role','cmprtfss2000l100xp2j21azl'),('platform-admin-role','cmprtfss2000l100xp2j21azl'),('business-owner-role','cmprtfss2000m100xrkszw7w3'),('business-owner-template','cmprtfss2000m100xrkszw7w3'),('kitchen-manager-role','cmprtfss2000m100xrkszw7w3'),('outlet-admin-role','cmprtfss2000m100xrkszw7w3'),('platform-admin-role','cmprtfss2000m100xrkszw7w3'),('business-owner-role','cmprtfss2000n100xuhaiswkz'),('business-owner-template','cmprtfss2000n100xuhaiswkz'),('platform-admin-role','cmprtfss2000n100xuhaiswkz'),('business-owner-role','cmprtfssg000o100xptyg467o'),('business-owner-template','cmprtfssg000o100xptyg467o'),('outlet-admin-role','cmprtfssg000o100xptyg467o'),('platform-admin-role','cmprtfssg000o100xptyg467o'),('business-owner-role','cmprtfssj000p100xwkwac0ub'),('business-owner-template','cmprtfssj000p100xwkwac0ub'),('outlet-admin-role','cmprtfssj000p100xwkwac0ub'),('platform-admin-role','cmprtfssj000p100xwkwac0ub'),('store-manager-role','cmprtfssj000p100xwkwac0ub'),('business-owner-role','cmprtfssn000q100xvgyrapkj'),('business-owner-template','cmprtfssn000q100xvgyrapkj'),('outlet-admin-role','cmprtfssn000q100xvgyrapkj'),('platform-admin-role','cmprtfssn000q100xvgyrapkj'),('business-owner-role','cmprtfsso000r100xsw4j90gi'),('business-owner-template','cmprtfsso000r100xsw4j90gi'),('outlet-admin-role','cmprtfsso000r100xsw4j90gi'),('platform-admin-role','cmprtfsso000r100xsw4j90gi'),('business-owner-role','cmprtfsso000s100xbkrt4wu1'),('business-owner-template','cmprtfsso000s100xbkrt4wu1'),('cashier-role','cmprtfsso000s100xbkrt4wu1'),('outlet-admin-role','cmprtfsso000s100xbkrt4wu1'),('platform-admin-role','cmprtfsso000s100xbkrt4wu1'),('business-owner-role','cmprtfsso000t100x380m4kdy'),('business-owner-template','cmprtfsso000t100x380m4kdy'),('outlet-admin-role','cmprtfsso000t100x380m4kdy'),('platform-admin-role','cmprtfsso000t100x380m4kdy'),('business-owner-role','cmprtfssx000u100xved04tov'),('business-owner-template','cmprtfssx000u100xved04tov'),('outlet-admin-role','cmprtfssx000u100xved04tov'),('platform-admin-role','cmprtfssx000u100xved04tov'),('business-owner-role','cmprtfst0000v100xtvwo10ju'),('business-owner-template','cmprtfst0000v100xtvwo10ju'),('outlet-admin-role','cmprtfst0000v100xtvwo10ju'),('platform-admin-role','cmprtfst0000v100xtvwo10ju'),('business-owner-role','cmprtfst3000w100x1737c2q7'),('business-owner-template','cmprtfst3000w100x1737c2q7'),('cashier-role','cmprtfst3000w100x1737c2q7'),('outlet-admin-role','cmprtfst3000w100x1737c2q7'),('platform-admin-role','cmprtfst3000w100x1737c2q7'),('business-owner-role','cmprtfst7000x100xblim2sjt'),('business-owner-template','cmprtfst7000x100xblim2sjt'),('outlet-admin-role','cmprtfst7000x100xblim2sjt'),('platform-admin-role','cmprtfst7000x100xblim2sjt'),('business-owner-role','cmprtfst9000y100xxo33cqde'),('business-owner-template','cmprtfst9000y100xxo33cqde'),('platform-admin-role','cmprtfst9000y100xxo33cqde'),('business-owner-role','cmprtfst9000z100xktbi1d6c'),('business-owner-template','cmprtfst9000z100xktbi1d6c'),('outlet-admin-role','cmprtfst9000z100xktbi1d6c'),('platform-admin-role','cmprtfst9000z100xktbi1d6c'),('business-owner-role','cmprtfstb0010100xbm67022v'),('business-owner-template','cmprtfstb0010100xbm67022v'),('cashier-role','cmprtfstb0010100xbm67022v'),('outlet-admin-role','cmprtfstb0010100xbm67022v'),('platform-admin-role','cmprtfstb0010100xbm67022v'),('business-owner-role','cmprtfstb0011100xhatuzgjs'),('business-owner-template','cmprtfstb0011100xhatuzgjs'),('outlet-admin-role','cmprtfstb0011100xhatuzgjs'),('platform-admin-role','cmprtfstb0011100xhatuzgjs'),('business-owner-role','cmprtfstb0012100xidlg5llf'),('business-owner-template','cmprtfstb0012100xidlg5llf'),('kitchen-manager-role','cmprtfstb0012100xidlg5llf'),('outlet-admin-role','cmprtfstb0012100xidlg5llf'),('platform-admin-role','cmprtfstb0012100xidlg5llf'),('customer-role','cmprtfsth0013100x8i30nzaq'),('business-owner-role','cmprtfstj0014100xkgiphjlb'),('business-owner-template','cmprtfstj0014100xkgiphjlb'),('outlet-admin-role','cmprtfstj0014100xkgiphjlb'),('platform-admin-role','cmprtfstj0014100xkgiphjlb'),('customer-role','cmprtfstk0015100xstxybhdl'),('customer-role','cmprtfstk0016100x6xyvsx3v'),('business-owner-role','cmprtfstk0017100xx944q9oj'),('business-owner-template','cmprtfstk0017100xx944q9oj'),('kitchen-manager-role','cmprtfstk0017100xx944q9oj'),('outlet-admin-role','cmprtfstk0017100xx944q9oj'),('platform-admin-role','cmprtfstk0017100xx944q9oj'),('store-manager-role','cmprtfstk0017100xx944q9oj'),('customer-role','cmprtfstk0018100x2i62bw4i'),('business-owner-role','cmprtfstr0019100x69joh0gy'),('business-owner-template','cmprtfstr0019100x69joh0gy'),('cashier-role','cmprtfstr0019100x69joh0gy'),('outlet-admin-role','cmprtfstr0019100x69joh0gy'),('platform-admin-role','cmprtfstr0019100x69joh0gy'),('business-owner-role','cmprtfstt001a100x2bmdnnl0'),('business-owner-template','cmprtfstt001a100x2bmdnnl0'),('outlet-admin-role','cmprtfstt001a100x2bmdnnl0'),('platform-admin-role','cmprtfstt001a100x2bmdnnl0'),('store-manager-role','cmprtfstt001a100x2bmdnnl0'),('business-owner-role','cmprtfstv001b100x5zr2pn2c'),('business-owner-template','cmprtfstv001b100x5zr2pn2c'),('kitchen-manager-role','cmprtfstv001b100x5zr2pn2c'),('outlet-admin-role','cmprtfstv001b100x5zr2pn2c'),('platform-admin-role','cmprtfstv001b100x5zr2pn2c'),('store-manager-role','cmprtfstv001b100x5zr2pn2c'),('business-owner-role','cmprtfstv001c100x3fu7nvsx'),('business-owner-template','cmprtfstv001c100x3fu7nvsx'),('outlet-admin-role','cmprtfstv001c100x3fu7nvsx'),('platform-admin-role','cmprtfstv001c100x3fu7nvsx'),('business-owner-role','cmprtfstv001d100x6926l9em'),('business-owner-template','cmprtfstv001d100x6926l9em'),('outlet-admin-role','cmprtfstv001d100x6926l9em'),('platform-admin-role','cmprtfstv001d100x6926l9em'),('business-owner-role','cmprtfstv001e100xya3qalit'),('business-owner-template','cmprtfstv001e100xya3qalit'),('outlet-admin-role','cmprtfstv001e100xya3qalit'),('platform-admin-role','cmprtfstv001e100xya3qalit'),('business-owner-role','cmprtfsu4001f100xbv1mtu4g'),('business-owner-template','cmprtfsu4001f100xbv1mtu4g'),('outlet-admin-role','cmprtfsu4001f100xbv1mtu4g'),('platform-admin-role','cmprtfsu4001f100xbv1mtu4g'),('business-owner-role','cmprtfsu6001g100xvvus2c8r'),('business-owner-template','cmprtfsu6001g100xvvus2c8r'),('cashier-role','cmprtfsu6001g100xvvus2c8r'),('kitchen-manager-role','cmprtfsu6001g100xvvus2c8r'),('outlet-admin-role','cmprtfsu6001g100xvvus2c8r'),('platform-admin-role','cmprtfsu6001g100xvvus2c8r'),('store-manager-role','cmprtfsu6001g100xvvus2c8r');
/*!40000 ALTER TABLE `paynpik_role_responsibilities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_roles`
--

DROP TABLE IF EXISTS `paynpik_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_roles` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  `isTemplate` tinyint(1) NOT NULL DEFAULT '0',
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_roles_businessId_idx` (`businessId`),
  KEY `paynpik_roles_outletId_idx` (`outletId`),
  CONSTRAINT `paynpik_roles_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_roles_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_roles`
--

LOCK TABLES `paynpik_roles` WRITE;
/*!40000 ALTER TABLE `paynpik_roles` DISABLE KEYS */;
INSERT INTO `paynpik_roles` VALUES ('business-owner-role','Business Owner',NULL,0,0,'demo-business',NULL,'2026-05-30 03:53:22.443','2026-05-30 03:53:22.443'),('business-owner-template','Business Owner','Template role. Permissions toggled here become defaults for every new business and cascade to existing ones.',0,1,NULL,NULL,'2026-05-30 03:53:21.993','2026-05-30 03:53:21.993'),('cashier-role','Cashier',NULL,0,0,'demo-business',NULL,'2026-05-30 03:53:23.019','2026-05-30 03:53:23.019'),('customer-role','Customer','Default role for customers signing in via the PWA',1,0,NULL,NULL,'2026-05-30 03:53:21.981','2026-05-30 03:53:21.981'),('kitchen-manager-role','Kitchen Manager',NULL,0,0,'demo-business',NULL,'2026-05-30 03:53:23.012','2026-05-30 03:53:23.012'),('outlet-admin-role','Outlet Admin',NULL,0,0,'demo-business',NULL,'2026-05-30 03:53:22.463','2026-05-30 03:53:22.463'),('platform-admin-role','Platform Admin',NULL,1,0,NULL,NULL,'2026-05-30 03:53:21.834','2026-05-30 03:53:21.834'),('store-manager-role','Store Manager',NULL,0,0,'demo-business',NULL,'2026-05-30 03:53:23.023','2026-05-30 03:53:23.023');
/*!40000 ALTER TABLE `paynpik_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_sections`
--

DROP TABLE IF EXISTS `paynpik_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_sections` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_sections_outletId_fkey` (`outletId`),
  CONSTRAINT `paynpik_sections_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_sections`
--

LOCK TABLES `paynpik_sections` WRITE;
/*!40000 ALTER TABLE `paynpik_sections` DISABLE KEYS */;
INSERT INTO `paynpik_sections` VALUES ('cmprtftyf001o100xusvek8x9','Main Hall',1,'demo-outlet','2026-05-30 03:53:22.792','2026-05-30 03:53:22.792');
/*!40000 ALTER TABLE `paynpik_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_service_station_tables`
--

DROP TABLE IF EXISTS `paynpik_service_station_tables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_service_station_tables` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tableId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_service_station_tables_stationId_tableId_key` (`stationId`,`tableId`),
  KEY `paynpik_service_station_tables_tableId_fkey` (`tableId`),
  CONSTRAINT `paynpik_service_station_tables_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `paynpik_service_stations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_service_station_tables_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `paynpik_tables` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_service_station_tables`
--

LOCK TABLES `paynpik_service_station_tables` WRITE;
/*!40000 ALTER TABLE `paynpik_service_station_tables` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_service_station_tables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_service_station_workers`
--

DROP TABLE IF EXISTS `paynpik_service_station_workers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_service_station_workers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_service_station_workers_stationId_userId_key` (`stationId`,`userId`),
  KEY `paynpik_service_station_workers_userId_fkey` (`userId`),
  CONSTRAINT `paynpik_service_station_workers_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `paynpik_service_stations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_service_station_workers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_service_station_workers`
--

LOCK TABLES `paynpik_service_station_workers` WRITE;
/*!40000 ALTER TABLE `paynpik_service_station_workers` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_service_station_workers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_service_stations`
--

DROP TABLE IF EXISTS `paynpik_service_stations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_service_stations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tableTypeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `isParcelStation` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `paynpik_service_stations_outletId_idx` (`outletId`),
  KEY `paynpik_service_stations_tableTypeId_fkey` (`tableTypeId`),
  CONSTRAINT `paynpik_service_stations_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_service_stations_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_service_stations`
--

LOCK TABLES `paynpik_service_stations` WRITE;
/*!40000 ALTER TABLE `paynpik_service_stations` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_service_stations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_sessions`
--

DROP TABLE IF EXISTS `paynpik_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_sessions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_sessions_token_key` (`token`),
  KEY `paynpik_sessions_userId_fkey` (`userId`),
  CONSTRAINT `paynpik_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_sessions`
--

LOCK TABLES `paynpik_sessions` WRITE;
/*!40000 ALTER TABLE `paynpik_sessions` DISABLE KEYS */;
INSERT INTO `paynpik_sessions` VALUES ('cmprrv0uw0002o8lhbmtdezp5','cmprrv0tp0000o8lhqx9bv5ik','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXBycnYwdHAwMDAwbzhsaHF4OWJ2NWlrIiwicGhvbmUiOiI3Nzk5ODM1NTU1IiwiaWF0IjoxNzgwMTEwNTUyLCJleHAiOjE3ODI3MDI1NTJ9.0umgnLV7hZj5fG-rfqvdu1nj_ATTEdn4V7sBxfrkWwc',NULL,NULL,'2026-06-29 03:09:12.344','2026-05-30 03:09:12.345'),('cmprt93660004o8lh17y89l3o','cmprrv0tp0000o8lhqx9bv5ik','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXBycnYwdHAwMDAwbzhsaHF4OWJ2NWlrIiwicGhvbmUiOiI3Nzk5ODM1NTU1IiwiaWF0IjoxNzgwMTEyODg4LCJleHAiOjE3ODI3MDQ4ODh9.iH69DDQb8a1ZrOwMfse21xjhzf8Gg0huVolgoKV_o10',NULL,NULL,'2026-06-29 03:48:08.140','2026-05-30 03:48:08.141'),('cmprtc1vy0006o8lhxxu7j7s4','cmprrv0tp0000o8lhqx9bv5ik','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXBycnYwdHAwMDAwbzhsaHF4OWJ2NWlrIiwicGhvbmUiOiI3Nzk5ODM1NTU1IiwiaWF0IjoxNzgwMTEzMDI2LCJleHAiOjE3ODI3MDUwMjZ9.XUF-kbbMyOONyBFf_5Jbxx6XmkxHIWmgRMf3vWvu_x4',NULL,NULL,'2026-06-29 03:50:26.445','2026-05-30 03:50:26.446'),('cmprthf1p0008o8lhyybfqky7','cmprtftlf001i100xtclp0yuk','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXBydGZ0bGYwMDFpMTAweHRjbHAweXVrIiwiaWF0IjoxNzgwMTEzMjc2LCJleHAiOjE3ODAxOTk2NzZ9.PfbzhuPofKO34bgGxlS_q79rcUCguIlts7xGmChhelw',NULL,NULL,'2026-05-31 03:54:36.780','2026-05-30 03:54:36.781');
/*!40000 ALTER TABLE `paynpik_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_subcategories`
--

DROP TABLE IF EXISTS `paynpik_subcategories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_subcategories` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `imageUrl` text COLLATE utf8mb4_unicode_ci,
  `displayOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `categoryId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_subcategories_categoryId_fkey` (`categoryId`),
  CONSTRAINT `paynpik_subcategories_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `paynpik_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_subcategories`
--

LOCK TABLES `paynpik_subcategories` WRITE;
/*!40000 ALTER TABLE `paynpik_subcategories` DISABLE KEYS */;
INSERT INTO `paynpik_subcategories` VALUES ('cmprtfu21001w100xvwqw0f7m','South Indian',NULL,1,1,'cmprtfu0w001q100x8rvdwp3y','2026-05-30 03:53:22.922','2026-05-30 03:53:22.922'),('cmprtfu2t001y100x034mw49c','North Indian',NULL,1,1,'cmprtfu1o001s100xqptzysa6','2026-05-30 03:53:22.949','2026-05-30 03:53:22.949'),('cmprtfu2w0020100xzm8ai8ni','Hot Beverages',NULL,1,1,'cmprtfu1v001u100xbzrl3c8p','2026-05-30 03:53:22.952','2026-05-30 03:53:22.952');
/*!40000 ALTER TABLE `paynpik_subcategories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_subscriptions`
--

DROP TABLE IF EXISTS `paynpik_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_subscriptions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('TRIAL','ACTIVE','EXPIRED','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TRIAL',
  `startDate` datetime(3) NOT NULL,
  `endDate` datetime(3) NOT NULL,
  `autoRenew` tinyint(1) NOT NULL DEFAULT '1',
  `planId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_subscriptions_planId_fkey` (`planId`),
  CONSTRAINT `paynpik_subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `paynpik_plans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_subscriptions`
--

LOCK TABLES `paynpik_subscriptions` WRITE;
/*!40000 ALTER TABLE `paynpik_subscriptions` DISABLE KEYS */;
INSERT INTO `paynpik_subscriptions` VALUES ('cmprtftnk001k100xm0ui1k1q','ACTIVE','2026-05-30 03:53:22.399','2026-06-29 03:53:22.399',1,'plan-starter','2026-05-30 03:53:22.400','2026-05-30 03:53:22.400');
/*!40000 ALTER TABLE `paynpik_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_table_type_menus`
--

DROP TABLE IF EXISTS `paynpik_table_type_menus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_table_type_menus` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tableTypeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `menuId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_table_type_menus_tableTypeId_menuId_key` (`tableTypeId`,`menuId`),
  KEY `paynpik_table_type_menus_menuId_idx` (`menuId`),
  CONSTRAINT `paynpik_table_type_menus_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_table_type_menus_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_table_type_menus`
--

LOCK TABLES `paynpik_table_type_menus` WRITE;
/*!40000 ALTER TABLE `paynpik_table_type_menus` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_table_type_menus` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_table_type_prices`
--

DROP TABLE IF EXISTS `paynpik_table_type_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_table_type_prices` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variantId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tableTypeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `gstRate` decimal(5,2) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_table_type_prices_itemId_variantId_tableTypeId_key` (`itemId`,`variantId`,`tableTypeId`),
  KEY `paynpik_table_type_prices_variantId_fkey` (`variantId`),
  KEY `paynpik_table_type_prices_tableTypeId_fkey` (`tableTypeId`),
  CONSTRAINT `paynpik_table_type_prices_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_table_type_prices_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_table_type_prices_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_table_type_prices`
--

LOCK TABLES `paynpik_table_type_prices` WRITE;
/*!40000 ALTER TABLE `paynpik_table_type_prices` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_table_type_prices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_table_types`
--

DROP TABLE IF EXISTS `paynpik_table_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_table_types` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#0ea5e9',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_table_types_outletId_name_key` (`outletId`,`name`),
  CONSTRAINT `paynpik_table_types_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_table_types`
--

LOCK TABLES `paynpik_table_types` WRITE;
/*!40000 ALTER TABLE `paynpik_table_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_table_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_tables`
--

DROP TABLE IF EXISTS `paynpik_tables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_tables` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `number` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacity` int NOT NULL DEFAULT '4',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `sectionId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tableTypeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_tables_sectionId_fkey` (`sectionId`),
  KEY `paynpik_tables_outletId_fkey` (`outletId`),
  KEY `paynpik_tables_tableTypeId_fkey` (`tableTypeId`),
  CONSTRAINT `paynpik_tables_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_tables_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `paynpik_sections` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_tables_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_tables`
--

LOCK TABLES `paynpik_tables` WRITE;
/*!40000 ALTER TABLE `paynpik_tables` DISABLE KEYS */;
INSERT INTO `paynpik_tables` VALUES ('table-1','T01',2,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.812','2026-05-30 03:53:22.812'),('table-10','T10',4,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.874','2026-05-30 03:53:22.874'),('table-2','T02',2,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.838','2026-05-30 03:53:22.838'),('table-3','T03',2,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.842','2026-05-30 03:53:22.842'),('table-4','T04',2,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.845','2026-05-30 03:53:22.845'),('table-5','T05',2,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.850','2026-05-30 03:53:22.850'),('table-6','T06',4,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.855','2026-05-30 03:53:22.855'),('table-7','T07',4,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.860','2026-05-30 03:53:22.860'),('table-8','T08',4,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.864','2026-05-30 03:53:22.864'),('table-9','T09',4,1,'cmprtftyf001o100xusvek8x9','demo-outlet',NULL,'2026-05-30 03:53:22.869','2026-05-30 03:53:22.869');
/*!40000 ALTER TABLE `paynpik_tables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_topping_options`
--

DROP TABLE IF EXISTS `paynpik_topping_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_topping_options` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toppingId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `priceAdd` decimal(10,2) NOT NULL DEFAULT '0.00',
  `displayOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_topping_options_toppingId_fkey` (`toppingId`),
  CONSTRAINT `paynpik_topping_options_toppingId_fkey` FOREIGN KEY (`toppingId`) REFERENCES `paynpik_toppings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_topping_options`
--

LOCK TABLES `paynpik_topping_options` WRITE;
/*!40000 ALTER TABLE `paynpik_topping_options` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_topping_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_toppings`
--

DROP TABLE IF EXISTS `paynpik_toppings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_toppings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `basePriceAdd` decimal(10,2) NOT NULL DEFAULT '0.00',
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_toppings_outletId_name_key` (`outletId`,`name`),
  CONSTRAINT `paynpik_toppings_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_toppings`
--

LOCK TABLES `paynpik_toppings` WRITE;
/*!40000 ALTER TABLE `paynpik_toppings` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_toppings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_translations`
--

DROP TABLE IF EXISTS `paynpik_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_translations` (
  `entityType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fieldName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `languageCode` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'auto',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`entityType`,`entityId`,`fieldName`,`languageCode`),
  KEY `paynpik_translations_entityType_languageCode_idx` (`entityType`,`languageCode`),
  KEY `paynpik_translations_languageCode_fkey` (`languageCode`),
  CONSTRAINT `paynpik_translations_languageCode_fkey` FOREIGN KEY (`languageCode`) REFERENCES `paynpik_languages` (`code`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_translations`
--

LOCK TABLES `paynpik_translations` WRITE;
/*!40000 ALTER TABLE `paynpik_translations` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_translations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_user_responsibilities`
--

DROP TABLE IF EXISTS `paynpik_user_responsibilities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_user_responsibilities` (
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `responsibilityId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `granted` tinyint(1) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`userId`,`responsibilityId`),
  KEY `paynpik_user_responsibilities_responsibilityId_fkey` (`responsibilityId`),
  CONSTRAINT `paynpik_user_responsibilities_responsibilityId_fkey` FOREIGN KEY (`responsibilityId`) REFERENCES `paynpik_responsibilities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_user_responsibilities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_user_responsibilities`
--

LOCK TABLES `paynpik_user_responsibilities` WRITE;
/*!40000 ALTER TABLE `paynpik_user_responsibilities` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_user_responsibilities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_users`
--

DROP TABLE IF EXISTS `paynpik_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `avatarUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outletId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferredUpiApp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profileImageUrl` text COLLATE utf8mb4_unicode_ci,
  `alertRingtone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT 'chime',
  `alertVolume` int DEFAULT '70',
  `mustChangePassword` tinyint(1) NOT NULL DEFAULT '0',
  `preferredLanguage` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT 'en',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_users_phone_key` (`phone`),
  UNIQUE KEY `paynpik_users_email_key` (`email`),
  KEY `paynpik_users_roleId_fkey` (`roleId`),
  KEY `paynpik_users_businessId_fkey` (`businessId`),
  KEY `paynpik_users_outletId_fkey` (`outletId`),
  CONSTRAINT `paynpik_users_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_users_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paynpik_users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `paynpik_roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_users`
--

LOCK TABLES `paynpik_users` WRITE;
/*!40000 ALTER TABLE `paynpik_users` DISABLE KEYS */;
INSERT INTO `paynpik_users` VALUES ('cmprrv0tp0000o8lhqx9bv5ik',NULL,'7799835555','Guest 5555',NULL,'ACTIVE',NULL,NULL,NULL,NULL,NULL,NULL,'chime',70,0,'en','2026-05-30 03:09:12.301','2026-05-30 03:09:12.301'),('cmprtftlf001i100xtclp0yuk','admin@paynpik.com','9000000000','Platform Admin','$2a$12$b3aZMDNW.Yo5hV.8Er0CuOduYEoWsQLMaQwjslpRSMesFrJ.eKMli','ACTIVE',NULL,'platform-admin-role',NULL,NULL,NULL,NULL,'chime',70,0,'en','2026-05-30 03:53:22.323','2026-05-30 03:53:22.323'),('cmprtftxm001m100xqwzv1f3d','owner@demo.com','9876543210','Demo Owner','$2a$12$36vpO2KZY7KtVJ/YnMo31edTeVawuDZiJFFjAWuI9xKGkqCjYUUA2','ACTIVE',NULL,'business-owner-role','demo-business',NULL,NULL,NULL,'chime',70,0,'en','2026-05-30 03:53:22.762','2026-05-30 03:53:23.470'),('cmprtfucs002h100xxlhk9xni','outlet@demo.com','9999000000','Demo Outlet Admin','$2a$12$7uOz5NhWnuINEYYvZb8t8Ox/vGn27eZ2Btnmffnuq24TZo1qIX13O','ACTIVE',NULL,'outlet-admin-role','demo-business','demo-outlet',NULL,NULL,'chime',70,0,'en','2026-05-30 03:53:23.308','2026-05-30 03:53:23.318'),('cmprtfupg002j100x1tku94bo','chef@demo.com','9111000001','Demo Chef','$2a$12$9QCempPAQaYCSOkUMKxEWeQrAd02XPk2NCemcTOjexw8.QiCa6a4i','ACTIVE',NULL,'kitchen-manager-role','demo-business','demo-outlet',NULL,NULL,'chime',70,0,'en','2026-05-30 03:53:23.765','2026-05-30 03:53:23.765'),('cmprtfupp002l100xeuxfc2l6','vinod@demo.com','9111000004','Vinod Chef','$2a$12$9QCempPAQaYCSOkUMKxEWeQrAd02XPk2NCemcTOjexw8.QiCa6a4i','ACTIVE',NULL,'kitchen-manager-role','demo-business','demo-outlet',NULL,NULL,'chime',70,0,'en','2026-05-30 03:53:23.773','2026-05-30 03:53:23.773'),('cmprtfuxm002n100xektjxwds','cashier@demo.com','9111000002','Demo Cashier','$2a$12$j3N1R3Fw5MFgjDdduRMLmOISxB9aSw4Q1swJxSUxdgwtP7b3Oj.Qu','ACTIVE',NULL,'cashier-role','demo-business','demo-outlet',NULL,NULL,'chime',70,0,'en','2026-05-30 03:53:24.058','2026-05-30 03:53:24.058'),('cmprtfv5o002p100xchevz5x7','store@demo.com','9111000003','Demo Store Manager','$2a$12$O8HQZE6lOlK7.ydZox6iHuStkWBus.L0KIS9jNSU1mMq6FrMiLqAm','ACTIVE',NULL,'store-manager-role','demo-business','demo-outlet',NULL,NULL,'chime',70,0,'en','2026-05-30 03:53:24.349','2026-05-30 03:53:24.349');
/*!40000 ALTER TABLE `paynpik_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_variants`
--

DROP TABLE IF EXISTS `paynpik_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_variants` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shortDescription` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `isAvailable` tinyint(1) NOT NULL DEFAULT '1',
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_variants_itemId_fkey` (`itemId`),
  CONSTRAINT `paynpik_variants_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_variants`
--

LOCK TABLES `paynpik_variants` WRITE;
/*!40000 ALTER TABLE `paynpik_variants` DISABLE KEYS */;
INSERT INTO `paynpik_variants` VALUES ('cmprtfu2z0023100xenmp1bke','Regular',NULL,80.00,1,'cmprtfu2z0022100xrprd7wsx','2026-05-30 03:53:22.955','2026-05-30 03:53:22.955'),('cmprtfu2z0024100xx36mlc9y','Ghee Dosa',NULL,100.00,1,'cmprtfu2z0022100xrprd7wsx','2026-05-30 03:53:22.955','2026-05-30 03:53:22.955'),('cmprtfu2z0025100xk3xn9qt2','Paper Roast',NULL,120.00,1,'cmprtfu2z0022100xrprd7wsx','2026-05-30 03:53:22.955','2026-05-30 03:53:22.955'),('cmprtfu4g002e100xukwf2gmk','Small',NULL,40.00,1,'cmprtfu4g002d100x8pyv1o9f','2026-05-30 03:53:23.009','2026-05-30 03:53:23.009'),('cmprtfu4g002f100xwdv86xvf','Large',NULL,60.00,1,'cmprtfu4g002d100x8pyv1o9f','2026-05-30 03:53:23.009','2026-05-30 03:53:23.009');
/*!40000 ALTER TABLE `paynpik_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paynpik_vendors`
--

DROP TABLE IF EXISTS `paynpik_vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paynpik_vendors` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gstNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `businessId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `paynpik_vendors_businessId_fkey` (`businessId`),
  CONSTRAINT `paynpik_vendors_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paynpik_vendors`
--

LOCK TABLES `paynpik_vendors` WRITE;
/*!40000 ALTER TABLE `paynpik_vendors` DISABLE KEYS */;
/*!40000 ALTER TABLE `paynpik_vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'paynpik_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-30  4:57:35
