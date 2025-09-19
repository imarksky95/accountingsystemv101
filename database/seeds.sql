-- Additional seeds for AP

INSERT INTO chart_of_accounts (code, name)
SELECT '3000', 'Utilities' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code='3000');

INSERT INTO chart_of_accounts (code, name)
SELECT '4000', 'Salaries' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code='4000');

INSERT INTO vendors (name, contact_info)
SELECT 'Vendor A', 'vendorA@example.com' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name='Vendor A');

INSERT INTO vendors (name, contact_info)
SELECT 'Vendor B', 'vendorB@example.com' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name='Vendor B');

INSERT INTO users (username, password_hash, role_id, full_name)
SELECT 'manager', 'PLACEHOLDER', 2, 'Manager User' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='manager');

-- Note: replace 'PLACEHOLDER' with actual bcrypt hashes if you want usable seeded passwords
