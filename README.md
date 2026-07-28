# Marquee — Ticket Booking & Management Platform (MERN)

This is the **MERN-stack rebuild** of the earlier Next.js/Prisma/Postgres
prototype — same Sprint 0/1 feature scope, new stack:

- **M**ongoDB (via Mongoose)
- **E**xpress (REST API)
- **R**eact (Vite SPA, not server-rendered)
- **N**ode.js

## What's built

- ✅ Express REST API (`/server`) with organizer signup/login/logout (JWT in
  an httpOnly cookie), event creation (draft), publish/pause, and public
  (no-auth) endpoints for guests.
- ✅ Mongoose models — `Organizer`, `Event` (pricing tiers + form fields
  embedded), and `Booking` (guest checkout, no account).
- ✅ **Form & Ticket Builder (v1.1)** — custom banner upload, toggleable
  preset checkout questions (Phone, Age, Custom Question).
- ✅ **Guest Checkout & Payment (v1.2)** — real quantity-based checkout with
  race-condition-safe inventory holds, a mock payment step, and a booking
  confirmation page.
- ✅ **QR Ticket Generation & Delivery (v1.3)** — one real, styled QR code per
  purchased ticket, generated the moment payment confirms, plus a mock
  email/SMS delivery layer.
- ✅ **Scanner Access Control (v1.4)** — magic-link team member access with a
  real, instantly-enforced kill switch (checked on every scan, not just at
  login), atomic double-scan prevention, and a high-contrast scan console.
- ✅ **Real Payment Gateway — Razorpay (v1.4.1)** — real order creation,
  Checkout integration, and cryptographic signature verification, currently
  running on placeholder keys.
- ✅ **Real Email & SMS — Nodemailer + Twilio/MSG91 (v1.4.2–v1.4.3)** —
  ticket-delivery email with embedded QR codes, delivery SMS, payment-failure
  notifications on both channels, immediate inventory release on failure,
  and a provider switch (MSG91 recommended for Indian numbers). Email
  confirmed working with real credentials.
- ✅ **Camera Scanning, Offline-First Sync & Terminal Logging (v1.5)** —
  WebRTC camera QR scanning (jsQR), IndexedDB-cached offline verification
  with automatic background sync on reconnect, a full scan audit trail
  (`ScanEvent`) that also makes sync retries idempotent, and comprehensive
  color-coded terminal logging (HTTP requests + every domain event: signups,
  bookings, payments, scans, link revocations, sync batches). **This is the
  release with the largest gap between "verified" and "built"** — see
  CHANGELOG.md v1.5.0 for exactly what could and couldn't be tested without
  a real camera/device.
- ✅ React SPA (`/client`, Vite + React Router) — the "Marquee" design system
  throughout.
- ✅ Verified: server boots, all auth boundaries live-tested, double-scan
  prevention and payment-signature logic tested against real/forged/
  reuse-attack cases, real QR generation confirmed end-to-end, offline-sync
  idempotent-replay logic tested in isolation, real SMTP/Twilio calls
  confirmed to fail gracefully with placeholder credentials, client builds
  cleanly. Camera access and true offline device behavior are **not**
  verified — no camera or physical device available in the environment this
  was built in.

## What's not built yet (see CHANGELOG.md for the version-by-version plan)

- Real-time dashboard metrics, audit log viewer (v1.6)

## Project structure

```
ticket-platform-mern/
├── server/              Express API
│   ├── src/
│   │   ├── config/db.js         MongoDB connection
│   │   ├── models/               Organizer, Event, Booking, Ticket, ScannerLink, ScanEvent
│   │   ├── middleware/           auth.js, scannerAuth.js, upload.js, errorHandler.js
│   │   ├── controllers/          auth, event, booking, payment, scan, scannerLink
│   │   ├── routes/               auth, event, public, scanner
│   │   ├── utils/                slugify, validation, token, inventory, tickets,
│   │   │                         notifications, payment, verify, finalizeBooking,
│   │   │                         logger, seed
│   │   ├── app.js               Express app assembly (HTTP + domain-event logging)
│   │   └── index.js             Entry point (connects DB, starts server)
│   ├── uploads/banners/         Uploaded banner images (created at runtime, gitignored)
│   └── .env.example
└── client/              React SPA
    └── src/
        ├── api/client.js         fetch wrapper (credentials: include, + multipart upload)
        ├── context/AuthContext.jsx
        ├── hooks/useOfflineScanner.js   online-first verify, offline fallback, background sync
        ├── utils/                beep, razorpay, offlineDb (IndexedDB)
        ├── components/           Button, Field, Toggle, OrganizerLayout, ProtectedRoute,
        │                         EventStatusControl, ScanConsole, CameraScanner
        ├── pages/                Home, EventDetail, BookingConfirmation, ScanTerminal,
        │                         organizer/{Signup,Login,Dashboard,NewEvent,FormBuilder,
        │                         ScannerLinks,OrganizerScan}
        └── App.jsx               routes
```

## Getting started locally

You need **Node.js 18+** and a **MongoDB** instance (local, Docker, or a free
Atlas cluster — same options as before, just point Mongoose at it instead of
Postgres).

