# Wayfarer — an AI travel advisor

Wayfarer is a full-stack, AI-native take on the travel review site. It reads thousands of reviews so you don't have to, plans geographically sensible itineraries, and answers questions through a travel concierge. That concierge only recommends places that exist in its database.

- **32 destinations** in 29 countries, **896 places** (hotels, restaurants, attractions, experiences), **~18,000 reviews**, and a demo community of contributors
- Real landmarks with **Wikipedia extracts, coordinates and freely-licensed Wikimedia photos** (with credits)
- **Live weather** (Open-Meteo), **3-year climate normals**, **live exchange rates**, **OpenStreetMap** maps
- Works **fully offline from AI providers**: every AI feature has a Claude implementation *and* a built-in local engine

---

## Quick start

```bash
npm install
npm run dev
```

Open the URL that Next.js prints (normally http://localhost:3000). The SQLite database seeds itself on first run, which takes about 5 seconds.

**Demo account:** click **"Explore with the demo account"** on the sign-in page, or sign in with `demo@wayfarer.travel` / `wayfarer-demo`. The demo account comes with pre-built trips and saved places. (It is a normal user; grant `UPDATE users SET role='admin'` in SQLite yourself if you want the moderation dashboard.)

Requirements: Node.js 20.9+ (tested on Node 24).

### Turn on Claude (optional)

```bash
cp .env.example .env.local
# then set ANTHROPIC_API_KEY=sk-ant-...
```

Restart `npm run dev`. The footer and `/about` show which AI engine is active. Settings:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Enables Claude for all AI features |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Model used for every AI call |
| `AI_PROVIDER` | `auto` | `auto` (Claude if a key is set), `claude`, or `local` |
| `DATABASE_PATH` | `./data/wayfarer.db` | SQLite file location |
| `SITE_URL` | `http://localhost:3000` | Absolute URLs in `sitemap.xml` / `robots.txt` |
| `COOKIE_SECURE` | `false` | Set `true` when serving over HTTPS (also enables HSTS) |
| `APP_SECRET` | auto-generated | HMAC secret for signed partner click-out links |
| `PAYMENTS_MODE` | `demo` (`live` when `NODE_ENV=production`) | `demo` activates plans without payment; `live` disables demo checkout |
| `DEMO_MODE` | `true` (`false` when `NODE_ENV=production`) | Shows listing verification codes on screen; set `true` to re-enable in production |
| `AI_COST_INPUT_PER_MTOK` / `AI_COST_OUTPUT_PER_MTOK` | `4` / `20` | Token prices for the AI-cost estimate on the revenue dashboard |

---

## Features

### Discover
- **Home**: an AI hero search, trending destinations, a "Where to go next month" list ranked by climate, Travelers' Choice picks, hidden gems, community reviews, shared trip ideas and recently viewed places.
- **Destination hubs**: a gallery, an AI travel brief, key facts (local time, currency, plugs, safety), a live 7-day forecast, a climate chart with the best months highlighted, an event calendar, a filterable map, a budget calculator with live currency conversion, flight time and CO₂ from your home city, neighbourhoods, dishes, insider tips, etiquette, and a phrasebook with text-to-speech.
- **Listings** (hotels, restaurants, things to do, experiences): filters for price, rating, category, amenities and tags, a synced list and map, and Bayesian rankings that stop a few glowing reviews from gaming the list.
- **Place pages**: a gallery with photo credits, awards, rankings, an **AI review summary** (pros and cons, aspect scores, who it's best for, quotes), rating and sub-rating breakdowns, and full-text-searchable reviews with filters for rating, trip type, season, language and photos. Also AI-answered **Q&A**, an estimated **seasonal price calendar** for hotels, nearby places and similar places.
- **Smart search**: natural-language queries such as "quiet boutique hotel with a view in Lisbon under $300" are turned into structured filters, which relax gracefully when nothing matches exactly.
- **Explore map**: destination bubbles that turn into individual places as you zoom in, with type and rating filters and a synced list of what's in view.
- **Interface languages**: English and Russian, switched from the header (stored in a `wf_locale` cookie, `Accept-Language` ignored on purpose). Chrome — header, nav, footer, home, auth, 404, cookie banner — is translated; user-generated content and long inner pages stay English.

### Plan
- **AI trip planner**: k-means clustering by neighbourhood with 2-opt routing, meals at sensible times, weather-aware day swaps (indoor sights go on rainy days), day trips, hotel selection by budget and location, cost estimates, and live progress streaming.
- **Trip editor**: drag-and-drop between days (plus keyboard-friendly move buttons), inline editing of times and notes, **one-click route optimisation**, add-place search, a map with per-day routes, a smart **packing list** (based on climate, activities, customs and plug type), a budget view, notes, **public share links**, **.ics calendar export**, duplicate and print.
- **Travel concierge**: a streaming chat with rich cards (places, destinations, itineraries, weather), follow-up suggestions, voice input, read-aloud, a floating widget on every page (`Ctrl/⌘ K`) and a full-screen `/concierge` page.
- **Destination matcher**: a six-step quiz that ranks every destination by season, climate normals, budget, vibe, flight time and deal-breakers, and explains each match.
- **Compare**: side-by-side tables with the best value in each row highlighted, plus an AI verdict.
- **Travel tools**: a currency converter, world clock, packing-list generator, flight CO₂ calculator, and a plugs and tipping table.

### Community & trust
- Accounts with scrypt-hashed passwords and hashed session tokens, profiles with a **travel map**, contributor **levels, points and badges**, and a leaderboard.
- **Write a review**: star and sub-ratings, photo upload (compressed in the browser, checked by magic bytes on the server), and an **AI writing assistant** that drafts from rough notes, polishes text, suggests titles and gives live quality coaching, including a warning when the star rating doesn't match the tone.
- **Review authenticity model**: every review gets a 0–100 trust score. Low-trust reviews are held for moderation and excluded from ratings.
- **Admin dashboard**: site stats, reviews per month, AI usage by feature and engine, and a moderation queue for approving or removing reviews.
- Helpful votes, reports, owner responses, translations of foreign-language reviews, saved places, and wishlist maps.


---

## Business model

Wayfarer earns money when travelers book, when partners pay for clicks, and when businesses choose paid tools. Rankings, review moderation and AI answers are never for sale. Every stream below works end to end in the app; payments run in **demo mode**, so no card is ever requested or charged.

| Stream | How it works | Where it lives |
|---|---|---|
| **Hotel partner clicks (CPC)** | Hotel pages compare prices from four booking partners, sorted by price only. Each click goes through a signed `/go/:token` link, earns a per-click fee, and lands on a hand-off page (the partners are fictional). Repeat clicks within 30 minutes are free, as basic click-fraud protection. | `components/commerce/HotelOffers.tsx`, `app/go/[token]`, `lib/data/commerce.ts` |
| **Booking commissions** | Travelers can book experiences and tickets ("reserve now, pay later", 8% commission) and reserve restaurant tables ($1.50 per guest). Bookings can be added to a trip, appear in **My bookings**, and can be cancelled free up to 24 hours before. | `components/commerce/BookingWidget.tsx`, `app/bookings`, `app/api/bookings` |
| **Sponsored listings** | Businesses pay per click for one clearly labelled slot on city listing and search pages. Slots are ranked by bid × rating; only places rated 3.5★+ can advertise; the daily budget is enforced; Plus members don't see them. Ads never reach the AI. | `pickSponsored` / `chargeSponsoredClick` in `lib/data/business.ts`, `components/commerce/SponsoredCard.tsx`, `app/go/ad/[id]` |
| **Business subscriptions** | Owners claim and verify their listing for free. **Business Insights** ($79/mo) adds 90-day analytics, AI review insights, AI-drafted owner replies, a commission-free Book Direct link and a pinned announcement. **Business Pro** ($199/mo) adds a competitor benchmark against the city's top 10 and an AI action plan. | `app/business/*`, `app/api/business/*`, `lib/ai/local/owner.ts` |
| **Wayfarer Plus** | $5.99/mo or $47.99/yr. Unlimited AI planning (free accounts get 5 plans a month and 40 concierge messages a day; anonymous visitors get 2 plans a day), hotel price-drop alerts, GPX export, and no sponsored listings. | `lib/plans.ts`, `lib/data/billing.ts`, `app/pricing`, `app/checkout`, `app/account/billing` |
| **API & data** | A public REST API (`/api/v1/*`) with hashed API keys and monthly metering. Developer: 1,000 calls free. Growth: $299/mo for 100k calls and the AI review-insights endpoint. | `app/developers`, `app/api/v1/*`, `lib/data/apikeys.ts`, `lib/public-api.ts` |

Supporting pieces:
- **Admin revenue dashboard** (`/admin/revenue`): revenue by stream per day, run-rate, MRR by product, Plus sign-ups and churn, the click → booking funnel, top-earning places, partner split, and estimated AI cost compared with revenue.
- **Notifications:** a header bell for booking confirmations, price drops, owner replies, answers to your questions, moderation outcomes and billing events.
- **Trust and compliance pages:** [How we make money](/how-we-make-money), a live [Trust & transparency report](/trust), and policy templates for terms, privacy, cookies, review guidelines, AI transparency, and business & advertising terms (`lib/content/legal.ts`). There is also a privacy-first cookie banner: "Essential only" is as prominent as "Allow", and partner clicks are linked to an account only with consent.
- **Demo data:** about 33 Plus subscribers, 89 claimed businesses (with tiers, invoices and 24 ad campaigns), 30 API keys, and 90 days of traffic, click-outs and bookings, so every dashboard has history. The demo account manages **Hotel Cortiça Belém** (Business Insights, with an active campaign) and a Lisbon restaurant, and has two bookings on its Paris trip.

**Try it:** sign in as the demo user and then:
1. Open `/pricing` → upgrade to Plus at checkout.
2. On a hotel page, use **Compare prices** → click a deal, then **Track price**.
3. Book a tour on an experience page.
4. Open `/business/dashboard` → reply to a review with an AI draft, or launch a campaign.
5. Open `/admin/revenue`.
6. Create an API key on `/developers` and call:
   ```bash
   curl -H "Authorization: Bearer <key>" localhost:3000/api/v1/places?destination=lisbon
   ```

The full business plan covers market sizing, unit economics, competition, go-to-market, regulation, risks, a five-year financial model and a roadmap: [Wayfarer Business Plan](https://claude.ai/code/artifact/cdee56c1-4b80-43ae-8ed7-1d2f30944d84). It is private until its owner shares it.

---

## How the AI works

Every feature goes through `withAi(feature, claudeFn, localFn)` (in `lib/ai/claude.ts`):

| Feature | Claude path | Local engine |
|---|---|---|
| Concierge | Streaming tool use (7 tools: search places, destination info, weather, plan trip, recommend destinations, place details, currency) | Intent detection plus the same tools |
| Planner | Structured output over 70+ candidate places, anchored by the routing engine's draft; place IDs are validated and costs recomputed on the server | Clustering, routing, meal slotting, weather swaps |
| Review summary | Structured headline, pros/cons and quotes (quotes are verified against real review IDs) | Aspect detection and lexicon sentiment over every sentence |
| Smart search, Q&A, review assistant, compare, translation, destination brief | Structured outputs or short text | Rules, retrieval and templates |
| Owner replies (business) | Short text grounded in the review | Aspect and sentiment detection with reply templates |

Implementation notes:
- Uses `@anthropic-ai/sdk` with the default model `claude-opus-5-5`. Requests opt into server-side refusal fallbacks (`fallbacks: "default"`) and set a per-feature `effort` level.
- Structured outputs are validated with Zod. Failures, authentication errors and rate limits fall back to the local engine; authentication failures also trip a 10-minute circuit breaker.
- Tool inputs are schema-validated before they run. `eager_input_streaming` is sent only to the first-party API.
- AI results are cached in SQLite (`ai_cache`) and every call is logged to `ai_events`, which the admin dashboard displays.

**Testing the Claude code paths without a key:**
```bash
node scripts/mock-anthropic.mjs     # a mock Messages API on :4010
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:4010 npx tsx scripts/test-claude-paths.ts
```
The test script runs against a temporary copy of the database.

---

## Deployment

```bash
docker build -t wayfarer .
docker run -p 3000:3000 -v wayfarer-data:/data -e COOKIE_SECURE=true -e APP_SECRET=change-me-please wayfarer
```

- The image runs `next start`. The database lives on the `/data` volume and seeds itself on first boot.
- `GET /api/health` is the liveness/readiness probe, and the image's `HEALTHCHECK` uses it.
- Production responses send a Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a Permissions-Policy. HSTS is added when `COOKIE_SECURE=true`.
- Anonymous AI quotas use the client IP from `X-Forwarded-For`, so run behind a proxy that overwrites that header.
- The Dockerfile hasn't been built yet in this environment because the Docker daemon wasn't running.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server (webpack) |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | Seeds the database if it's empty or outdated |
| `npm run db:reset` | Wipes the database and seeds it again |
| `npm run data:fetch` | Re-fetches Wikipedia, Commons and climate data into `data/generated/media.json` (cached and incremental) |

> **Why webpack?** Turbopack needs symlinks and junctions, which some drives (for example exFAT) don't support. `scripts/run-next.cjs` launches Next with a small compatibility shim (`scripts/fs-compat.cjs`) so the project builds on any filesystem.

---

## Architecture

```
app/                    Next.js 16 App Router pages + API route handlers
  api/                  auth, AI (chat, plan, summary, qa, review-assist, compare, translate, packing),
                        reviews, trips, saves, questions, uploads, weather, currency, match, admin
components/             UI (chat, planner, trips, place, destination, map, review, …)
lib/
  ai/claude.ts          Claude client, structured-output helpers, fallback + circuit breaker
  ai/concierge.ts       streaming tool-use loop + local concierge
  ai/tools.ts           tool schemas & implementations shared by both engines
  ai/features.ts        planner, summaries, Q&A, search interpretation, writing assistant, compare, owner replies, …
  ai/local/*            local engine: planner, NLU, sentiment, summarizer, trust, packing, matcher, writer
  data/*                SQLite queries (better-sqlite3, FTS5 full-text search)
  data/billing.ts       plans, subscriptions, invoices, AI quotas (demo payments)
  data/commerce.ts      hotel offers, click-outs, bookings, price alerts, analytics counters
  data/business.ts      claims, owner replies, analytics, benchmarks, sponsored campaigns
  data/revenue.ts       revenue, MRR, funnel and AI-cost queries for the admin dashboard
  plans.ts              prices, quotas, tiers, partners and commission rates (one source of truth)
  content/legal.ts      policy templates
  seed/*                deterministic seeding: places, reviews, users, Q&A, demo trips
  services/*            Open-Meteo weather, exchange rates
data/
  source/               hand-written destination guides + review language bank (JSON)
  generated/media.json  Wikipedia extracts, coordinates, photo metadata, climate normals
scripts/                data fetch, seeding, mock API, Next launcher
```

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, better-sqlite3 (with FTS5), Leaflet, Zod, lucide icons, and the Anthropic SDK.

---

## Data, licences & disclaimer

- **All hotels, restaurants, tours, users and reviews are fictional sample data** generated for this demo. Any resemblance to real businesses is coincidental. Real landmarks are included for realism, but their reviews are synthetic too.
- Landmark extracts come from **Wikipedia** (CC BY-SA 4.0). Photos come from **Wikimedia Commons**, with the author and licence shown on each image. Hotel and restaurant photos are illustrative pictures from Commons' *Quality images* category, not photos of the fictional venues.
- Weather and climate data: **Open-Meteo** (CC BY 4.0). Maps: © **OpenStreetMap** contributors. Exchange rates: **open.er-api.com**.
