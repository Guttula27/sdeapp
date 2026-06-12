-- Add ownerScope to User so admin staff lists can hide outlet-exclusive
-- staff from the business-level view and scope the outlet view to that
-- outlet only. Nullable; the service layer treats NULL as BUSINESS so
-- legacy rows keep showing up at business level (pre-cutover behaviour).
ALTER TABLE `paynpik_users`
  ADD COLUMN `ownerScope` ENUM('PLATFORM', 'BUSINESS', 'OUTLET') NULL;
