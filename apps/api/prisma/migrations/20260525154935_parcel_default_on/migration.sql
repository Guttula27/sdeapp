-- AlterTable: flip default for the parcel toggle so new outlets ship with
-- parcel available out of the box.
ALTER TABLE `paynpik_outlets` MODIFY `parcelChargeEnabled` BOOLEAN NOT NULL DEFAULT true;

-- Backfill: turn parcel on for every existing outlet so the new default
-- applies retroactively (the SELF_SERVICE_PARCEL type is being retired so
-- every outlet should now have parcel available).
UPDATE `paynpik_outlets` SET `parcelChargeEnabled` = 1 WHERE `parcelChargeEnabled` = 0;
