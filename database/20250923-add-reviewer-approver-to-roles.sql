-- Migration: add reviewer and approver columns to roles
-- Adds TEXT columns to store JSON arrays (list of user_ids or role_ids) or comma-separated values
ALTER TABLE `roles`
  ADD COLUMN `reviewer` TEXT NULL AFTER `role_name`,
  ADD COLUMN `approver` TEXT NULL AFTER `reviewer`;

-- Example to populate (optional): set approver for Admin role to user id 1
-- UPDATE `roles` SET `approver` = '[1]' WHERE `role_id` = 1;
