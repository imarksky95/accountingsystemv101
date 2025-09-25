-- Migration: create tables for check voucher lines
-- Adds payment lines, check lines (for multi-check), and journal lines linked to check_vouchers

CREATE TABLE IF NOT EXISTS check_voucher_payment_lines (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  check_voucher_id INT NOT NULL,
  payee_contact_id BIGINT NULL,
  payee_display VARCHAR(255) NULL,
  description TEXT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  check_number VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cv_payee (check_voucher_id, payee_contact_id),
  CONSTRAINT fk_cvpl_cv FOREIGN KEY (check_voucher_id) REFERENCES check_vouchers(check_voucher_id) ON DELETE CASCADE,
  CONSTRAINT fk_cvpl_contact FOREIGN KEY (payee_contact_id) REFERENCES contacts(contact_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS check_voucher_check_lines (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  check_voucher_id INT NOT NULL,
  check_number VARCHAR(64) NOT NULL,
  check_date DATE NULL,
  check_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  check_subpayee BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cvcl_cv (check_voucher_id),
  CONSTRAINT fk_cvcl_cv FOREIGN KEY (check_voucher_id) REFERENCES check_vouchers(check_voucher_id) ON DELETE CASCADE,
  CONSTRAINT fk_cvcl_subpayee FOREIGN KEY (check_subpayee) REFERENCES contacts(contact_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS check_voucher_journal_lines (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  check_voucher_id INT NOT NULL,
  coa_id INT NULL,
  debit DECIMAL(15,2) NULL DEFAULT 0,
  credit DECIMAL(15,2) NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cvjl_cv (check_voucher_id),
  CONSTRAINT fk_cvjl_cv FOREIGN KEY (check_voucher_id) REFERENCES check_vouchers(check_voucher_id) ON DELETE CASCADE,
  CONSTRAINT fk_cvjl_coa FOREIGN KEY (coa_id) REFERENCES chart_of_accounts(coa_id) ON DELETE SET NULL
);
