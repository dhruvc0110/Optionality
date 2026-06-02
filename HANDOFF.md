# HANDOFF.md — How to resume

The design + build phases are done through **Layer 4 (prices-first)**. The app is **deployed and
live**. The job next session is **testing** (see `TESTING.md`), then continuing the roadmap.

---

## Read in this order
1. **`CLAUDE.md`** — operating manual + current state (auto-loaded).
2. **`MEMORY.md`** — decisions D1–D18 + session summaries (read Session 3 for what just happened).
3. **`ERRORS.md`** — gotchas hit this build (Pages setup, harness gates, CORS, flaky test clicks).
4. **`ROADMAP.md`** — layer status and what's next.
5. **`TESTING.md`** — the step-by-step L1→L4 test plan. **This is the first task next session.**

## The app, in one breath
A backend-less, installable React PWA (Primer/Reckoner/Simulator/Construct/Monitor) that teaches
options, builds & prices real trades, enforces a 15% portfolio floor (the "honesty engine"), and
monitors a portfolio — with positions saved to the user's own Google Drive and live stock prices
pulled keyless from the browser. Targets 18–24% returns with a ~15% loss floor, single user <$50k.

- **Live URL:** https://dhruvc0110.github.io/Optionality/
- **Repo:** `github.com/dhruvc0110/Optionality` (public, `main` auto-deploys via GitHub Actions)
- **Stack:** Vite + React PWA, all client-side. Google Drive (`drive.file`) for storage. No server.

## Status (detail in CLAUDE.md §6 / ROADMAP.md)
- ✅ L0 shell + educational trio · ✅ L1 Construct + pricing + Drive · ✅ L2 honesty engine +
  enforcement · ✅ L3 Monitor · ✅ L4 prices-first (live stock quotes).
- ⏳ **Untested end-to-end** — especially Google Drive sign-in and the L4 "Live price" button.
- ⬜ Deferred: broker proxy (option data/trading), alerts, push, L5 backtester.

## Repo structure (backend-less — MEMORY D15)
```
repo-root/
├── CLAUDE.md MEMORY.md ERRORS.md ROADMAP.md HANDOFF.md TESTING.md
├── .github/workflows/deploy.yml   # build Vite → deploy to GitHub Pages
├── .env.example                   # placeholder for a future L4 serverless proxy only
└── frontend/                      # the whole app
    ├── index.html  vite.config.js  package.json
    └── src/
        ├── main.jsx  global.css
        ├── OptionsPrimer.jsx       # app shell + nav + Primer/Reckoner/Simulator + ALL global CSS
        ├── construct/Construct.jsx # Construct tab: build/price + risk panel + positions
        ├── monitor/Monitor.jsx     # Monitor dashboard tab
        ├── pricing/blackScholes.js # BSM price + Greeks + implied vol
        ├── strategies/library.js   # 6 strategies, priced
        ├── risk/portfolio.js       # portfolio risk math (shared: Construct + Monitor)
        ├── data/quotes.js          # live quotes (broker-agnostic; keyless Yahoo-via-proxy)
        └── storage/googleDrive.js  # Google Drive persistence (GIS token + Drive REST)
```

## Running & deploying
- **Local dev:** `cd frontend && npm install && npm run dev` → localhost:5173 (base is `/` in dev).
- **Deploy:** committing + pushing to `main` is **pre-authorized** (D16) — it auto-builds and
  deploys to Pages in ~1–2 min. Commit author: `Dhruv Chadha <dhruv.chadha@gmail.com>` via
  `git -c user.name=… -c user.email=…` (do NOT change global git config). `.claude/` is git-ignored.
- If a push is ever blocked by the harness, surface it; don't work around it (ERRORS.md).

## First actions next session
1. **Run `TESTING.md`** L1→L4. Prioritise the two unverified flows: Google Drive sign-in/save and
   the L4 "↻ Live price" button (both need a real human tap; automation couldn't trigger them).
2. Fix whatever testing surfaces; log >2-attempt issues in `ERRORS.md`.
3. Then pick the next build: **alerts + push** (needs a scheduled function + home-screen install) or
   the **broker proxy** (option data/trading — decide Alpaca-paper→Tradier vs Tradier-only first).
   Also: swap the placeholder gold-diamond icon for the user's chosen design.

## Open questions (not blocking testing)
- Historical options-data vendor for the L5 backtester (D10) — needs a spend decision.
- Final icon / brand colours.

## Guardrails carried over (full detail in CLAUDE.md)
- The **honesty principle**: never show a return/floor number the system can't defend.
- The **15% floor is enforced at the portfolio level** by one risk layer (D4); **hard vs soft floor**
  (D6) is the core concept threaded through Construct, the honesty engine, and Monitor.
- **Confirmation gates** still apply to deletes / migrations / sending-outside-the-conversation;
  **deploying is pre-authorized** (D16). The user is non-technical — explain in plain language, offer
  decisions as multiple-choice with a recommendation.
- End every coding task with the four-part summary (changed / modified / not touched / follow-up).
