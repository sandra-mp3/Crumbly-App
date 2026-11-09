# Crumbly
**Quick start: see [RUNNING.md](RUNNING.md).**

(Original notes below.)
Express + TypeScript API, Firebase Auth/Firestore, Gemini behind a provider interface.

## Run
1. `cp .env.example .env` and fill in Firebase service-account values and `GEMINI_API_KEY`, `GEMINI_MODEL`.
2. `cd apps/api && npm install && npm run dev`
3. `curl -X POST localhost:8080/api/crumbly-bot/chat -H 'content-type: application/json' -d '{"message":"vegan under 600"}'`

## Design rules enforced here
- Guests can browse and use Crumbly Bot for discovery; no login wall (`attachActor` allows GUEST).
- `bakeryId` is resolved from `bakeryMembers` on the server. It is never read from request bodies or LLM tool args.
- Baker analytics tools are only offered to the model when the actor is a bakery member.
- Gemini key stays on the server; swap providers by adding a file in `src/ai/` implementing `LLMProvider`.
- `bakeryMembers` docs use id `{uid}_{bakeryId}` (the rules depend on this).

## Orders, payments, seed
- `POST /api/orders` (Idempotency-Key header required) creates one order per bakery; prices are read from Firestore.
- `POST /api/payments/mpesa/stk` starts an STK push; `POST /api/payments/mpesa/callback/:secret` is the Daraja callback (public HTTPS; secret comes from `MPESA_CALLBACK_SECRET`). Poll `GET /api/payments/status/:checkoutRequestId`.
- Callbacks are processed in a Firestore transaction keyed by CheckoutRequestID, so repeats are no-ops. A mismatched amount marks the payment failed.
- `npm run seed` creates 6 bakeries, 9 products, inventory, 120 paid demo orders and demo users
  (customer / owner / manager / staff / admin `@demo.crumbly.test`, password `CrumblyDemo#2026`, dev only).
- Needed Firestore composite indexes (create from the link Firestore prints on first failure): orders by (customerId, createdAt desc), orders by (bakeryId, createdAt desc), orders by (bakeryId, paymentStatus, createdAt), products by (status, price).

## Web app (apps/web)
React + Vite + Tailwind v4 + TanStack Query + Firebase Auth. `cd apps/web && npm install && npm run dev` (API on :8080 is proxied via `/api`).
Guests can browse, search and use Crumbly Bot. Add to cart, favourites, checkout and orders open the sign-in modal and resume the action afterwards.
Checkout creates the order (Idempotency-Key), triggers the STK push, then polls payment status until the callback confirms it.
Known gaps: delivery address uses a fixed Nairobi coordinate until Places autocomplete is wired; product images are emoji until Storage uploads exist; text search filters client-side.
- Business routes (`/api/business/*`, `/api/me`) resolve the bakery from the signed-in member. Product writes need owner/manager; inventory and orders allow staff. Extra index: orders by (bakeryId, status).

