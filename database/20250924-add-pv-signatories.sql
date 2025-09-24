-- Migration: add reviewer_id/reviewer_manual and approver_id/approver_manual to payment_vouchers
-- Run this against your MySQL database before deploying the updated backend.

ALTER TABLE payment_vouchers
  ADD COLUMN reviewer_id INT NULL AFTER prepared_by,
  ADD COLUMN reviewer_manual VARCHAR(255) NULL AFTER reviewer_id,
  ADD COLUMN approver_id INT NULL AFTER reviewer_manual,
  ADD COLUMN approver_manual VARCHAR(255) NULL AFTER approver_id;

-- Optional: create indexes if you will frequently query by reviewer_id/approver_id
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_reviewer_id ON payment_vouchers (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_approver_id ON payment_vouchers (approver_id);
