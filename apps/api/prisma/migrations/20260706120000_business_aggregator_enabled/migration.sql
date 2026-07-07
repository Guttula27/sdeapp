-- Business-level toggle for aggregator integrations (Zomato / Swiggy /
-- Uber Eats). Default FALSE so existing businesses stay off unless the
-- platform / business admin flips it on. When false the Aggregators
-- settings sub-page is hidden for every outlet under the business,
-- regardless of the per-outlet `Outlet.aggregatorEnabled` override.

ALTER TABLE `paynpik_businesses`
  ADD COLUMN `aggregatorEnabled` BOOLEAN NOT NULL DEFAULT FALSE;