## Maps and photos
- **Google Maps:** set `GOOGLE_MAPS_SERVER_KEY` (enable *Places API (New)* and *Routes API*; restrict the key to those APIs and your server's IP). Address autocomplete, place lookup and delivery quotes run on the server, so no Maps key ships to the browser. Without a key, address search is disabled and quotes fall back to straight-line distance.
- **Delivery pricing:** KSh 100 + KSh 30/km (min KSh 150), 15 km radius, computed server-side at order creation. The client's number is never trusted.
- **Photos:** uploaded straight to Firebase Storage (`products/{bakeryId}/...`); `storage.rules` allow only that bakery's members, images under 5 MB.
- **Deploy rules/indexes:** `firebase deploy --only firestore:rules,firestore:indexes,storage` (see `firebase.json`). Combined product filters may still ask for extra indexes; Firestore prints a one-click link.
- Not built: interactive Google map widgets (BakeryMap, RoutePreview). Bakery pages link out to Google Maps for now.

## Favourites, reviews, custom cakes
- **Favourites:** `PUT/DELETE /api/favorites/:productId`, `GET /api/favorites`. Writes are API-only.
- **Reviews:** only customers with a DELIVERED order containing the product can review; one review per customer per product (editing replaces it). Product rating is recalculated in a transaction. Seed ratings are replaced by the first real review.
- **Custom cakes:** `/custom-cake` builder (Crumbly Bot drafts the form from a free-text idea via `POST /api/crumbly-bot/cake-brief`; it never sees prices or data). Bakeries quote from Business > Custom orders; accepting a quote creates a normal unpaid order, paid through the usual M-Pesa flow (also available on any unpaid order's page).

## Bakery onboarding
`/business/onboarding` is a 7-step wizard: details, location, opening hours, delivery and payout number, logo and cover, first products, publish. It resumes where the owner left off. Publishing is blocked server-side until `missingForPublish` is empty. `BAKERY_AUTO_APPROVE=true` makes bakeries live immediately; set `false` to hold them as `pending` until an admin approves (admin screen not built yet). Payout numbers are collected but settlement/payout logic is not built: customer payments currently go to the platform shortcode. Inventory is added from the Inventory page after publishing.

## Testing
```bash
cd apps/api && npm install
npm test            # unit + authorisation tests (no Firebase needed; uses an in-memory Firestore fake)
# Firestore security rules (needs the Firebase emulator), from the repo root:
firebase emulators:exec --only firestore "npm --prefix apps/api run test:rules"
```
What the suite proves:
- **Tenant isolation:** analytics tools read only the signed-in actor's bakery, ignore any `bakeryId` the model or client supplies, and refuse customers, guests and (for revenue) staff.
- **Crumbly Bot authorisation:** customers and guests are only offered public tools; a tool call the model makes outside its role is refused and leaks nothing.
- **Payments:** M-Pesa callbacks apply exactly once, reject wrong amounts, handle cancel/timeout, ignore unknown ids and never let a late success override a failure.
- **Rules (emulator):** guests browse only active data; customers read only their own orders; managers cannot read other bakeries, approve themselves or edit ratings; deactivated members lose access; nobody writes orders or payments from the browser.
Not covered yet: HTTP-level route tests (supertest), frontend tests (Vitest + Testing Library), end-to-end flows (Playwright).

## Security considerations
- **All writes go through the API.** Firestore rules are read-only for clients, so validation and authorisation cannot be bypassed from the browser.
- **Tenant isolation:** `bakeryId` is derived server-side from `bakeryMembers`; it is never read from a request body or an AI tool argument. Rules and storage rules also check the member is `active`.
- **Least privilege:** staff can run orders, custom requests and inventory; revenue, analytics, product and bakery edits need owner/manager; publishing and bakery settings are owner-only. Crumbly Bot mirrors this.
- **Crumbly Bot:** read-only tools, per-role tool lists, system prompt treats tool output as data (prompt-injection defence), model-supplied arguments are clamped and never choose the tenant. Rate limited (20/min per IP).
- **Payments:** prices and delivery fees are computed server-side; STK pushes only for the caller's own unpaid orders; callbacks are secret-path protected, amount-checked and idempotent. Daraja callbacks are not signed, so for production also restrict the callback route to Safaricom's published IP ranges at your proxy/WAF.
- **Known gaps / next hardening:** reconcile stuck payments with the Daraja transaction-status API (a callback lost during an outage currently leaves an order pending); add CSRF review if you ever move auth to cookies; add Sentry/Cloud Logging alerts; add App Check for the web client; run `npm audit` in CI; set `TRUST_PROXY_HOPS=1` behind a proxy so rate limits are per user.

## Admin area and payment reconciliation
- **Become an admin:** `cd apps/api && npm run make-admin -- you@example.com`, then sign out and back in. The ADMIN role is a Firebase custom claim that only the server can set. Demo admin: `admin@demo.crumbly.test` after seeding.
- **/admin:** platform overview and health, approve/suspend/reinstate/feature bakeries, recent orders, read-only user list, and moderation of reported reviews (removing one recalculates the product rating). Every privileged action is written to `auditLogs`.
- **Suspending a bakery** hides its published products (status `suspended`) and blocks new orders; reinstating restores them. With `BAKERY_AUTO_APPROVE=false`, new bakeries wait here as `pending`.
- **Reconcile lost payment callbacks:** set `RECONCILE_SECRET` and call `POST /api/internal/reconcile-payments` with header `x-reconcile-secret` from Cloud Scheduler every 2-5 minutes (or run `npm run reconcile`). It asks Safaricom about payments still pending after 3 minutes and applies the answer idempotently; pending past 24 hours becomes `timeout`. Query results carry no receipt number, so reconciled payments have no receipt stored.
- Not built in admin: categories management, platform promotions, disputes, AI usage dashboard, settings.

## Calendar, customers, team
- **Bake list** (`/business/calendar`, all roles): today's items totalled across open orders (the "what do I need to bake today?" screen) plus the next 7 days. Orders now carry a `neededBy` date chosen at checkout (custom cakes use their requested date); late open orders show as "Late" on today.
- **Customers** (owner/manager): spend, orders, average, last order, favourite product and segments (New, Returning, VIP, High value, Inactive) from the last 12 months. Names only, no email or phone. Customer notes are not built yet.
- **Team** (owner only): invite by email as Manager or Staff. The API returns a one-time link (valid 7 days, only a hash is stored); the invitee must sign in with the invited email. Email sending is not wired up, so the owner shares the link. Owners can change roles and remove or restore access; the owner and yourself are protected.

## Promotions and finances
- **Promotions** (owner/manager): percentage, fixed amount or free-delivery codes with start/end dates, minimum spend, optional product restriction, total-use limit and once-per-customer. Customers enter a code at checkout; a preview shows the saving, and the server recalculates it when the order is placed (inside the same transaction that counts the use, so limits and replays are safe). Codes are stored as `{bakeryId}_{CODE}`, so a bakery can only manage its own. Not built: buy-one-get-one, customer-specific offers, auto-applied deals, platform-wide promotions. Note: a limited-use code counts when the order is created, so an abandoned unpaid order still uses one.
- **Finances** (owner/manager): revenue, discounts, delivery fees, recorded expenses and **estimated** profit for 7 days, 30 days or 12 months, with a chart. Ingredients expenses stand in for cost of goods. Refunds and per-product costs are not tracked yet.
- **Loyalty is not built yet.**

## Notifications, account, SEO
- **Notifications:** in-app (bell + `/notifications`) for payment received, new paid order (bakery team), order progress, custom cake requests and quotes. Emails go through a provider interface (`src/email.ts`): set `RESEND_API_KEY` and `EMAIL_FROM` to send via Resend, otherwise emails are skipped quietly. Customers can turn emails off in Account. A failed notification never fails the action that triggered it. SMS/WhatsApp can be added as another provider later; nothing sends them yet.
- **Account** (`/account`): name, saved addresses (up to 10, usable at checkout), dietary preferences and email preference. Dietary preferences are stored but don't filter the marketplace yet.
- **SEO:** each page sets its title, description, Open Graph tags, canonical link and structured data (Product with price and rating, Bakery with location); private pages are `noindex`. `GET /sitemap.xml` is generated from live bakeries and products, and `GET /share/products/:slug` and `/share/bakeries/:slug` return small pages with Open Graph tags for link previews (the Share buttons use them). **Deployment note:** route `/sitemap.xml` and `/share/*` on your web domain to the API (a rewrite on Vercel/Firebase Hosting), and put your real domain in `apps/web/public/robots.txt`. This is a client-rendered app: Google runs JavaScript and will read the tags, but other crawlers only see the `/share` pages. Full server-side rendering is not built.
