Migration: add reviewer and approver columns to `roles`

Files:
- `20250923-add-reviewer-approver-to-roles.sql` — ALTER TABLE to add `reviewer` and `approver` TEXT columns.

Apply options:

1) Using MySQL client (recommended):

   # backup the roles table
   mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME roles > roles.backup.sql

   # apply migration
   mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < 20250923-add-reviewer-approver-to-roles.sql

2) Using the included Node script (uses environment variables):

   # set env vars and run
   DB_HOST=localhost DB_USER=root DB_PASS=mysecret DB_NAME=accounting node ../scripts/apply-role-migration.js

Verification:
- Check schema: run `DESCRIBE roles;` and confirm `reviewer` and `approver` columns exist.
- Optionally inspect data: `SELECT role_id, role_name, reviewer, approver FROM roles LIMIT 10;`

Notes:
- Columns are TEXT to be flexible; store JSON-encoded arrays like `[1,2]` or comma-separated lists.
- Always backup before applying migrations.
