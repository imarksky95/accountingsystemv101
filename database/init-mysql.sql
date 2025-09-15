
-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- Create chart_of_accounts table
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  coa_id INT AUTO_INCREMENT PRIMARY KEY,
  control_number VARCHAR(20) UNIQUE NOT NULL,
  account_number VARCHAR(50) NOT NULL UNIQUE,
  account_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  parent_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(coa_id) ON DELETE SET NULL
);

-- Insert default roles
INSERT IGNORE INTO roles (role_name) VALUES ('Admin'), ('User');
