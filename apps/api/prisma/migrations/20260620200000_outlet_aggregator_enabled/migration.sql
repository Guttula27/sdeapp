-- Per-outlet feature toggle for the aggregator integration screen.
-- Default FALSE so the option is opt-in — the business admin flips
-- it on for outlets that have signed up with Zomato/Swiggy/Uber Eats.
-- Outlet admins lose the Aggregators settings entry when this is off;
-- existing AggregatorIntegration rows for the outlet are unaffected
-- (they keep functioning until explicitly disabled on that page).

ALTER TABLE `paynpik_outlets`
  ADD COLUMN `aggregatorEnabled` BOOLEAN NOT NULL DEFAULT FALSE;
