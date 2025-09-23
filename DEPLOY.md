Short deploy & verification steps

Frontend (dev)

- Install and run dev server:

```bash
cd frontend
npm install
npm start
```

Frontend (build & deploy)

- Build production bundle and run your deploy script (adjust if you use a different deploy flow):

```bash
cd frontend
npm install
npm run build
npm run deploy   # optional: your deployment step (gh-pages, render, etc.)
```

Backend (dev / local)

- Install and run the backend. Set required env vars (DB and JWT_SECRET). For local quick dev allowing local origins:

```bash
cd backend
npm install
# Recommended for local dev only (allows any origin):
ALLOW_ALL_ORIGINS=1 JWT_SECRET=shh DB_HOST=127.0.0.1 DB_USER=root DB_PASS=pass DB_NAME=acctsys node index.js

# Or provide explicit env and run:
FRONTEND_ORIGIN=http://127.0.0.1:3000 JWT_SECRET=shh DB_HOST=127.0.0.1 DB_USER=root DB_PASS=pass DB_NAME=acctsys node index.js
```

Quick API verification (use the host/port where your backend runs; example uses localhost:5000)

1) Login to get a token (replace credentials):

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"root","password":"password"}' | jq .
```

Copy the returned `token` value from JSON.

2) Verify roles and users endpoints (requires Super Admin token):

```bash
TOKEN="<PASTE_TOKEN_HERE>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/roles | jq .
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/users | jq .
```

Frontend verification in browser

- Open `http://127.0.0.1:3000` (or `http://localhost:3000`) and login using Super Admin credentials.
- Navigate to Settings → Users and Role Settings.
  - You should see Roles and Users lists populated.
  - If you're logged in as Super Admin (role_id === 1) the "Add User" button appears.
- If you see a placeholder instead of the component, clear browser cache or open an Incognito window. Also ensure the deployed frontend was rebuilt and redeployed.

Common troubleshooting

- CORS origin mismatch (127.0.0.1 vs localhost): either use the same host in the browser as the backend `FRONTEND_ORIGIN`, or start backend with `ALLOW_ALL_ORIGINS=1` for local dev.
- Slow or pending login: check backend logs and `/tmp/last-login.json` (backend writes timing info) to see DB vs bcrypt vs JWT timings.
- If endpoints return 401/403, validate the token with `/api/auth/me` and that the user has `role_id` 1 for admin operations.

If you want, I can commit this file and mark the remaining todo done (I will do that next).