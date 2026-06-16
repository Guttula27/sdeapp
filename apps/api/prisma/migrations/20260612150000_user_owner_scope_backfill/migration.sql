-- Backfill ownerScope on User rows that pre-date the column.
-- Heuristic: pre-migration we couldn't distinguish "business-managed,
-- assigned to outlet" from "outlet-exclusive", so we treat any
-- legacy row with outletId set as OUTLET (the safer default — it
-- hides the row from business owners and keeps the outlet operator
-- in control). Business owners who actually want a legacy
-- outlet-pinned staff member back in their pool can re-edit them
-- after this runs and the new create-path keeps them as BUSINESS.
--
-- Rows with businessId only → BUSINESS (free-floating biz staff
-- that any outlet under the business can pull in via reassignment).
--
-- Rows where both tenant fields are NULL stay NULL — those are
-- customer accounts that signed up via the customer PWA and never
-- appear on a staff list.

UPDATE `paynpik_users`
SET `ownerScope` = 'OUTLET'
WHERE `ownerScope` IS NULL AND `outletId` IS NOT NULL;

UPDATE `paynpik_users`
SET `ownerScope` = 'BUSINESS'
WHERE `ownerScope` IS NULL AND `outletId` IS NULL AND `businessId` IS NOT NULL;
