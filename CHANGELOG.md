# Changelog

## v1.5.3 — Email Delivery Fix: Render's SMTP Port Block (current)

**Real bug report from production**: ticket emails were confirmed working
locally and in an earlier deployment, then started failing with
`Connection timeout` once running on Render. Confirmed via search: Render's
free-tier web services have blocked outbound traffic on SMTP ports 25, 465,
and 587 since September 26, 2025 — a platform policy change, not something
wrong with the SMTP credentials or code. Every SMTP send from a free Render
instance will time out regardless of how correctly it's configured.

**Fixed:** added **Resend** as a second email provider — it sends over
HTTPS, not SMTP ports, so Render's block doesn't affect it. Genuinely free
tier (3,000 emails/month, 100/day). Switch via one env var:

```env
EMAIL_PROVIDER="resend"
RESEND_API_KEY="your-real-key"
```

SMTP remains the default (`EMAIL_PROVIDER=smtp` if unset) so existing setups
— including a working local Gmail SMTP config — are completely unaffected;
this is purely additive.

**One deliberate simplification, not an oversight:** the SMTP path embeds
QR codes directly in the email body (inline, via `cid` references). The
Resend path attaches them as regular (downloadable, non-inline) attachments
instead — done to avoid depending on inline-image behavior I couldn't
verify against a live Resend account. The email text adjusts its wording
accordingly ("attached to this email" vs. "shown below") so it's not a
silently broken UX either way.

**Verified — same rigor as always, and same honest miss-then-catch as the
MSG91 integration:**
- Confirmed the Render SMTP block is real via a live web search (Render's
  own changelog, dated Sept 16 2025), not assumed.
- Confirmed the module loads and all exports are intact.
- Confirmed the fully-unconfigured mock fallback (what you're currently
  relying on for SMS) has zero regression.
- Confirmed `EMAIL_PROVIDER` left unset still takes the SMTP path (matches
  every existing deployment) — verified indirectly: attempting a real SMTP
  connection with fake credentials hangs trying to connect rather than
  instantly logging a mock line, which is the correct behavior.
- **Almost mis-reported a false positive again**: testing the Resend path
  with a placeholder key returned what looked like a real Resend error
  message ("Internal server error..."). Checked the response headers before
  writing that down and found `x-deny-reason: host_not_allowed` — same
  sandbox network restriction that caused the MSG91 false-positive earlier.
  That response was my own sandbox blocking the request, not Resend. What's
  actually confirmed: the error-handling path doesn't crash and produces a
  clean `FAILED` record either way. What's **not** confirmed: Resend's real
  API response shape, or that a real send succeeds. Verify your first real
  Resend send.

---

## v1.5.2 — Split Deployment Fixes: Vercel + Render

