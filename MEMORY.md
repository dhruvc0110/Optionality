# MEMORY.md — Decision Log & Session History

> Read at the start of every session. After any significant decision, append an entry in the
> format below. Never contradict a logged decision without flagging it first.

---

## Decision Log

Format: **What was decided / Why / What was rejected and why.**

### D1 — Three components, built in order: Backtester → Construction → Dashboard
- **Why:** The backtester validates the strategy; without it the construction tool and dashboard
  assert returns they can't justify. It's the foundation.
- **Rejected:** Building the dashboard or construction tool first — would monitor/build a strategy
  nobody had validated.

### D2 — Trade both index ETFs and individual stocks
- **Why:** User wants both.
- **Rejected:** Index-only. Simpler and far safer for the floor (indexes gap less violently), but
  narrower than the user wants.

### D3 — Multi-strategy platform
- **Why:** User wants several approaches they can switch between.
- **Rejected:** A single refined strategy — simpler and easier to keep the floor honest, but less
  flexible.

### D4 — Enforce the 15% floor at the PORTFOLIO level via one risk layer
- **Why:** In a crash, strategy sleeves become correlated and their drawdowns stack. Per-sleeve
  limits let each position look fine while the portfolio sinks. A single governing layer sizes
  every trade and can refuse/shrink any that threatens the aggregate 15%.
- **Rejected:** Each strategy policing its own limit — fails exactly when it matters (correlated
  drawdowns).

### D5 — Allow single-stock premium selling, WITH gap-risk indication
- **Why:** User's explicit call; the higher returns live here.
- **Rejected:** Restricting single names to hedged-only structures. That's the single biggest thing
  that keeps the floor credible, but the user chose the more aggressive path knowingly.

### D6 — "Indicate risk" = hard-floor vs soft-floor + earnings calendar + gap-stress + risk-budget cap
- **Why:** A warning label is useless. Hedged positions have a *hard* floor (survives an overnight
  gap); naked short-premium has only a *soft* floor. The tool must quantify both, know earnings
  dates, stress overnight gaps, and cap total soft-floor exposure via an enforced risk budget.
- **Rejected:** A simple red/yellow/green flag — not actionable, not enforced.

### D7 — Prioritize capital-efficient structures (spreads, ETF options)
- **Why:** Under $50k, 100-share lots and contract minimums bite hard; protection costs eat a
  small account disproportionately.
- **Rejected:** Outright long options on single names as the default — too capital-hungry at this size.

### D8 — Broker-agnostic design; Alpaca paper for build/test, Tradier/tastytrade/Schwab candidates for live
- **Why:** User starts manual, migrates to API. Robinhood (no official options API, only ToS-violating
  reverse-engineered wrappers) and SoFi (no API at all) were ruled out by research.
- **Rejected:** Hard-coding one broker now — would force a rewrite on migration.

### D9 — Simulator/teaching uses payoff AT EXPIRATION
- **Why:** Standard teaching diagram; clearest for a novice.
- **Rejected:** Live mark-to-market with time decay & volatility — more realistic but a much bigger
  build; deferred to v2.

### D10 — Floor-stress backtest must reach back to 2008
- **Why:** Captures the GFC, COVID, and 2022 — the regimes where a 15% cap is genuinely tested.
- **Rejected:** A shorter 2018→now window — misses the worst stress case (2008).
- **Consequence flagged:** Deep historical *option-chain* data to 2008 is NOT available from free/
  paper APIs; needs a paid vendor (ORATS / CBOE DataShop / OptionMetrics / Polygon options history).
  Pricing/coverage to be verified before committing spend. Backtest data vendor may differ from the
  live broker.

### D19 — Primer richness overhaul, Phase A (2026-06-02)
- **What:** Made the educational surface much richer, inspired by Robinhood's primer (built our own,
  not copied). **A.1:** strategy catalog expanded 7 → **13** (added bull-put/bear-call credit
  spreads, long straddle, long strangle, iron condor, long butterfly); Reckoner now **grouped by
  job** (Income / Protection / Directional / Neutral-volatility) with a **tap-in deep-dive** per
  strategy (when-to-use, payoff chart, max gain/loss, worked example, floor, Open in Simulator); new
  strategies flow into the Simulator automatically. **A.2:** the Primer became a **sectioned learning
  path** — a section index (Foundations[11, the Harborview story] / Mechanics & the Greeks[5] / Risk &
  the floor[5] / In the real world[3]) opening into per-section lessons (reuses the lesson stepper).
