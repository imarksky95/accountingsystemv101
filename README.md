# Accounting System System v1.0.2

A modern web-based Accounting System with a React frontend, Node.js/Express backend, and PostgreSQL database. The system supports authentication, user and role management, and a scalable structure for future modules.

git add . && git commit -m "Commit" && git push origin main

## Running consolidated migrations

A consolidated SQL file is available at `database/all_migrations.sql`. To run the migrations against a MySQL instance you can use the provided Node script.

1. Create a `.env` in the repo root with your DB connection details:

```
DB_HOST=148.222.53.12
DB_USER=u325151658_markchrc
DB_PASS=Mark_082020
DB_NAME=u325151658_accounting_db
JWT_SECRET=your_jwt_secret_here
```

2. Run the migrations:

```bash
node scripts/run_all_migrations.js
```

The script executes statements sequentially and skips statements that fail so it's safe to re-run in many cases. Review `database/all_migrations.sql` before running on production.