**Real bug report from an actual deployment**: frontend on Vercel, backend
on Render. Two symptoms reported: direct navigation to `/organizer/login`
404s from Vercel, and logging in "works" but the session disappears when
navigating back to the home page. Investigated and found **three** separate
issues, not just the one that was visibly noticed — all stemming from the
same root cause: this app was built and tested assuming frontend and
backend share an origin (true in local dev, via Vite's proxy), which stops
being true the moment they're deployed to two different domains.

**Fixed:**
1. **The reported 404**: Vercel serves the build as static files and has no
   idea `/organizer/login` should load the app — that route only exists
   once React Router (JS) takes over. Added `client/vercel.json` with a
   rewrite so every path serves `index.html`, letting client-side routing
   handle it.
2. **The reported lost session**: the auth cookie was configured
   `sameSite: "lax"`, which browsers correctly block on cross-site
   JS-initiated requests (Vercel and Render are different domains, so this
   is genuinely cross-site, not same-site as it was in local dev). Now
   `sameSite: "none"` + `secure: true` in production
   (`server/src/utils/token.js`), which is what cross-site cookies actually
   require.
3. **Not yet reported, but would have hit next**: the client called a
   relative `/api/...` path, which only worked locally because of Vite's
   dev proxy. In production there's no proxy — that path would resolve
   against Vercel's own domain and hit nothing. Same bug affected banner
   image URLs. Added a `VITE_API_URL` build-time env var and a
   `resolveAssetUrl()` helper (`client/src/api/client.js`), applied
   everywhere a banner is rendered.

**Also improved while fixing #2:** CORS now accepts a comma-separated list
of allowed origins (`CLIENT_ORIGIN`), since a real Vercel deployment usually
has more than one relevant URL (production + per-branch previews), and logs
exactly which origin got rejected and why, rather than a silent CORS
failure.

**New**: `DEPLOYMENT.md` — a dedicated Vercel+Render walkthrough with the
specific env vars each side needs and a verification checklist.

**Verified — more thoroughly than usual, since these were concrete,
reproducible bugs rather than "will this work on a real device" unknowns:**
- Multi-origin CORS logic: tested against two allowed origins, one
  disallowed origin (correctly rejected, with the log line confirmed), and
  a no-origin request (server-to-server, e.g. the Razorpay webhook —
  correctly always passes).
- Cookie settings: confirmed `sameSite`/`secure` actually flip correctly
  between `NODE_ENV=development` and `production`.
- `VITE_API_URL`: built the client with a real backend URL set and
  confirmed — by grepping the compiled output — that it's genuinely baked
  into the JS bundle, not just theoretically wired up.
- Full server regression suite (all auth boundaries, all routes) re-run
  clean after all changes.

**Still can't verify directly**: an actual live Vercel+Render deployment,
since that requires accounts and hosting I don't have access to. This
release fixes the three issues that *would* break any split deployment of
this app, based on direct code inspection of the cross-origin assumptions —
but confirming it on your actual `badvenue.vercel.app` deployment is still
on you.

---

## v1.5.1 — Camera Fix: Secure Context Requirement

**Real bug report from testing on an actual phone** (exactly the scenario
v1.5.0 flagged as unverified): camera showed "Couldn't access the camera.
Use manual entry below." with nothing else to go on.

**Root cause**: `getUserMedia` (camera access) is only available in a
*secure context* — HTTPS, or `localhost` itself. Opening the scanner link
on a phone via the computer's LAN IP (`http://192.168.x.x:5173`) is plain
HTTP, so `navigator.mediaDevices` doesn't exist at all there. Calling
`.getUserMedia` on `undefined` throws a generic `TypeError` that looks
nothing like a permissions problem — which is exactly why the error message
was so unhelpful. This wasn't a typo or logic bug, it's a fundamental
browser security restriction I hadn't surfaced clearly enough.

**Fixed:**
- `CameraScanner.jsx` now checks `window.isSecureContext` and the existence
  of `navigator.mediaDevices` *before* attempting camera access, and reports
  the specific reason (insecure context / unsupported browser / permission
  denied / no camera found / camera in use elsewhere) instead of one generic
  message for every failure mode.
- Added an HTTPS dev mode: `npm run dev:https` (in `client/`), using
  `@vitejs/plugin-basic-ssl` for a self-signed local certificate. Vite's dev
  server also now binds to `host: true` (all network interfaces, not just
  localhost) so a phone on the same Wi-Fi can actually reach it via the
  computer's LAN IP.
- README now walks through exactly how to test camera scanning on a real
  phone, including how to click through the expected self-signed-certificate
  browser warning (Chrome/Safari steps included).

**Verified:**
- Confirmed both `npm run dev` (plain HTTP, unaffected) and `npm run
  dev:https` actually start correctly and print the right URLs — this is
  something I could genuinely test, unlike the camera itself.
- Confirmed the production build (`npm run build`) still succeeds with the
  new dev-only dependencies (`@vitejs/plugin-basic-ssl`, `cross-env`).
- No new `npm audit` findings introduced.

**Still can't verify directly**: whether the camera now actually opens and
scans on your phone once you use the HTTPS URL — that's on you to confirm,
same fundamental limitation as v1.5.0. But the failure mode should now be
self-diagnosing: if something's still wrong, the error message itself
should say why, rather than the one generic line from before.

---

## v1.5.0 — Camera Scanning, Offline-First Sync & Terminal Logging

The big one from the original roadmap — per your PRD, offline-first
scanning is core V1 functionality, not a nice-to-have, so this is the most
substantial single release so far.

**Added:**
- **Camera-based QR scanning** (`CameraScanner.jsx`): live camera feed via
  WebRTC `getUserMedia`, decoded frame-by-frame with `jsQR` (pure JS, no
  native binary — deliberately avoided that risk class after the Prisma/
  mongodb-memory-server binary-download issues earlier in this project).
  Manual code entry is still available as a toggle, since camera access can
  fail (permissions, no camera, etc.) and needs a fallback.
- **Offline-first verification**: opening a scanner link now caches that
  event's ticket list (token + tier + status — deliberately *not* guest
  names/emails, so the cached copy carries minimal exposure if a device is
  lost) into IndexedDB. If the device loses connectivity, scans are checked
  against this local cache instead of failing.
