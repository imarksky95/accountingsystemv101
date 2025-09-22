-- Optional migration: rename NAME -> company_name and TYPE -> company_type
-- WARNING: Run this on a test/staging database first and ensure no code assumptions break.
-- This migration uses ALTER TABLE CHANGE to rename columns while preserving type.

ALTER TABLE company_profile
  CHANGE COLUMN `NAME` `company_name` VARCHAR(255) NULL,
  CHANGE COLUMN `TYPE` `company_type` VARCHAR(255) NULL;

-- After running this migration, update any code that refers to `NAME` or `TYPE`.
-- Note: The current backend maps JSON keys to DB `NAME` and `TYPE` columns, so this step
-- is optional. If you run this migration, ensure the backend SQL uses `company_name` and
-- `company_type` column names or roll back the migration.