- **Why:** User wanted Robinhood-level depth across content + strategies (picked all four richness
  dimensions: more strategies, deeper structured lessons, interactive, real examples/when-to-use).
- **Still to do (Phase B/C):** quizzes + progress tracking (B); glossary + polish (C).
- **Note:** all in `OptionsPrimer.jsx` (now large — extracting Learn/strategies into modules is
  future tech debt). New multi-leg teaching strategies use fixed representative premiums for the
  payoff *shape* (teaching, not live pricing).

### D18 — Layer 4 prices-first: keyless live stock quotes, brokers deferred (2026-06-01)
- **What:** Live STOCK prices via `data/quotes.js` — a broker-agnostic `getQuote()` with a keyless
  adapter (Yahoo Finance via the public `corsproxy.io`). No account, no key, no cost, no backend.
  Construct gets a "↻ Live price" button (fills price from ticker, resets strikes around it); the
  current price is now a numeric input and strike sliders scale to the price so real-priced tickers
  work (verified: AAPL ~$306 → strikes range $153–$459).
- **Why:** Cost/simplicity. The $99/mo figure that worried the user is *Alpaca's real-time options*
  add-on — NOT needed. Cost ladder: stock prices free; paper free; real-time options ~$10/mo via
  Tradier (the cheap live path), not $99; historical options data (L5) is the real paid item.