- **Background sync**: offline scans are queued locally and automatically
  replayed to the server via a new batch endpoint the moment connectivity
  returns (listens for the browser's `online` event, plus a 15s fallback
  poll for flaky-but-not-clean disconnects that don't fire that event
  reliably).
- **New `ScanEvent` model** — a full audit trail of every scan attempt
  (valid, already-used, invalid, wrong-event), online or offline. This also
  provides the idempotency mechanism that makes sync retries safe: replaying
  a sync batch (e.g. after a network hiccup mid-upload) returns each scan's
  *original* recorded result instead of re-evaluating it.
- **Comprehensive terminal logging**: HTTP request logging (morgan) plus a
  custom structured logger (`utils/logger.js`) with color-coded categories
  (auth, event, booking, payment, scanner, scan, sync) — every signup,
  login, booking, payment, scan, link creation/revocation, and sync batch
  now prints a timestamped line.

**On conflict resolution (the thing the original roadmap flagged as the
hardest design decision in this whole module):** if the same ticket is
scanned on two offline devices before either syncs, both devices will
locally show VALID — each only knows its own cached copy. Whichever
device's sync request reaches the server *first* wins (the same atomic
compare-and-swap from v1.2/v1.4); the second is marked ALREADY_USED once
its sync completes. This is "first-to-sync-wins," not "first-to-
chronologically-scan-wins" — true ordering across independent devices would
need synchronized clocks, which isn't something to promise without being
able to guarantee it. Documented as a deliberate simplification, not an
oversight.

**Verified — the server-side half, thoroughly:**
- All new routes (offline-manifest, sync-scans, on both the scanner-link
  and organizer paths) live-tested and correctly reject unauthenticated
  requests.
- The idempotent-replay logic — the mechanism that makes sync retries
  safe — tested in isolation: a retried scan returns its original result
  rather than re-evaluating, while a genuinely different scan of the same
  (now-used) ticket still correctly gets ALREADY_USED.
- Re-ran the v1.2/v1.4 payment-signature and inventory tests as a
  regression check after all these changes — still correct.
- Caught and fixed a real bug before it shipped: `verify.js` initially
  referenced `crypto.randomUUID()` without importing `crypto` — a syntax
  check doesn't catch that, only actually executing the module does, which
  is what caught it here.
- Terminal logging confirmed working live — you can see timestamped,
  color-coded lines for every request and domain event when running the
  server.

**What I could NOT verify — and this is the important part of this
release:** I have no camera, no physical device, and no way to simulate a
real network disconnect in this sandbox. Specifically unverified:
- That `CameraScanner.jsx` actually requests camera permission and decodes
  a real QR code correctly in a real browser.
- That IndexedDB caching, offline detection, and the sync queue behave
  correctly on a real device with Wi-Fi actually turned off (versus my
  code's logical correctness, which is all I could check).
- The full conflict-resolution scenario end-to-end (two real devices,
  genuinely offline, scanning the same ticket).

**This is, honestly, the release most likely to need real fixes once you
test it on an actual phone.** The three things worth trying first, in order:
1. Open a scanner link on your phone and confirm the camera actually opens
   and scans a real ticket's QR code.
2. Turn on airplane mode, scan a cached ticket, confirm it still shows
   VALID locally, then turn connectivity back on and confirm the "pending
   sync" badge clears and the scan lands in the database.
3. The two-device conflict scenario described above, if you can arrange it.

---

## v1.4.3 — MSG91 SMS Support

Twilio doesn't readily support Indian sending numbers without business
verification — a TRAI/DLT regulatory restriction, not a Twilio limitation
specifically, but it applies regardless. Added **MSG91** as an alternative
SMS provider, since it's the standard choice for Indian numbers and has a
genuinely free trial tier. `SMS_PROVIDER` env var switches between them;
Twilio's integration is untouched and still works if you set it back.

**Added:**
- `sendViaMsg91()` in `notifications.js`, using MSG91's documented v2 Send
  SMS API directly (no new npm dependency — plain `fetch`).
- Phone number normalization for MSG91's expected format (bare
  `91XXXXXXXXXX`, no `+`), handling `+91`, leading `0`, spaces, and dashes.
