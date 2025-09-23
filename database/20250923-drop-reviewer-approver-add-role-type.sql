-- Migration: add role_type column, backfill from reviewer/approver, then drop reviewer/approver
-- 1) Add role_type column with default 'none'
ALTER TABLE `roles`
  ADD COLUMN `role_type` VARCHAR(10) NOT NULL DEFAULT 'none';

-- 2) Backfill role_type from existing reviewer/approver text/json columns
-- If both reviewer and approver are present (non-null/non-empty), set 'both'
UPDATE `roles` SET role_type = 'both'
WHERE (reviewer IS NOT NULL AND TRIM(reviewer) <> '')
  AND (approver IS NOT NULL AND TRIM(approver) <> '');

-- If only reviewer present
UPDATE `roles` SET role_type = 'reviewer'
WHERE (reviewer IS NOT NULL AND TRIM(reviewer) <> '')
  AND (approver IS NULL OR TRIM(approver) = '');

-- If only approver present
UPDATE `roles` SET role_type = 'approver'
WHERE (approver IS NOT NULL AND TRIM(approver) <> '')
  AND (reviewer IS NULL OR TRIM(reviewer) = '');

-- 3) Optionally drop reviewer and approver columns (irreversible)
ALTER TABLE `roles`
  DROP COLUMN `reviewer`,
  DROP COLUMN `approver`;

-- End migration
