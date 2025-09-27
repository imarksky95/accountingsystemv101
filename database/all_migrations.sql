-- Consolidated migrations for accountingsystemv101
-- Run this file (or use scripts/run_all_migrations.js) to recreate the schema and seed data.
-- NOTE: Review before running on production. These statements use IF NOT EXISTS / INSERT ... SELECT ... FROM DUAL WHERE NOT EXISTS patterns where possible to be non-destructive.

-- 1) Core init
-- (init-mysql.sql)

-- Create roles and users and chart_of_accounts
CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  coa_id INT AUTO_INCREMENT PRIMARY KEY,
  control_number VARCHAR(20) UNIQUE NOT NULL,
  account_number VARCHAR(50) NOT NULL UNIQUE,
  account_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  parent_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted TINYINT(1) NOT NULL DEFAULT 0
);

INSERT IGNORE INTO roles (role_name) VALUES ('Admin'), ('User');

-- 2) AP Management (ap-management.sql)

-- payment_vouchers
CREATE TABLE IF NOT EXISTS payment_vouchers (
  payment_voucher_id INT AUTO_INCREMENT PRIMARY KEY,
  payment_voucher_control VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'Draft',
  preparation_date DATE,
  purpose VARCHAR(255),
  paid_through VARCHAR(100),
  prepared_by INT,
  payee VARCHAR(255),
  description TEXT,
  amount_to_pay DECIMAL(15,2) DEFAULT 0,
  coa_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_voucher_payment_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_voucher_id INT NOT NULL,
  payee_contact_id INT DEFAULT NULL,
  payee_display VARCHAR(255) DEFAULT NULL,
  description TEXT,
  amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_voucher_journal_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_voucher_id INT NOT NULL,
  coa_id INT NOT NULL,
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  remarks VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- check_vouchers
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 20250927: add signatory columns to check_vouchers (id + manual) and deprecate check_fr/check_to usage
ALTER TABLE IF EXISTS check_vouchers ADD COLUMN IF NOT EXISTS prepared_by INT NULL;
ALTER TABLE IF EXISTS check_vouchers ADD COLUMN IF NOT EXISTS prepared_by_manual VARCHAR(255) NULL;
ALTER TABLE IF EXISTS check_vouchers ADD COLUMN IF NOT EXISTS reviewer_id INT NULL;
ALTER TABLE IF EXISTS check_vouchers ADD COLUMN IF NOT EXISTS reviewer_manual VARCHAR(255) NULL;
ALTER TABLE IF EXISTS check_vouchers ADD COLUMN IF NOT EXISTS approver_id INT NULL;
ALTER TABLE IF EXISTS check_vouchers ADD COLUMN IF NOT EXISTS approver_manual VARCHAR(255) NULL;

-- scheduled_payments and reports (omitted for brevity in this consolidated file - use ap-management.sql directly if needed)

-- 3) Contacts
CREATE TABLE IF NOT EXISTS contacts (
  contact_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  contact_control VARCHAR(64) UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  contact_type ENUM('Customer','Vendor','Employee') DEFAULT 'Vendor',
  contact_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4) Extra fields and migrations (in chronological order)

-- 20250922: company_profile columns
CREATE TABLE IF NOT EXISTS company_profile (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NULL,
  address TEXT NULL,
  logo TEXT NULL,
  logo_mime VARCHAR(50) NULL,
  logo_size_bytes INT NULL
);

-- 20250923: add review/approve columns to roles and migrate to role_type
ALTER TABLE IF EXISTS roles ADD COLUMN IF NOT EXISTS reviewer TEXT NULL;
ALTER TABLE IF EXISTS roles ADD COLUMN IF NOT EXISTS approver TEXT NULL;
ALTER TABLE IF EXISTS roles ADD COLUMN IF NOT EXISTS role_type VARCHAR(10) NOT NULL DEFAULT 'none';

-- 20250923: add workflow columns to users
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reviewer_id INT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS approver_id INT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reviewer_manual VARCHAR(255) NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS approver_manual VARCHAR(255) NULL;

-- 20250923: add contact-related columns to users
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS mobile VARCHAR(50) DEFAULT NULL;

-- 20250924: add PV signatory columns
ALTER TABLE IF EXISTS payment_vouchers ADD COLUMN IF NOT EXISTS reviewer_id INT NULL;
ALTER TABLE IF EXISTS payment_vouchers ADD COLUMN IF NOT EXISTS reviewer_manual VARCHAR(255) NULL;
ALTER TABLE IF EXISTS payment_vouchers ADD COLUMN IF NOT EXISTS approver_id INT NULL;
ALTER TABLE IF EXISTS payment_vouchers ADD COLUMN IF NOT EXISTS approver_manual VARCHAR(255) NULL;

-- 20250924: approval_logs
CREATE TABLE IF NOT EXISTS approval_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20250925: check voucher line tables
CREATE TABLE IF NOT EXISTS check_voucher_payment_lines (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  check_voucher_id INT NOT NULL,
  payee_contact_id BIGINT NULL,
  payee_display VARCHAR(255) NULL,
  description TEXT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  check_number VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS check_voucher_check_lines (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  check_voucher_id INT NOT NULL,
  check_number VARCHAR(64) NOT NULL,
  check_date DATE NULL,
  check_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  check_subpayee BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS check_voucher_journal_lines (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  check_voucher_id INT NOT NULL,
  coa_id INT NULL,
  debit DECIMAL(15,2) NULL DEFAULT 0,
  credit DECIMAL(15,2) NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5) Seeds

INSERT INTO roles (role_name) SELECT 'Admin' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name='Admin');
INSERT INTO roles (role_name) SELECT 'User' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name='User');

INSERT INTO users (user_id, username, full_name)
SELECT 1, 'admin', 'Administrator' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_id = 1);

INSERT INTO chart_of_accounts (coa_id, code, name)
SELECT 1, '1000', 'Cash' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE coa_id = 1);

INSERT INTO chart_of_accounts (code, name)
SELECT '2000', 'Accounts Payable' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2000');

INSERT INTO vendors (vendor_id, name)
SELECT 1, 'Sample Vendor' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE vendor_id = 1);

INSERT INTO chart_of_accounts (code, name)
SELECT '3000', 'Utilities' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code='3000');

INSERT INTO chart_of_accounts (code, name)
SELECT '4000', 'Salaries' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code='4000');

INSERT INTO vendors (name, contact_info)
SELECT 'Vendor A', 'vendorA@example.com' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name='Vendor A');

INSERT INTO vendors (name, contact_info)
SELECT 'Vendor B', 'vendorB@example.com' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name='Vendor B');

-- End consolidated migrations
