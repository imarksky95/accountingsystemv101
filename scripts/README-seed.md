Seed helpers

Run the seed script to add example `contacts` and `chart_of_accounts` rows used by the frontend dropdowns.

From project root:

```bash
# ensure backend/.env has DB credentials or set DB env vars
node scripts/seed-contacts-coa.js
```

The script reads `backend/.env` for DB connection values by default.