-- Per-outlet receipt printing config. Mirrors the existing
-- kitchenAutoPrint pair but with a single dedicated printer FK for
-- the counter / front-of-house printer.
ALTER TABLE `paynpik_outlets`
  ADD COLUMN `receiptAutoPrint`        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `receiptAllowManualPrint` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `receiptPrinterId`        VARCHAR(191) NULL;

CREATE INDEX `paynpik_outlets_receiptPrinterId_idx`
  ON `paynpik_outlets`(`receiptPrinterId`);

ALTER TABLE `paynpik_outlets`
  ADD CONSTRAINT `paynpik_outlets_receiptPrinterId_fkey`
  FOREIGN KEY (`receiptPrinterId`) REFERENCES `paynpik_printers`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
