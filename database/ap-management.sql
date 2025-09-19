-- AP Management schema
-- Run this file against your MySQL database to add AP-related tables

CREATE TABLE IF NOT EXISTS payment_vouchers (
  payment_voucher_id INT AUTO_INCREMENT PRIMARY KEY,
  payment_voucher_control VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'Draft',
  preparation_date DATE,
  purpose VARCHAR(255),
  paid_through VARCHAR(100),
  prepared_by INT, -- user_id (optional FK to users)
  payee VARCHAR(255),
  description TEXT,
  amount_to_pay DECIMAL(15,2) DEFAULT 0,
  coa_id INT, -- FK to chart_of_accounts.coa_id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (payment_voucher_control),
  INDEX (prepared_by),
  INDEX (coa_id)
);

CREATE TABLE IF NOT EXISTS check_vouchers (
  check_voucher_id INT AUTO_INCREMENT PRIMARY KEY,
  check_voucher_control VARCHAR(64) NOT NULL UNIQUE,
  cvoucher_date DATE,
  purpose VARCHAR(255),
  check_payee VARCHAR(255),
  check_no VARCHAR(64),
  check_amount DECIMAL(15,2) DEFAULT 0,
  cvoucher_status VARCHAR(50) DEFAULT 'Draft',
  multiple_checks TINYINT(1) DEFAULT 0,
  check_fr VARCHAR(64),
  check_to VARCHAR(64),
  coa_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (check_voucher_control),
  INDEX (check_no),
  INDEX (coa_id)
);

CREATE TABLE IF NOT EXISTS scheduled_payments (
  scheduled_payment_id INT AUTO_INCREMENT PRIMARY KEY,
  scheduled_payment_ctrl VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'Pending',
  due_date DATE,
  document_ctrl_number VARCHAR(128),
  purpose VARCHAR(255),
  payee_client VARCHAR(255),
  description TEXT,
  ub_approval_code VARCHAR(128),
  amount_to_pay DECIMAL(15,2) DEFAULT 0,
  paid_through VARCHAR(100),
  mop VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (scheduled_payment_ctrl),
  INDEX (due_date)
);

CREATE TABLE IF NOT EXISTS disbursement_reports (
  disbursement_report_id INT AUTO_INCREMENT PRIMARY KEY,
  disbursement_report_ctrl_number VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'Draft',
  disbursement_date DATE,
  document_ctrl_number VARCHAR(128),
  purpose VARCHAR(255),
  payee_client VARCHAR(255),
  description TEXT,
  ub_approval_code VARCHAR(128),
  amount_to_pay DECIMAL(15,2) DEFAULT 0,
  paid_through VARCHAR(100),
  prepared_by INT,
  approved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (disbursement_report_ctrl_number),
  INDEX (disbursement_date)
);

CREATE TABLE IF NOT EXISTS disbursement_report_vouchers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  disbursement_report_id INT NOT NULL,
  payment_voucher_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (disbursement_report_id),
  INDEX (payment_voucher_id)
);

CREATE TABLE IF NOT EXISTS weekly_disbursement_reports (
  weekly_disbursement_report_id INT AUTO_INCREMENT PRIMARY KEY,
  disbursement_report_ctrl_number VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'Draft',
  disbursement_date DATE,
  document_ctrl_number VARCHAR(128),
  purpose VARCHAR(255),
  payee_client VARCHAR(255),
  description TEXT,
  ub_approval_code VARCHAR(128),
  amount_to_pay DECIMAL(15,2) DEFAULT 0,
  paid_through VARCHAR(100),
  prepared_by INT,
  approved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_disbursement_report_scheduled_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  weekly_disbursement_report_id INT NOT NULL,
  scheduled_payment_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (weekly_disbursement_report_id),
  INDEX (scheduled_payment_id)
);

-- Foreign key constraints (optional - enable if your DB and app require strict FK)
-- ALTER TABLE payment_vouchers ADD CONSTRAINT fk_pv_coa FOREIGN KEY (coa_id) REFERENCES chart_of_accounts(coa_id);
-- ALTER TABLE check_vouchers ADD CONSTRAINT fk_cv_coa FOREIGN KEY (coa_id) REFERENCES chart_of_accounts(coa_id);

-- Add sample `users` and `chart_of_accounts` tables/seed rows if they don't exist (non-destructive)
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(128) UNIQUE,
  password_hash VARCHAR(255),
  role_id INT DEFAULT 1,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  coa_id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) UNIQUE,
  name VARCHAR(255),
  deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  vendor_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  contact_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed a couple of users and COA entries (INSERT IGNORE pattern)
INSERT INTO users (user_id, username, full_name)
SELECT 1, 'admin', 'Administrator' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_id = 1);
INSERT INTO users (username, full_name)
SELECT 'acct_user', 'Accounting User' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'acct_user');

INSERT INTO chart_of_accounts (coa_id, code, name)
SELECT 1, '1000', 'Cash' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE coa_id = 1);
INSERT INTO chart_of_accounts (code, name)
SELECT '2000', 'Accounts Payable' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2000');

-- Seed vendors
INSERT INTO vendors (vendor_id, name)
SELECT 1, 'Sample Vendor' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE vendor_id = 1);


-- Now add FK constraints if the referenced tables/columns exist
ALTER TABLE IF EXISTS payment_vouchers ADD CONSTRAINT fk_pv_coa FOREIGN KEY (coa_id) REFERENCES chart_of_accounts(coa_id);
ALTER TABLE IF EXISTS check_vouchers ADD CONSTRAINT fk_cv_coa FOREIGN KEY (coa_id) REFERENCES chart_of_accounts(coa_id);
ALTER TABLE IF EXISTS payment_vouchers ADD CONSTRAINT fk_pv_user FOREIGN KEY (prepared_by) REFERENCES users(user_id);
ALTER TABLE IF EXISTS disbursement_reports ADD CONSTRAINT fk_dr_user FOREIGN KEY (prepared_by) REFERENCES users(user_id);

-- End of AP Management schema
