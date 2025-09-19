CORS notes

This backend accepts requests from a whitelist of origins plus any `*.github.io` origin. If you still see CORS errors when calling the API from the frontend, try one of the following:

- Set `FRONTEND_ORIGIN` in the backend environment to the exact origin used by your deployed frontend (for example `https://imarksky95.github.io` or `https://imarksky95.github.io/accountingsystemv101`).
- For quick testing only, set `ALLOW_ALL_ORIGINS=1` in the backend environment to allow all origins (not recommended for production).

How to redeploy (Render):
1. Push your changes to the Git branch Render is tracking (e.g. `git push origin main`).
2. Let Render build/deploy automatically, or trigger a manual deploy from Render dashboard.
3. Ensure the environment variables (`FRONTEND_ORIGIN`, or `ALLOW_ALL_ORIGINS`) are set in the Render service settings.

Local testing: restart the server after changes:

```bash
cd backend
node index.js
```

Or with nodemon:

```bash
npm install -g nodemon
nodemon index.js
```