- `SMS_PROVIDER=msg91` set as the new default in `.env.example`, with
  `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, `MSG91_ROUTE` placeholders.

**On verification — I need to correct something here.** I initially tested
`sendViaMsg91()` against the placeholder credentials and got back an HTTP
403, which I almost reported as "MSG91 correctly rejecting a bad auth key."
Before writing that down, I checked the response headers and found
`x-deny-reason: host_not_allowed` — that 403 was my own sandbox's network
proxy blocking the request (`api.msg91.com` isn't in my allowed domains),
not MSG91 responding at all. Correcting the record: **this integration has
the same unverified status as Razorpay and Twilio** — I confirmed the
error-handling path doesn't crash on a failed request, but I have not
gotten a genuine response from MSG91's servers, and the API request shape
is less certain than Twilio's (MSG91's API is less globally standardized
and I have lower confidence in it). Verify your first real MSG91 send
carefully, and compare against MSG91's current API docs if it doesn't
behave as expected.

**Verified — the parts I actually could:**
- Phone number normalization tested against six realistic input formats
  (with/without `+91`, leading zero, spaces, dashes) — all correct.
- Provider-switch dispatch logic (`SMS_PROVIDER=msg91` vs `twilio`) reviewed
  and structurally sound.
- Server boots, all files pass syntax checks, client still builds.

---

## v1.4.2 — Real Email & SMS Notifications

Replaces the console-log mock delivery from v1.3 with real email (Nodemailer/
SMTP) and SMS (Twilio), currently on placeholder credentials. Same pattern as
the Razorpay integration: real code, `.env`-only config, graceful mock
fallback if left completely unset. See README.md → "Going live with real
notifications" for exactly what to change.

**Added:**
- Real ticket-delivery email: HTML email with each ticket's QR code embedded
  inline (as a `cid` attachment, so it renders in the email body, not just
  as a download), sent the moment a booking is confirmed.
- Real ticket-delivery SMS: short confirmation message with a link to the
  booking confirmation page.
- **New: payment-failure notifications.** When a payment fails — either the
  signature verification failing on `/confirm`, or a genuine
  `payment.failed` webhook from Razorpay — the guest now gets an email and
  SMS explaining what happened. This is new behavior, not just a real-ify
  of something mocked before.
- **Improved**: on payment failure, held inventory is now released
  *immediately* rather than waiting up to 10 minutes for the hold to expire
  on its own — no reason to keep a ticket locked once we already know the
  payment didn't succeed.
- `Booking.deliveryLog` now records `purpose` (`TICKET_DELIVERY` vs.
  `PAYMENT_FAILED`) and, if a send itself fails (bad credentials, provider
  outage), `status: "FAILED"` with the error — so notification failures are
  visible in the data, not silent.
- Shared `failBooking()` helper (alongside the existing
  `finalizeConfirmedBooking()`) used by both the client-confirm failure path
  and the webhook's `payment.failed` path, same reasoning as before: one
  place, so the two paths can't drift apart.

**Verified — real behavior, not just code review:**
- Called the actual send functions with placeholder credentials and
  confirmed both fail cleanly: SMTP fails DNS resolution on the placeholder
  host, and Twilio's SDK rejects the malformed Account SID *before even
  attempting a network call*. Neither crashed; both produced structured
  `FAILED` delivery records with real error messages.
- Confirmed the mock fallback still works correctly when env vars are left
  completely empty (both channels log and report `SENT`, same as v1.3's
  behavior).
- Server boots, all files pass syntax checks, client still builds (no
  client changes were needed for this feature — it's entirely server-side).

**Not verified**: an actual delivered email or SMS, since that needs real
provider credentials and my sandbox can't reach either provider's API
anyway. Once you add real SMTP/Twilio credentials, sending yourself a test
booking end-to-end is the thing to check before trusting this.

---

## v1.4.1 — Real Payment Gateway (Razorpay)

Pulled forward ahead of v1.5 (offline scanning) at request — this replaces
the mock payment from v1.2 with a real Razorpay integration, currently
configured with placeholder keys (`asdfghjkl`) that you'll swap for real
ones. See README.md → "Going live with real payments" for exactly what to
change (three env vars, one file, nothing else).

**Added:**
- Real Razorpay order creation, Checkout modal integration, and
  cryptographic payment-signature verification (`server/src/utils/payment.js`
  — the one file that talks to Razorpay).
- A webhook endpoint (`POST /api/public/payments/webhook`) as the *reliable*
  confirmation path — finalizes a booking even if the guest's browser
  closes right after paying, before the client-side confirm call fires.
  Idempotent: a webhook that arrives after the client already confirmed the
  same booking safely does nothing.
- Booking-finalization logic (issue tickets, mark inventory sold, mock
  deliver) was refactored into one shared function
  (`utils/finalizeBooking.js`) used by both the client-confirm path and the
  webhook path, specifically so those two paths can't drift out of sync
  with each other over time.
- **Local dev fallback preserved**: if `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`
  are left completely empty (not even the placeholder), the app falls back
  to the old always-succeeds mock payment — so you can still test everything
  else without touching Razorpay at all.

**What "asdfghjkl" actually does right now:** the app treats any non-empty
value as "configured" and will attempt a real call to Razorpay's API using
it. Since it's not a real key, that call will fail — you'll see a clean
`Payment gateway error: ...` response rather than a crash, but checkout
won't complete until real keys are in place. This is expected, not a bug.

**Verified — and unusually thoroughly this time, since signature
verification is pure cryptography that needs no live database or network:**
- Ran the actual signature-verification function against a genuinely
  correct HMAC signature (accepted), a forged one (rejected), and a
  signature-reuse attack — a real signature paired with a *different*
  payment ID (rejected). Same three tests repeated for the webhook
  signature. All five passed. **This is the actual security boundary of
  the entire payment flow, and it's provably correct, not just
  code-reviewed.**
- Called the real Razorpay SDK with the placeholder key and confirmed it
  fails cleanly (502, structured error) rather than crashing the server or
  leaking a raw stack trace.
- Verified the webhook's raw-body/signature plumbing end-to-end: a
  correctly-signed payload passes verification and reaches the database
  layer; a forged one is rejected before ever touching the database.
- Server boots, all files pass syntax checks, client builds cleanly.
- **Not verified**: an actual live Razorpay Checkout session, since that
  needs real credentials I don't have and a payment gateway domain my
  sandbox can't reach. Once you add real Test-mode keys, that first live
  checkout run-through is the thing to do before going further.

---

## v1.4.0 — Scanner Access Control

**Added:**
- Magic-link scanner authentication: organizers generate a link
  (`/scan/:token`) for each door/staff member. Opening the link *is* the
  authentication — no account or password on the team member's end.
- **Real kill switch**: revoking a link is enforced by re-checking the
  `ScannerLink` status from the database on every single scan request, not
  just at login. This is the detail that makes "instant" actually true — a
  JWT-only check would let a revoked link keep working until its token
  expired (up to 12h later); this doesn't.
- Actual QR token validation: `verifyTicketCore` looks up a scanned code,
  confirms it belongs to the right event, and atomically flips it
  `UNUSED → USED` using the same compare-and-swap pattern as the v1.2
  inventory logic — two scanners can't both check the same ticket in.
- Organizer dashboard: **Scanners** page per event to create/label/copy/revoke
  links, plus a **Scan tickets** option for the host to scan their own event
  directly (no link needed).
- A full-screen, high-contrast scan console (solid green/red result states +
  audio cue) per the PRD's "High-Visibility UI" spec — currently driven by
  manual code entry rather than a camera. Camera-based WebRTC scanning is
  v1.5; a manual-entry scanner is honestly more testable right now anyway,
  since verifying a camera flow needs a physical device neither of us has
  in this conversation. The booking confirmation page now shows each
  ticket's raw code specifically so it can be typed into the scanner for
  testing.

**Verified — three different ways, given I still can't run this against a
live database:**
1. **Auth boundaries, live-tested**: booted the real app and confirmed
   `/api/scanner/verify` and the scanner-link management routes correctly
   reject requests with no session (401), and that the public activation
   route is wired through to the controller (reached the DB layer, which
   then timed out only because there's no live MongoDB here — not a routing
   bug).
2. **Double-scan race logic, tested in isolation**: wrote a standalone
   simulation of the compare-and-swap update against a fake in-memory
   ticket record and confirmed the second of two "simultaneous" scans
   correctly gets `ALREADY_USED`, not a second `VALID`.
3. Client builds cleanly, all server files pass syntax checks.

**Still not verified**: the full live loop (organizer creates a link → team
member opens it → scans a real ticket → organizer revokes it mid-session →
team member gets locked out on their very next scan). That last part — does
revocation *actually* interrupt an in-progress session — is the single most
important thing to test yourself before trusting this in front of a real
door.

**Known limitations / deferred to v1.5:**
- No camera/WebRTC scanning yet — manual code entry only.
- No offline support — the scanner needs a live connection to `/api/scanner/verify`.
  Per your PRD, offline-first scanning is explicitly core V1 functionality,
  not a nice-to-have, so this is the headline feature of v1.5, not a minor
  follow-up.

---

## v1.3.0 — QR Ticket Generation & Delivery

**Added:**
- Real QR ticket generation: one `Ticket` document per purchased unit (2x
  General + 1x VIP = 3 separate scannable tickets, not one ticket for "3").
  Each gets an unguessable 192-bit random token as its identity and a
  pre-rendered QR image styled with the Marquee navy/paper palette.
- Tickets are issued automatically the moment mock payment confirms, right
  before the (also mocked) email/SMS delivery step.
- **Mock delivery**: `server/src/utils/notifications.js` logs what would be
  sent via email/SMS and records it on the booking's `deliveryLog`, same
  pattern as the mock payment layer — isolated so a real Twilio/SendGrid
  integration is a contained swap later.
- Booking confirmation page now renders each ticket as its own card with a
  scannable QR code, a download link, and which channel(s) it was "sent" to.

**Verified — and this time I could verify the actual new logic directly:**
- Ran real QR code generation standalone (not mocked, not simulated) and
  confirmed it produces a valid PNG data URL with our color palette applied.
  This is the one piece of this release that's genuinely proven to work,
  independent of having a live database.
- Server boots, all files pass syntax checks, client builds cleanly.
- **Still not verified**: the full issue → store → display pipeline against
  a live database (same sandbox limitation as every release so far). The
  ticket-issuance database writes are simple, low-risk Mongoose calls (no
  exotic query syntax like the inventory reservation had), so I'd rate this
  release's DB-dependent risk as lower than v1.2's — but "lower risk" isn't
  "verified," so still worth a real run-through.

**Known limitations / deferred:**
- QR tokens aren't verifiable yet — there's no scan/validate endpoint. That
  lands in v1.4 with the scanner magic-link module, which is what actually
  reads these tokens and marks tickets `USED`.
- No real email/SMS provider — see "mock delivery" above.
- QR is a plain styled code, not the "custom-shaped" QR your PRD mentions
  (which implies deeper visual customization, like embedding a logo in the
  code's center or shaping the modules). Flagging this as a deliberate scope
  cut, not an oversight — revisit if custom QR shape/branding matters for
  your launch.

---

## v1.2.0 — Guest Checkout & Payment

**Added:**
- Real guest checkout on the public event page: quantity selectors per
  ticket tier, contact form (name + email/phone, no account), and the
  event's enabled custom questions (Phone/Age/Custom Question from the Form
  Builder) rendered dynamically.
- Atomic, race-condition-safe inventory reservation (`server/src/utils/inventory.js`)
  using an optimistic-concurrency compare-and-swap — two guests can't both
  buy the last ticket.
- Booking lifecycle: `PENDING` (inventory held) → `CONFIRMED` (paid) →
  `EXPIRED` (unpaid hold released after 10 minutes) → `FAILED` / `CANCELLED`.
- **Mock payment**: `POST /api/public/bookings/:id/confirm` always succeeds
  instead of calling a real gateway — isolated behind one clearly-marked
  block in `booking.controller.js` so swapping in Razorpay/Stripe later
  doesn't touch the surrounding inventory/booking-state logic.
- Booking confirmation page (`/bookings/:id`) showing the order summary.
- New public endpoints: `POST /api/public/events/:slug/bookings`,
  `POST /api/public/bookings/:id/confirm`, `GET /api/public/bookings/:id`.

**A note on how this was built:** the first version of the inventory-reservation
logic used a MongoDB `arrayFilters` + `$expr` pattern that I wasn't able to
verify against a live database and wasn't fully confident was correct across
MongoDB versions. Since this is the piece that prevents overselling, I
replaced it with a plain compare-and-swap (`$elemMatch` on exact current
values + `$inc`) — foundational MongoDB operators I'm confident in without
needing to test live. **This is still the single highest-value thing to
stress-test yourself**: open the same event in two browser tabs and try to
buy the last ticket in both at once.

**Verified:**
- Server boots, all files pass syntax checks.
- Booking validation logic unit-tested directly (valid case, missing
  contact info, empty cart — all behave correctly).
- Client builds cleanly.
- **Not verified against a live database** — same sandbox limitation as
  v1.0.0/v1.1.0. This release has the most untested-live surface area yet
  (checkout, payment mock, inventory holds), so budget real testing time
  before trusting it.

**Known limitations / deferred:**
- No real payment gateway — see "mock payment" above.
- No QR ticket generation or email/SMS delivery yet (v1.3).
- Expired-hold cleanup is lazy (runs when someone views the event page or
  starts a checkout), not a scheduled job — fine for a prototype, revisit
  before production.

---

## v1.1.0 — Form & Ticket Builder

**Added:**
- Custom banner upload for events (JPEG/PNG/WEBP, up to 5MB), stored on disk
  under `server/uploads/banners` and served at `/uploads/banners/...`.
- Preset checkout form fields — Phone, Age, and a Custom Question — that
  organizers can toggle on/off and mark required, per event.
- Event wizard is now genuinely "Step 1 of 3, Step 2 of 3": creating a draft
  (Step 1) now routes into the new Form Builder (Step 2) before landing back
  on the dashboard to publish (Step 3).
- New endpoints: `GET /api/events/:id`, `PUT /api/events/:id/form-fields`,
  `POST /api/events/:id/banner`.
- Banners now render on the public listing cards and the public event page.

**Verified:**
- Server boots, protected routes still 401 correctly.
- New Zod validation logic for form fields unit-tested directly (custom
  question can't be enabled without label text; all-disabled state is valid).
- Client builds cleanly via `vite build`.
- Not verified against a live database in my environment — same limitation
  as v1.0.0 (see README). Try the full upload + toggle + save flow first when
  you run this.

**Known limitation:** banner files are stored on local disk, not S3/cloud
storage. Fine for a prototype; revisit before deploying anywhere with
ephemeral or multi-instance hosting (files won't survive a redeploy or be
shared across instances).

---

## v1.0.0 — Prototype

**Stack:** MongoDB, Express, React (Vite SPA), Node.js

**Included:**
- Organizer signup / login / logout (JWT in httpOnly cookie)
- Event creation wizard — title, venue, city, date, capacity, description,
  pricing tiers (draft-save)
- Organizer dashboard — list events, publish / pause a show
- Public home page — lists published events
- Public event page — shows event details + live ticket availability
  (checkout not yet wired up)

**Not included yet (planned for future versions):**
- v1.1 — Form Builder (custom fields beyond pricing tiers)
- v1.2 — Guest checkout & payment
- v1.3 — QR ticket generation & delivery (email/SMS)
- v1.4 — Scanner magic links + kill switch (host's team member access)
- v1.5 — WebRTC scanning + offline-first sync
- v1.6 — Real-time sales/entry dashboard metrics + audit log

**Known issues:**
- Not yet tested end-to-end against a live MongoDB (see README → "What I
  verified vs. couldn't verify")
- `esbuild`/Vite dev-server advisory — dev-only, doesn't affect production
  builds (see README → "Known accepted issue")
