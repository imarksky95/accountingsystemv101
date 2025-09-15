-- Company Profile Table
CREATE TABLE IF NOT EXISTS company_profile (
  id INT PRIMARY KEY DEFAULT 1,
  logo LONGTEXT,
  name VARCHAR(255),
  address VARCHAR(255),
  tin VARCHAR(100),
  type VARCHAR(100)
);

-- Insert default row if not exists
INSERT IGNORE INTO company_profile (id, logo, name, address, tin, type) VALUES (1, '', '', '', '', '');
