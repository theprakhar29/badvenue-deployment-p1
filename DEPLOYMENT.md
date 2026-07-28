# Deploying: Vercel (frontend) + Render (backend)

This covers the specific split-hosting setup — a static frontend on Vercel,
an Express server on Render — and the configuration each side needs to
actually work together. All of this is already wired into the codebase as
of v1.5.2; this doc is about the environment variables and platform
settings you set on Vercel/Render themselves, which no code change can do
for you.

## Why this needs specific configuration at all

Locally, `npm run dev` runs both frontend and backend on the same machine,
and Vite's dev proxy makes them *look* same-origin to the browser. Deployed,
they're on two entirely different domains (`*.vercel.app` and
`*.onrender.com`). That changes three things browsers treat very
differently:

1. A static host like Vercel doesn't know your app has client-side routes —
   it only knows about files it built. Direct navigation to `/organizer/login`
   404s because there's no such file.
2. Cookies (your login session) become "cross-site" — browsers block those
   from JS-initiated requests unless explicitly told this is intentional.
3. Relative API paths (`/api/...`) resolve against whatever domain the page
   is loaded from — which is now Vercel, not your backend.

## Backend (Render) setup

1. Create a **Web Service**, root directory `server/`.
2. Build command: `npm install`. Start command: `npm start`.
3. Environment variables (Render dashboard → your service → Environment):
   all the same ones from `server/.env.example`, plus:
   ```
   NODE_ENV=production
   CLIENT_ORIGIN=https://your-app.vercel.app
   ```
   If you'll also test Vercel's preview deployments (every branch/PR gets
   its own URL), add those too, comma-separated:
   ```
   CLIENT_ORIGIN=https://your-app.vercel.app,https://your-app-git-dev-yourteam.vercel.app
   ```
   `NODE_ENV=production` is what flips cookies to `sameSite: "none"` — this
   is required for login to persist across a cross-site deployment (see
   CHANGELOG v1.5.2 for why `sameSite: "lax"`, the safer default, silently
   breaks this specific setup).
4. Note your deployed backend URL, e.g. `https://ticket-platform-backend.onrender.com`.
5. **Free tier heads-up**: Render's free web services spin down after 15
   minutes of inactivity. The first request after that can take 30-60
   seconds to respond while it wakes back up — this can look like a hang or
   a broken deployment the first time you test after a break. Not a bug.

## Frontend (Vercel) setup

1. Import the project, root directory `client/`. Vercel auto-detects Vite.
2. Environment variables (Vercel dashboard → project → Settings →
   Environment Variables):
   ```
   VITE_API_URL=https://ticket-platform-backend.onrender.com/api
   ```
   Use the exact backend URL from the Render step above, with `/api` on
   the end. **This is read at build time, not runtime** — if you change it,
   you need to redeploy (a plain restart won't pick it up).
3. The included `client/vercel.json` handles the SPA-routing 404 issue
   automatically (rewrites every path to `index.html` so React Router can
   take over) — nothing to configure here, just confirm the file made it
   into your deployment (it should, since it's in the repo root Vercel
   builds from).

## Verifying it actually worked

After both are deployed:

1. Visit your Vercel URL, sign up as an organizer, create an event.
2. **Directly navigate** to `/organizer/dashboard` by typing the full URL
   (not clicking a link) — this specifically tests the Vercel rewrite. It
   should load your dashboard, not 404.
3. **Refresh the page** while logged in — this specifically tests the
   cross-site cookie fix. You should still be logged in after the refresh,
   not bounced to the login page.
4. Open your browser's Network tab, check an API call (e.g. loading the
   dashboard's events) — the request URL should go to your `onrender.com`
   backend, not back to your own `vercel.app` domain.
5. Check the event page shows its banner image correctly (if you uploaded
   one) — this tests the asset-URL resolution fix.

If any of these still fail, check:
- Render's logs for `[ERROR] CORS rejected origin: ...` — if you see this,
  the origin shown doesn't exactly match what's in `CLIENT_ORIGIN` (check
  for a trailing slash, `http` vs `https`, or a preview URL you haven't
  added yet).
- That you actually redeployed the frontend after setting `VITE_API_URL` —
  build-time env vars don't apply retroactively to an already-built deploy.
