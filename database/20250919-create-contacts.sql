-- Migration: create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  contact_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  contact_control VARCHAR(64) UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  contact_type ENUM('Customer','Vendor','Employee') DEFAULT 'Vendor',
  contact_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
