# TESTING.md — Manual Test Plan (Layers 1 → 4)

> Run this next session. Nothing below has been verified end-to-end by a human yet.
> Two flows especially need a real person in a browser: **Google Drive sign-in** and the
> **L4 "Live price" button** (test automation couldn't trigger them).

## Where to test
- **Live:** https://dhruvc0110.github.io/Optionality/ (pull-to-refresh first to get the latest).
- **Local:** `cd frontend && npm run dev` → http://localhost:5173/
- **Phone:** open the live URL; for the install test, use the phone.
- Prereq for the Drive tests: be signed into the **Google account** that set up the OAuth client.

## How to read this
Each item is **action → expected**. ✅ = pass, ✏️ = note what you saw. If something takes >2
tries to get right, jot it in `ERRORS.md`.

Reference numbers below assume the **defaults** (price $100, 90 days, vol 25%, rate 4%, account $25,000).

---

## 0. Smoke test (any tab)
- [ ] App loads on the **Primer** by default; header "Options, demystified".
- [ ] Nav shows 5 tabs — **Primer · Reckoner · Simulator · Construct · Monitor** — all visible, no
  horizontal scrolling/overflow on a phone.
- [ ] Tap through all 5 tabs; each renders.
- [ ] **Back-gesture / browser Back** moves to the *previous tab*, it does NOT exit the app.
- [ ] (Phone) Browser menu → **Add to Home Screen** → launches fullscreen (no address bar), gold
  diamond icon.

---

## Layer 1 — Construct (build & price a trade)

### 1a. Pricing & the numbers (no sign-in needed)
- [ ] Go to **Construct**. Default strategy = **Collar**, price $100.
- [ ] Confirm the **Collar** readout matches: Net credit **$34 in**, Max gain **+$1,034**, Max loss
  **−$766**, Breakeven **$99.66**, Delta **53**, Theta **+$0.8/day**, Vega **−$2.0**, Capital
  required **$9,966 (40% of $25,000)**.
- [ ] Tap **Covered Call** chip → Net credit **$189**, Max gain **$1,189**, Max loss **−$9,811**,
  Breakeven **$98.11**, **SOFT FLOOR** badge, and the amber soft-floor warning shows.
- [ ] Tap **Bull Call Spread** → it shows **DEFINED RISK**, small capital (~**$355**), and Max loss =
  the net debit.
- [ ] Drag each strike slider → the chart, legs, and all numbers update live.
- [ ] **Legs (priced)** list reads sensibly (e.g. BUY 100 shares @ $100 / BUY PUT $92 @ ~$1.55 /
  SELL CALL $110 @ ~$1.89).

### 1b. Explainers (the (i) icons + guide)
- [ ] Tap any **(i)** (e.g. on Max loss) → a plain-language note appears; tap **×** to close.
- [ ] (Desktop) **Hover** an (i) → the note previews; move away → it hides.
- [ ] Tap **(i)** on **Volatility** → note explains it's an assumption + "where to get it" (IV).
- [ ] Expand **"What am I looking at?"** → guide lists every input and output in plain language.

### 1c. How-to + calendar
- [ ] Scroll to **"How to place this trade"** → numbered steps, one per leg, with strike/expiry/premium.
- [ ] Type a ticker (e.g. `AAPL`) → the steps + earnings tip + calendar say **AAPL**.
- [ ] **"Your calendar"** shows Today (place it), a mid-life check-in, and an expiry-day row with
  strategy-specific guidance.

### 1d. Capital efficiency
- [ ] Drag **Account size** down to **$5,000** → on the Collar, "Capital required" turns **red /
  over budget** with guidance toward cheaper structures. Return it to $25,000.

### 1e. ⭐ Promote-to-live + Google Drive (THE key untested flow)
- [ ] Build a Covered Call on `AAPL`. Tap **"I placed this — track it"**.
- [ ] A Google **sign-in popup** appears → choose your account → approve the one `drive.file`
  permission (should be a normal consent, no scary "unverified app" screen).
- [ ] The trade appears under **Your positions** ("AAPL · Covered Call · …").
- [ ] In **Google Drive → My Drive → `Optionality`** there's a file **`optionality-positions.json`**.
- [ ] **Reload the page**, return to Construct, tap **Connect Google Drive** again → the position is
  still listed (persisted).
- [ ] Track a 2nd position → both saved. Tap the **×** on one → it's removed (and the Drive file updates).
- [ ] *If sign-in fails:* allow popups for the site and retry; note the exact error in `ERRORS.md`.

---

## Layer 2 — the Honesty Engine (risk, in Construct's positions area)
*(Needs at least one tracked position from 1e.)*
- [ ] With positions tracked, a **"Portfolio risk · the honesty engine"** panel shows above the list.
- [ ] **Worst case** vs the **15% floor** — value + bar + headroom/over message.
- [ ] **Soft-floor (un-guaranteed)** vs your **15% budget** — value + amber bar; drag the **soft-floor
  budget** slider and watch the over/under message flip.
- [ ] **Gap-stress** table shows portfolio P&L at −10% / −20% / −35%.
- [ ] *Sanity:* a portfolio of a cash-secured put + collar + bull-call-spread should read roughly
  **total worst ~41% / soft ~37%** of a $25k account (both over their limits).

### 2b. Build-time enforcement
- [ ] While building, the **"If tracked, soft-floor → X% / worst case → Y%"** impact line shows under
  the trade.
- [ ] Make a trade that breaks a limit (e.g. Cash-Secured Put on a $25k account, or drop account to
  $5k) → the impact box turns **red** with guidance and the button becomes **"Over your limit —
  track anyway"** (a conscious override, not a hard block).

---

## Layer 3 — Monitor dashboard
*(Needs tracked positions.)*
- [ ] Open **Monitor**. If not already connected, tap **Connect Google Drive**; else it auto-loads.
- [ ] **Health card** shows a status (Healthy / Caution / Over limit), position count, capital deployed.
- [ ] **Two gauges:** worst-case vs 15% floor, soft-floor vs budget.
- [ ] **Aggregate Greeks** (Delta / Theta / Vega) + **Net premium** (collected/paid).
- [ ] **Scenario slider** — drag "market moves X%" (−40%…+20%) → portfolio P&L + % update live; a big
  down move should hurt (esp. with soft-floor positions).
- [ ] **Positions** list — tap one → it expands with a plain-language explanation + key numbers.
- [ ] Tap **Refresh** → re-pulls from Drive (track a new one in Construct, come back, Refresh → appears).

---

## Layer 4 — live stock prices (prices-first)

### 4a. ⭐ Live price button (untested — needs a real tap)
- [ ] In **Construct**, type a real ticker (e.g. `AAPL`) → tap **"↻ Live price"**.
- [ ] Within a second or two: **Current price** updates to the real market price, the message reads
  "Live: $… USD · strikes reset around it", and the **strikes reset** to sensible values around it.
- [ ] Try `SPY` (~$700s) and a cheaper stock (e.g. `F`, ~$10) → the price input and **strike sliders
  scale** to each (no pegged/blank sliders).
- [ ] Bad ticker (e.g. `ZZZZZ`) → graceful "Couldn't fetch a live price — enter it manually." (no crash).
- [ ] *If it never fetches:* the public CORS proxy may be down/rate-limited — manual entry still
  works; note it. (See `data/quotes.js`.)

### 4b. Any-price handling
- [ ] Type a price like **306** directly into Current price → strike sliders re-range (≈ $153–$459);
  all numbers still compute.

---

## After testing
1. Log any >2-attempt issue in `ERRORS.md`.
2. Update `ROADMAP.md` statuses if anything changed.
3. Decide next build: **alerts + push** (needs a scheduled function + home-screen install) or the
   **broker proxy** (option data / trading; pick Alpaca-paper vs Tradier-only first).
