-- Migration: remove redundant columns from payment_vouchers
-- These columns are now stored in payment_voucher_payment_lines and payment_voucher_journal_lines
ALTER TABLE payment_vouchers
  DROP COLUMN payee,
  DROP COLUMN description,
  DROP COLUMN amount_to_pay,
  DROP COLUMN coa_id;

-- Note: Run this migration after ensuring all application code has been updated
-- and after backing up your database.