### 1. Start MongoDB

Easiest path — Docker:
```bash
docker run --name ticket-platform-mongo -p 27017:27017 -d mongo:7
```
Or use a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster and grab its connection string instead.

### 2. Set up and run the server

```bash
cd server
npm install
cp .env.example .env
# edit .env: set MONGODB_URI and a random JWT_SECRET
npm run seed     # optional — creates demo@marquee.test / password123 with one published event
npm run dev
```
The API runs on `http://localhost:4000`. Confirm it's up: `curl http://localhost:4000/api/health` → `{"status":"ok"}`.

### 3. Set up and run the client

In a second terminal:
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173`. The Vite dev server proxies `/api/*` requests to
`http://localhost:4000`, so there's no CORS setup needed in local dev.

### 3a. Testing camera scanning on your phone

Camera access (`getUserMedia`) only works in a **secure context** — HTTPS,
or `localhost` itself. Opening the scanner on your phone via your
computer's local network address (`http://192.168.x.x:5173`) is plain HTTP,
so the browser blocks camera access outright — this is what the "Couldn't
access the camera" error usually means, not a bug in the component.

To test on a real phone, run the HTTPS dev server instead:
```bash
cd client
npm run dev:https
```
This prints two URLs — use the **Network** one (e.g.
`https://192.168.1.42:5173`), not Local, and make sure your phone is on the
**same Wi-Fi network** as your computer.

Since this uses a self-signed certificate (there's no real domain to get a
proper one for on your local network), your phone's browser will show a
security warning the first time — this is expected, not a sign something's
wrong:
- **Chrome (Android)**: tap **Advanced** → **Proceed to [IP] (unsafe)**
- **Safari (iOS)**: tap **Show Details** → **visit this website** → **Visit Website**

You only need to click through this once per browser per device.

If the camera still won't open after that, the error message itself now
tells you why (permission denied vs. no camera found vs. camera already in
use by another app) — that specificity was added after an earlier version's
generic "couldn't access the camera" message wasn't actionable enough to
debug from.

### 4. Try the flow

- `/organizer/signup` → create an account (or log in with the seeded demo account).
- **+ New event** → fill in title/date/at least one pricing tier → save draft.
- You'll land on the **Form & Ticket Builder** (Step 2) — upload a banner
  image, toggle on Phone/Age/Custom Question as desired, then **Save & continue**.
- Back on the dashboard, click **Publish**.
- Go to `/` — your event now appears in the public listing (with its banner,
  if you added one); click into it for the public event page.
- You can revisit the Form Builder anytime via **Edit form** on the dashboard.
- **As a guest** (open a private/incognito window, or just navigate there
  logged out): pick a ticket quantity, fill in your name + email or phone,
  answer any custom questions, and click **Book & pay**.
  - **With the default placeholder key**: this will fail with a
    "Payment gateway error" message — expected, since `asdfghjkl` isn't a
    real Razorpay key. This confirms the integration is live and attempting
    a real call, not silently mocking it.
  - **With real Test-mode keys** (see "Going live with real payments"
    below): Razorpay's Checkout modal opens; use one of
    [Razorpay's documented test cards/UPI IDs](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
    to complete a real (test-mode, no actual money) payment. You'll land on
    a confirmation page showing a real, scannable QR code for each ticket,
    with a download link.
  - **With env vars left completely empty**: falls back to the old mock
    payment (always succeeds instantly), same as before v1.4.1.
- Check your server terminal — you'll see `[mock email]` / `[mock sms]` log
  lines showing what would have been sent.
- Try opening the same event in two tabs and buying the last ticket in both
  at once — this is the concurrency logic worth stress-testing first (see
  CHANGELOG.md for why).
- **As the organizer**: on the dashboard, click **Scanners** → **+ New
  link** → copy the generated URL. Open it in a new (incognito) tab — you
  should land on a scan console showing the event name.
- Paste one of the ticket codes from a booking confirmation page into the
  scanner and verify it → should flash green (VALID). Scan the *same* code
  again → should flash red (ALREADY SCANNED).
- **The most important test**: with the scanner tab still open, go back to
  the organizer's Scanners page and click **Revoke**. Then try scanning
  another ticket in the still-open scanner tab — it should be locked out
  immediately, not just on next page load.
- **Camera scanning (needs a real phone or webcam — this is the least-tested
  part of the whole app, see CHANGELOG.md v1.5.0)**: open a scanner link on
  your phone, allow camera access, and point it at a ticket's QR code (e.g.
  on another device's screen). It should decode automatically and flash a
  result — no manual typing needed. If the camera doesn't open, the console
  falls back to manual entry automatically.
- **Offline scanning**: with a scanner link open and the manifest loaded
  (give it a second after opening), turn on airplane mode. Scan/enter a
  valid ticket code — it should still flash VALID, sourced from the local
  IndexedDB cache, with a note that it's recorded offline. Turn connectivity
  back on — the "pending sync" badge should clear within a few seconds as
  it uploads to the server.
- Watch your server terminal throughout all of this — every signup, booking,
  payment, scan, and sync batch now prints a timestamped, color-coded line.

## Going live with real payments

Payment is currently wired to Razorpay using placeholder keys
(`asdfghjkl`) — the real integration code is in place (order creation,
signature verification, webhook handling), but it needs real credentials
to actually process a payment.

**To switch on real payments, change exactly three values in `server/.env`:**

```env
RAZORPAY_KEY_ID="your-real-key-id"
RAZORPAY_KEY_SECRET="your-real-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-real-webhook-secret"
```

Where to get them:
1. **Key ID / Key Secret** — [Razorpay Dashboard](https://dashboard.razorpay.com) → Settings → API Keys. Generate Test mode keys first to verify everything end-to-end with Razorpay's test cards/UPI IDs before switching to Live mode.
2. **Webhook Secret** — same dashboard → Settings → Webhooks → Add New Webhook, pointing at `https://<your-deployed-server>/api/public/payments/webhook`. Whatever secret you set when creating it goes here.

Nothing else in the codebase needs to change — `server/src/utils/payment.js` is the only file that reads these three variables. No key ever touches the client except the public Key ID, which Razorpay's own Checkout requires client-side by design (it's not a secret).

**If you leave the env vars empty entirely** (not even the placeholder), the app falls back to the old mock-payment behavior — useful if you want to test the rest of the app without dealing with Razorpay at all.

## Going live with real notifications

Same pattern, different provider. Email is Nodemailer (SMTP); SMS supports
**two** providers via a switch — MSG91 (recommended for Indian numbers) or
Twilio. Both currently on placeholder credentials.

**Email — in `server/.env`:**

```env
SMTP_HOST="your-smtp-host"
SMTP_PORT=587
SMTP_USER="your-smtp-username"
SMTP_PASSWORD="your-smtp-password"
MAIL_FROM_EMAIL="tickets@yourdomain.com"
MAIL_FROM_NAME="Your Event Name"
```
Works with any SMTP provider — Gmail SMTP for quick testing, SendGrid/AWS SES/Mailgun/Postmark for production.

**SMS — pick one provider:**

```env
SMS_PROVIDER="msg91"   # or "twilio"

# If msg91:
MSG91_AUTH_KEY="your-auth-key"
MSG91_SENDER_ID="your-sender-id"
MSG91_ROUTE="4"

# If twilio:
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_FROM_NUMBER="+1your-twilio-number"
```

- **MSG91** ([console.msg91.com](https://control.msg91.com)): Auth Key is under API settings. Sender ID needs DLT registration for production — MSG91's onboarding walks you through it, and their free trial credits work for initial testing without full DLT setup. **This integration hasn't been tested against a live MSG91 account** (see CHANGELOG.md v1.4.3 for exactly why) — verify your first real send carefully.
- **Twilio** ([console.twilio.com](https://console.twilio.com)): Account SID + Auth Token on the dashboard homepage. Getting an Indian-capable sending number requires business verification (a TRAI/DLT regulatory restriction, not Twilio-specific) — this is why MSG91 is the more common pick for Indian SMS.

`server/src/utils/notifications.js` is the only file that reads any of these. Email and SMS are independent — set up one without the other and the unset one falls back to a console-log mock.

## What I verified vs. couldn't verify

This section covers the original v1.0 baseline; **each subsequent version's
CHANGELOG entry has its own detailed verification notes** — especially
v1.5.0, which has the largest verified/built gap of any release so far
(camera and offline behavior couldn't be tested at all in this environment).

I don't have a live MongoDB in the environment I built this in, so I couldn't
run a true end-to-end test against a real database. Here's exactly what I did
confirm, so you know what's solid vs. what to double-check on first run:

- ✅ Every server file passes a Node.js syntax check.
- ✅ The Express app boots and the `/api/health` route responds correctly.
- ✅ The auth middleware correctly returns 401 for an unauthenticated request
  to a protected route.
- ✅ The React client builds cleanly with `vite build` (production bundle),
  and all imports resolve.
- ❌ I could **not** run a live signup → create event → publish → view flow
  against a real MongoDB, because the sandbox I built this in blocks the
  network calls MongoDB's local test-server tooling needs. This is the
  highest-value thing to try first when you run it yourself — if anything's
  going to surface a bug, it'll be here.

## Known accepted issues

- **`esbuild`/Vite dev server** (moderate): only affects the local dev
  server (a malicious website could probe `localhost:5173` while
  developing) — doesn't affect the production build output. Fixing it
  requires Vite 6+, held off to avoid a breaking change.
- **`react-router-dom`** (moderate, as of v1.5): an open-redirect
  vulnerability affecting the entire 6.x line up through 7.17 — the fix
  needs a major version jump to 7.18+. I checked our actual usage: every
  dynamic route in this codebase (`navigate()`, `<Link to={...}>`) uses
  server-generated MongoDB IDs or slugs, never raw user-typed text, which
  is the specific attack vector this CVE needs — so the practical risk here
  is low, but the dependency itself is still flagged. Revisit before
  production, since it's a straightforward (if breaking) upgrade whenever
  there's time to test the routing migration.

Both are dependency-level issues, not application bugs — re-run `npm audit`
periodically, since patched versions may land without needing the major
bump.