- **Deferred (decide when options/trading is actually needed):** the serverless key-proxy, the
  broker choice (Alpaca paper → Tradier live, vs simplifying to Tradier-only — user leaned "decide
  later"), real option quotes/IV, alerts, and push notifications.
- **Caveat:** keyless path depends on a public CORS proxy + Yahoo's unofficial endpoint — a graceful
  convenience (null → manual entry), not a hard dependency. Verified the data path returns live USD
  prices; the in-app fetch button works on a real tap (test automation couldn't trigger it reliably).

### D17 — Risk-budget cap set to 15% of principal (soft-floor); Layer 2 honesty engine built (2026-06-01)
- **What:** Resolves the long-open "risk-budget cap" question (D5/D6). User chose **15%** of principal
  as the soft-floor (un-guaranteed) worst-case budget — **against the assistant's recommendation of
  10%/Moderate**. It's an adjustable in-app setting (slider, default 15%), not hard-coded.
- **Assistant's flag (recorded):** 15% soft-budget against a 15% overall loss cap means nearly all
  allowed loss can be un-guaranteed; on a <$50k account that's aggressive. The risk panel makes this
  visible (it'll read "over budget" easily), which is the honest design.
- **Layer 2 built:** the honesty engine, folded into Construct's positions area (placement choice).
  Per tracked position: hard/soft classification + worst case. Portfolio: total worst-case vs the
  **15% floor**, soft-floor exposure vs the budget meter, and overnight **gap-stress** (−10/−20/−35%).
  Computed from positions **as entered, 1 contract each**, against account size — NOT live marks
  (those + earnings dates come at Layer 4). Math verified in Node.
- **Rejected:** Conservative 5% / Moderate 10% (user's call); a dedicated "Risk" tab (chose to fold
  into positions to avoid a 5th mobile tab; the dedicated dashboard is Layer 3 Monitor).

### D16 — Standing authorization to deploy without per-message confirmation (2026-06-01)
- **What:** The user granted blanket permission to deploy to GitHub (commit + push to `main` →
  auto-deploys to Pages) and to proceed with Google Drive/OAuth integration on the app side, without
  asking each time. Recorded in CLAUDE.md (overrides the old "deploy/push" hard-confirmation gate).
- **Why:** Rapid iteration; the user was tired of confirming every deploy and approved all prior ones.
- **Caveats:** (1) The harness's own auto-mode classifier may still gate a `git push` on a turn that
  lacks explicit deploy intent, and it blocked an attempt to add a settings permission rule
  (self-modification guard). The assistant must NOT work around that; if a push is blocked, surface
  it and the user can approve or add a `Bash(git push:*)` allow rule via `/update-config` themselves.
  (2) Google Cloud Console steps needing the user's account still require the user.

### D15 — Backend-less architecture (revises D12): client-side + Google Drive + GitHub Pages
- **What:** No always-on backend server. All computation (pricing, Greeks, honesty engine, risk
  math) runs **client-side in the browser**. The user's positions/data are stored in **their own
  Google Drive** via **Google OAuth (`drive.file` scope)**, mirroring the proven `FinApp` pattern
  (sibling project at `/Users/dhruv/Personal/Claude Projects/FinApp`). Deploy is **GitHub Pages**
  (React/Vite builds to static files via a CI
  step). The FastAPI skeleton scaffolded in L0 was deleted.
- **Why:** GitHub Pages (the deploy route the user chose) serves static files only — it cannot run
  the Python backend D12 assumed, so the two were incompatible. New evidence settled it: the user
  already ships `FinApp`, a 100% client-side, backend-less, GitHub-Pages, Google-Drive app they like
  and trust. For a single-user <$50k tool it's simpler, free, proven, and matches their values
  (webpage-easy, no install, no lock-in). Layers 0–3 need no secret keys, so no backend is required.
- **Revises D12:** the **React-as-PWA frontend choice stands**; only the "Python backend, built
  together" half is dropped.
- **Secret broker keys (the one thing that forced a backend) are deferred to Layer 4:** when live
  market data arrives, add a **single serverless function** (proxy) to hold the key — NOT an always-
  on server, and NOT keys-in-browser (trade-execution keys are higher-stakes than FinApp's Anthropic
  key). Backend-less-now ≠ backend-never.
- **Rejected:** Keeping the Python backend — would need a second always-on host (Render/Railway/Fly),
  more ops/cost, and couldn't live on GitHub Pages; no payoff until Layer 4+.

### D14 — Build order re-sequenced from D1's "Backtester-first" to a dependency-driven six-layer order
- **What:** New order — **L0** scaffold + mobile primer (Learn) → **L1** pricing/Greeks + strategy
  library + construction + promote-to-live (Construct) → **L2** honesty engine (hard/soft floor,
  distance-to-floor, risk budget, gap-stress) → **L3** monitor + glanceable home + explain-this-
  position → **L4** Alpaca paper live data + alerts + push notifications → **L5** backtester +
  floor-stress report → **L6** trade suggestions + Tradier live migration.
- **Why:** D1's literal order puts the most data-expensive piece (the backtester needs paid 2008
  option-chain data, D10) first and yields nothing glanceable on the phone early — clashes with the
  user's "all three surfaces equally" answer and the mobile-first PWA (D12).
- **D1's intent preserved:** No **validated-return claim** is shown until the backtester earns it.
  Until then the app displays risk/floor mechanics (which need no price history) and stays honest by
  omission. So D1 is re-sequenced, not violated.
- **Rejected:** Literal Backtester-first — long wait before a usable app, and forces an early
  paid-data-vendor spend commitment.
- **Feature scope set this pass:** All three surfaces weighted equally. Four reach features promoted
  (push alerts, glanceable health home, "explain this position", trade suggestions). **Trade
  suggestions deliberately last (L6) and reframed** as "2–3 structures that fit your floor, each
  with its trade-off shown" — never a single "do this" (honesty principle). Caveat logged: iOS
  web-push works only when the PWA is installed to the home screen (iOS 16.4+).

### D13 — Manual-phase positions are tracked by "promoting a constructed trade to live"
- **What:** Before the broker API exists, the app learns your positions not via a separate typing
  form but by letting you build a trade in the construction/simulator surface and tap "I placed
  this" to start tracking it. CSV import is a deferred later convenience.
- **Why:** Works day one (no API); reuses the construction UI you'd use anyway (near-zero extra
  build); produces clean data because the app computed the legs (no mistyped strikes/premiums) —
  protects the honesty principle; keeps all three surfaces (monitor / construct / learn) alive
  early. User confirmed they expect to use all three **roughly equally** — so no single hero
  surface; navigation weights them evenly and build order follows dependency/data-cost, not one
  dominant journey.
- **Rejected:** Dedicated manual-entry form (more to build, error-prone typing); wait-for-API
  (leaves monitoring + real-holdings construction dark until Phase 4); file import as the
  foundation (broker export formats are brittle/inconsistent — kept as a later convenience only).

### D12 — Architecture: installable PWA frontend + Python backend, built together from the start
- **⚠️ Backend half REVISED by D15 (30 May 2026): the app is now backend-less.** The React-as-PWA
  frontend below still stands; ignore the "Python backend / keys in backend" parts.
- **What:** Frontend is an **installable PWA** (works as a plain URL — no forced install, no app store, no OS lock-in; optionally pinned to the home screen, standalone/fullscreen, gesture-correct). Backend is **Python** (data, pricing, backtest, risk), built alongside the frontend rather than deferred.
- **Why:** User finds the PWA model approachable and wants webpage-easy access + scalability; chose to stand up the backend now so live broker data and backtesting arrive sooner rather than later.
- **Rejected:** (a) **Pure frontend-first PWA, backend deferred** — simplest/cheapest start, but pushes live market data out to a later phase; user wanted it sooner. (b) **Original P1 (React desktop + Python)** — desktop-shaped, not mobile/installable; superseded by this.
- **Consequence (security boundary):** Broker **secret API keys live ONLY in the backend environment**, never in the PWA bundle (frontend code is fully readable by anyone). The frontend calls the backend; the backend holds keys and talks to the broker. This is non-negotiable.
- **Frontend framework (RESOLVED 30 May 2026):** **React-as-PWA.** Reuses existing
  `OptionsPrimer.jsx` + recharts, scales for a multi-screen stateful app, deploys to the same
  static files as plain HTML (build step is invisible to the user). Rejected plain HTML/JS PWA:
  would force a rewrite of the existing component and get unwieldy as the app grows.

### D11 — Provider ramp: Alpaca paper (build/test) → Tradier Pro (live)
- **Why:** Alpaca is the best place to build (true paper trading, best Python SDK, 1,000 req/min,
  options enabled by default). Tradier is the cheapest place to go live on a small account ($10/mo
  flat, effectively commission-free, never-expiring tokens). D8's broker-agnostic design makes the
  pairing seamless.
- **Rejected:** Alpaca-only (real-time OPRA options data is a $99/mo add-on for live); Tradier-from-
  start (weaker paper trading for the build phase); tastytrade (no true paper, sandbox only);
  Schwab (no official paper API, 7-day re-auth).

---

## Proposed — NOT yet locked (confirm before relying on)

### P1 — Tech stack: Python backend + React frontend
- **Proposed because:** the data/pricing/backtest/risk work fits Python's quant ecosystem
  (alpaca-py, numpy, scipy, pandas); the primer is already React.
- **Status:** **RESOLVED by D12 (30 May 2026).** Python backend confirmed. Frontend is now a
  **PWA** (not a desktop React web app); the React-vs-plain-HTML choice for that PWA is the one
  open sub-decision noted in D12.

---

## Open questions (not blocking Phase 0)

- ~~**Risk-budget cap (drives D6):**~~ **RESOLVED (D17): 15% of principal** (soft-floor), adjustable in-app.
- **Historical options-data vendor (D10):** which vendor, at what cost, with confirmed 2008
  coverage? Needed for Phase 1 backtester.

---

## Session History

### Session 1 — 30 May 2026 (design + hand-off prep)
- **Worked on:** Problem framing, feature design across all three components, brokerage-API
  research, the options primer build, and the execution roadmap.
- **Completed:** Options Primer + Simulator (`OptionsPrimer.jsx`); `ROADMAP.md`; this hand-off
  packet (`CLAUDE.md`, `MEMORY.md`, `ERRORS.md`, `HANDOFF.md`).
- **In progress:** Nothing mid-build; clean stopping point.
- **Decisions made:** D1–D11 above (+ proposed P1).
- **Next session priorities:**
  1. Confirm the tech stack (P1).
  2. Stand up Alpaca paper API access (user creates account + paper keys; store in `.env`).
  3. Build the Phase 0 shared data layer (quotes + option chains), broker-agnostic interface,
     Alpaca adapter first. Confirm options are enabled on the paper account.
  - *(Superseded by Session 2: re-sequenced to dependency-driven layers (D14); architecture is now
    backend-less (D15); next is Layer 1, not a data layer.)*

### Session 2 — 31 May 2026 (architecture lock + Layer 0 build + first deploy)
- **Worked on:** Internalized deep-design / coding-rules / pwa-app-design; ran a multi-pass product
  design (mobile-first reframe); locked the architecture; built and **deployed Layer 0**.
- **Completed:**
  - **Decisions D12–D15:** React-as-PWA + (originally Python, later dropped) → **backend-less**;
    manual-phase positions via "promote a constructed trade to live"; build order re-sequenced into
    6 dependency-driven layers.
  - **Honesty-bug fix** in the Options Primer: max gain/loss were read off a clipped chart grid
    (understated long-put / cash-secured-put by ~2×); now computed analytically (S=0, strikes, S→∞).
  - **Layer 0 shipped:** Vite + React installable PWA (manifest, service worker, placeholder gold
    icon, mobile reflow, history-based back-gesture), reusing `frontend/src/OptionsPrimer.jsx`.
  - **Cleanup:** deleted the FastAPI skeleton (D15) and the duplicate root `OptionsPrimer.jsx` — one
    source of truth in `frontend/src/`.
  - **Deployed LIVE:** public repo `github.com/dhruvc0110/Optionality`, GitHub Actions → Pages, at
    **https://dhruvc0110.github.io/Optionality/**. Auto-redeploys on every push to `main`. `gh` CLI
    installed (NOT authenticated — pushes use the osxkeychain credential). Commit author is
    `Dhruv Chadha <dhruv.chadha@gmail.com>` (set per-commit via `git -c`, global config untouched).
- **In progress:** nothing mid-build — clean stopping point.
- **Next session priorities:**
  1. **Layer 1:** pricing/Greeks (BSM + IV) + strategy library + construction + promote-to-live +
     **Google Drive (OAuth) persistence** (mirroring FinApp).
  2. Swap the placeholder icon/colors for the user's chosen design.
  3. Still-open questions: risk-budget cap (needed for L2), historical options-data vendor (needed
     for L5 backtester).
- **Gotchas logged:** free GitHub Pages requires a **public** repo; GitHub blocks workflows from
  auto-enabling Pages on a fresh repo (enable once via Settings → Pages → Source: GitHub Actions);
  setting Vite `base` to the Pages subpath broke local dev — base is now build-only.

### Session 3 — 1 June 2026 (Layers 1–4 built + deployed; testing still owed)
- **Worked on:** Built and shipped Layers 1–4 (prices-first half), rewrote the primer, added
  in-app explainers + a "how to place this trade" guide, and set up standing auto-deploy.
- **Completed (all LIVE at https://dhruvc0110.github.io/Optionality/):**
  - **L1 — Construct:** BSM pricing+Greeks+IV engine (`pricing/blackScholes.js`, verified to textbook
    values), strategy library (`strategies/library.js`, 6 strategies priced), the **Construct** tab
    (priced legs, Greeks, max gain/loss, breakevens, hard/soft floor), capital-efficiency sizing,
    "I placed this → track it" + **Google Drive persistence** (`storage/googleDrive.js`, GIS token
    flow + Drive REST, `drive.file`; file lands in an `Optionality` folder).
  - **Primer rewrite** into a warm DIYer narrative (the "Harborview at $100" story); nav reordered
    to Primer → Reckoner → Simulator → Construct → Monitor.
  - **In-app explainers:** tap/hover (i) on every Construct number + input, an expandable "What am I
    looking at?" guide, and a "How to place this trade" step list + dated calendar.
  - **L2 — Honesty Engine** (`risk/portfolio.js`): per-position hard/soft classification, worst-case
    vs the 15% floor, soft-floor budget meter (cap **15%**, D17), gap-stress (−10/−20/−35%), AND
    build-time enforcement (pre-trade impact + "Over your limit — track anyway" override).
  - **L3 — Monitor tab:** health card, distance-to-floor gauges, aggregate Greeks + net premium,
    interactive "market moves X%" scenario, tap-to-explain positions. Shared state lifted to shell.
  - **L4 prices-first:** keyless live stock quotes (`data/quotes.js`, Yahoo via corsproxy);
    Construct "↻ Live price" + numeric price + strikes that scale to any ticker.
- **Decisions:** D16 (standing deploy auth), D17 (15% risk budget + L2), D18 (prices-first, brokers
  deferred). See Decision Log.
- **In progress / NOT done — the priority for next session:** **no end-to-end manual testing yet.**
  Specifically the two flows that need a real human + browser: (a) the **Google Drive sign-in**
  (connect → save a position → confirm `Optionality/optionality-positions.json` appears; this also
  populates the L2 risk panel and the L3 Monitor with real data), and (b) the **L4 "↻ Live price"**
  button tap (test automation couldn't trigger React onClick reliably — the data path is proven).
- **Next session priorities:**
  1. **Run the full L1→L4 test plan** (see `TESTING.md`) — especially the Drive + live-price flows.
  2. Fix anything testing surfaces; log >2-attempt issues in `ERRORS.md`.
  3. Then: alerts + push (needs a scheduled function) OR the broker proxy (option data/trading), and
     swap the placeholder icon for the user's design.
