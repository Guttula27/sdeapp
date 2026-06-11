-- Add FSSAI registration / license number to Outlet so it can be
-- printed on the customer bill. Nullable + free-text (VarChar(32)) so
-- the standard 14-digit FSSAI, a CKL, or a manufacturing licence all
-- fit without further schema changes.
ALTER TABLE `Outlet` ADD COLUMN `fssaiNumber` VARCHAR(32) NULL;
