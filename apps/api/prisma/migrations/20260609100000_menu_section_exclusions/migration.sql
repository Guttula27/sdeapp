-- Section-level menu disables. Default = menu visible in every section
-- of an outlet; a row here marks the (menu, section) pair as hidden.
-- Used by the customer menu fetch when a table QR resolves to a section.
CREATE TABLE `paynpik_menu_section_exclusions` (
  `menuId`    VARCHAR(191) NOT NULL,
  `sectionId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`menuId`, `sectionId`),
  INDEX `paynpik_menu_section_exclusions_sectionId_idx` (`sectionId`),
  CONSTRAINT `paynpik_menu_section_exclusions_menuId_fkey`
    FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_menu_section_exclusions_sectionId_fkey`
    FOREIGN KEY (`sectionId`) REFERENCES `paynpik_sections`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
