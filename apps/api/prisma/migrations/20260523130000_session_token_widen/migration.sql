-- JWTs comfortably exceed the default VARCHAR(191) Prisma maps `String` to
-- on MySQL. Bump the session token to 500 chars — still indexable for the
-- @unique constraint (TEXT can't have a non-prefixed unique index).
ALTER TABLE `paynpik_sessions` MODIFY COLUMN `token` VARCHAR(500) NOT NULL;
