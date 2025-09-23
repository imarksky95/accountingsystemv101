-- Migration: add workflow columns to users
-- Adds reviewer_id, approver_id (foreign keys to users.user_id) and reviewer_manual, approver_manual (VARCHAR) for typed names
ALTER TABLE users
  ADD COLUMN reviewer_id INT NULL AFTER mobile,
  ADD COLUMN approver_id INT NULL AFTER reviewer_id,
  ADD COLUMN reviewer_manual VARCHAR(255) NULL AFTER approver_id,
  ADD COLUMN approver_manual VARCHAR(255) NULL AFTER reviewer_manual;

-- Note: add foreign key constraints only if your users table and engine support it.
-- ALTER TABLE users ADD CONSTRAINT fk_users_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE SET NULL;
-- ALTER TABLE users ADD CONSTRAINT fk_users_approver FOREIGN KEY (approver_id) REFERENCES users(user_id) ON DELETE SET NULL;
