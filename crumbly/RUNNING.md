# Running Crumbly locally (no Firebase project needed)

Requirements: Node 20.6+ and Java 11+ (for the Firebase emulators).

```bash
cp .env.example .env        # then uncomment the "Local development against the Firebase emulators" block
npm install
npm run emulators           # terminal 1: Auth, Firestore, Storage + UI at http://localhost:4000
npm run seed                # terminal 2: bakeries, products, demo users (see README for the logins)
npm run dev                 # terminal 2: API on :8080 and web on :5173
```

Open http://localhost:5173 and try the journey: browse as a guest, add to cart (sign-in prompt), check out, then sign in as the demo owner (`owner@demo.crumbly.test`) to run the bakery.

What works without any keys: browsing, accounts, cart, orders, dashboard, promotions, finances, calendar, team invites, admin.
What needs keys: Crumbly Bot (`GEMINI_API_KEY`, `GEMINI_MODEL`), address search and delivery distance (`GOOGLE_MAPS_SERVER_KEY`; without it, delivery uses a straight-line estimate), real M-Pesa (Daraja sandbox keys, and a public HTTPS tunnel for the callback).

Checks: `npm run typecheck`, `npm test`, `npm run build`. Rules tests: `firebase emulators:exec --only firestore "npm --prefix apps/api run test:rules"`.
