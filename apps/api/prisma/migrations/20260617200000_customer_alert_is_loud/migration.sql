-- Differentiate "loud" alerts (ringtone + vibration + FCM push,
-- typical for self-service / pickup / parcel where the customer must
-- come collect the food) from "quiet" alerts (toast + bell-list entry
-- only — used for dine-in table service where a waiter walks the food
-- over and ringing the customer is intrusive).
--
-- Default true so existing rows stay loud; the lifecycle dispatcher
-- stamps false on table-service ready events going forward.

ALTER TABLE `paynpik_customer_alerts`
  ADD COLUMN `isLoud` BOOLEAN NOT NULL DEFAULT TRUE;
