# Execution Roadmap — Risk-Hedged Options Portfolio Tool

*Living document. Update status each session. Last updated: 30 May 2026 (D12–D14: PWA + Python
stack, manual-phase positions, dependency-driven re-sequence).*

---

## What we're building (one line)

A tool that constructs, backtests, and monitors a multi-strategy portfolio of stocks and
options, **targeting** 18–24% annualized returns while holding portfolio losses near a 15%
cap — and being honest about when that target is reachable and when it isn't.

## The honesty principle (non-negotiable, governs every feature)

18–24% with a 15% floor is a **target, not a guarantee**. The two goals pull against each
other: protection costs return, and return-boosting (premium selling, concentration) widens
downside. Every screen shows the trade-off and the conditions under which the floor *holds*
versus *breaks*. The tool never displays a confident number it can't defend.

---

## Design decisions locked so far

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| D1 | Three components: Backtester → Construction → Dashboard | Backtester validates; without it the others assert returns they can't justify | Building dashboard/construction first |
| D2 | Mixed underlyings: index ETFs **and** individual stocks | User wants both | Index-only (simpler, safer floor) |
| D3 | Multi-strategy platform | User wants several approaches | Single refined strategy |
| D4 | **Floor enforced at portfolio level by one risk layer**, not per-strategy | Correlated drawdowns stack; per-sleeve limits let the portfolio sink while each looks fine | Each strategy polices its own limit |
| D5 | Single-stock premium selling **allowed, with gap-risk indication** | User's call; juicy returns live here | Restrict single names to hedged-only |
| D6 | "Indicate risk" = hard-floor vs soft-floor + earnings calendar + gap-stress + risk-budget cap | A warning label is useless; this is quantified and enforced | Simple red/yellow/green flag |
| D7 | Capital-efficient structures (spreads, ETF options) prioritized | Under $50k; 100-share lots and contract minimums bite | Outright long options on single names |
| D8 | Broker-agnostic design; Alpaca paper for build/test, Tradier/tastytrade/Schwab for live | Manual-first then API migration; Robinhood/SoFi ruled out (no official options API) | Hard-coding one broker now |
| D9 | Simulator/teaching uses payoff **at expiration** | Standard, clearer for a novice | Live mark-to-market with time decay (deferred) |
| D10 | Floor-stress backtest must reach back to **2008** | Captures GFC, COVID, and 2022 — the regimes where a 15% cap is truly tested | Shorter 2018→now window |
| D11 | Provider ramp: **Alpaca paper (build/test) → Tradier Pro (live)** | Alpaca is the best place to build (true paper, best SDK); Tradier the cheapest to go live ($10/mo, ~commission-free) | Alpaca-only, Tradier-from-start, tastytrade (no true paper) |
| D12 | **Installable PWA frontend + Python backend, built together; React-as-PWA** | User finds PWA approachable; wants webpage-easy access (no forced install, no OS lock-in) + scalability; backend now so live data/backtest arrive sooner. Secret keys live ONLY in backend | Pure frontend-first PWA (defers live data); original React-desktop P1; plain HTML/JS PWA (rewrite + unwieldy) |
| D13 | **Manual-phase positions tracked via "promote a constructed trade to live"** | Works day one (no API), reuses construction UI, clean data, keeps all three surfaces alive early | Dedicated manual form (error-prone); wait-for-API (surfaces dark); file import (brittle — deferred convenience) |
| D14 | **Build order re-sequenced to dependency-driven 6 layers** (was D1 Backtester-first) | D1's literal order forces the most data-expensive piece first and yields nothing glanceable early; clashes with "all three equally" + mobile PWA. D1's *intent* kept: no validated-return claim until the backtester earns it | Literal Backtester-first (long wait; early vendor spend) |
| D15 | **Backend-less** (revises D12): client-side compute + Google Drive (OAuth) storage + GitHub Pages | GitHub Pages can't run a Python backend; user's proven `FinApp` is backend-less and fits their values. Layers 0–3 need no secret keys. Broker key deferred to a serverless proxy at L4 | Keeping the Python backend (second always-on host, more ops, no payoff until L4+) |

---

## Roadmap — dependency-driven layers (re-sequenced per D14)

**Status:** ✅ Done · 🔨 In progress · ⬜ Not started · ⏸ Deferred (v2)

> Order follows dependencies, not the old Backtester-first phasing. D1's intent is preserved:
> **no validated-return claim is displayed until the backtester (L5) earns it.** Until then the app
> shows risk/floor mechanics (no price history needed) and stays honest by omission.
> Surfaces: **Learn / Construct / Monitor** are weighted equally (user's call).

### Layer 0 — Scaffold + Learn surface

| Item | Status | Depends on | Notes |
|------|--------|-----------|-------|
| Installable PWA shell (standalone, fullscreen, SVG icon + bg, back-gesture = previous screen) | ✅ | D12 | vite-plugin-pwa manifest + service worker; back-gesture via history/popstate. Icon is a themed placeholder (swap on request) |
| Repo structure (frontend/ React-PWA + Vite) | ✅ | D12, D15 | Vite + React frontend, `.gitignore`. Backend-less (D15) — FastAPI skeleton removed |
| Mobile reflow of Options Primer + Simulator | ✅ | existing `OptionsPrimer.jsx` | Verified at 375×812: cards + chart stack, no console errors |

### Layer 1 — Construct surface (positions begin to exist)

| Item | Status | Depends on | Notes |
|------|--------|-----------|-------|
| Options pricing + Greeks model (BSM + IV) | ⬜ | L0 | Real model w/ time + vol; bigger than the primer's expiry-only engine |
| Strategy library (collar, put-spread collar, covered call, defined-risk spread) | ⬜ | pricing | Builds on primer's strategy defs |
| Capital-efficiency sizing for a small account (lots, minimums) | ⬜ | strategy lib | D7 |
| Return-vs-floor trade-off display at build time | ⬜ | strategy lib | Surfaces the choice as you construct |
| "Promote to live" — constructed trade becomes a tracked position | ⬜ | strategy lib | D13 — the manual-phase data path |
| Persistence — store positions in the user's Google Drive (OAuth) | ⬜ | promote-to-live | D15 — mirrors FinApp; free multi-device sync, no backend |

### Layer 2 — The Honesty Engine (the spine)

| Item | Status | Depends on | Notes |
|------|--------|-----------|-------|
| **Portfolio risk layer** (sizing authority, floor enforcement) | ⬜ | L1 | D4 — has power to shrink/refuse any trade |
| Hard-floor vs soft-floor classification per position | ⬜ | risk layer | D6 |
| Portfolio distance-to-floor (one number, right now) | ⬜ | risk layer | |
| Risk-budget meter (total soft-floor exposure vs chosen cap) | ⬜ | risk layer | D5/D6 — needs the open-question cap value |
| Overnight gap-stress | ⬜ | risk layer | D6 |
| Earnings-calendar awareness | ⬜ | risk layer | D6 |

### Layer 3 — Monitor surface (+ two delight features)

| Item | Status | Depends on | Notes |
|------|--------|-----------|-------|
| Portfolio P&L + aggregate Greeks (manual-refresh first) | ⬜ | L2 | |
| Distance-to-floor gauge (hard + soft readings) | ⬜ | L2 | |
| Glanceable health "home" card | ⬜ | aggregation | Delight — one look on open |
| Scenario panel ("market drops 10% tomorrow") | ⬜ | pricing + L2 | |
| "Explain this position" (tap holding → primer explains that structure) | ⬜ | L1 + primer | Delight — cheap once inputs exist |

### Layer 4 — Live data + the phone's killer feature

| Item | Status | Depends on | Notes |
|------|--------|-----------|-------|
| Serverless proxy (holds broker key) + broker-agnostic data interface + Alpaca paper adapter | ⬜ | D8, D11, L3 | D15 — a single cloud function holds the key; not an always-on server, not keys-in-browser |
| Alerts (floor-breach risk, expiry, assignment risk) | ⬜ | live data | |
| Push notifications | ⬜ | alerts + install | iOS web-push needs home-screen install (16.4+) |

### Layer 5 — Backtester (unlocks validated-return claims)

| Item | Status | Depends on | Notes |
|------|--------|-----------|-------|
| Historical data ingestion (prices + chains) | ⬜ | **paid options-data vendor (D10)** | Independent track — gated on a spend decision |
| Realistic fill model + assignment / early-exercise modeling | ⬜ | ingestion | Critical for honest short-premium results |
| Strategy execution against history | ⬜ | above | |
| **Floor-stress report** (did 15% hold in '08/'20/'22?) | ⬜ | execution | The headline honesty check |
| Risk/return stats (drawdown, tail risk) + feasibility verdict | ⬜ | execution + L2 | Honest red light: "target unreachable now" |

### Layer 6 — Maturity

| Item | Status | Depends on | Notes |
|------|--------|-----------|-------|
| Trade suggestions ("2–3 structures that fit your floor, each with its trade-off") | ⬜ | mature L2 | Never a single "do this" — honesty principle |
| Live migration (Tradier Pro; tastytrade / Schwab candidates) | ⬜ | proven paper (L4) | Mind Schwab's 7-day re-auth; tastytrade has no paper |

### Deferred to v2 (explicitly parked)

| Item | Reason parked |
|------|---------------|
| Monte Carlo path simulation | Useful, not foundational |
| Regime tagging (bull/bear/high-vol) | Refinement |
| IV-rank entry-timing filter | Refinement |
| Mark-to-market pricing w/ time decay in simulator | Bigger build; expiry payoffs teach the concept first |

---

## Next up

**Layer 0 — scaffold + Learn surface.** Stand up the repo (Python backend skeleton + React-PWA
frontend), build the installable PWA shell (standalone/fullscreen, SVG icon + chosen background,
back-gesture = previous screen), and reflow the existing Options Primer + Simulator for mobile.
Alpaca paper access is no longer the first step — live data is now Layer 4 (D14); the user can
create their paper account in parallel, but nothing early blocks on it.

## Open questions to resolve before later phases

- Risk-budget cap: what total *soft-floor* (un-guaranteed) exposure are you willing to carry, as
  a % of principal? (Drives D6 enforcement.)
- ~~Backtest history depth~~ → **Resolved (D10): back to 2008.**

## ⚠️ Data-sourcing note (flagged, needs a decision in Phase 0)

D10 has a real cost I want to be upfront about: **free/paper APIs (Alpaca, Tradier sandbox)
generally do not provide historical *option-chain* data going back to 2008** — they're built for
live/recent data. A floor-stress backtest to 2008 will almost certainly require a **paid
historical options-data vendor** (e.g., ORATS, CBOE DataShop, OptionMetrics, or Polygon.io's
options history). Equity price history to 2008 is cheap/free; deep *options* history is not.

I'm fairly confident about this direction but not certain of each vendor's exact 2008 coverage and
current pricing — I'd verify before we commit spend. Implication: the live-trading broker (D8) and
the historical-backtest data vendor may be **two different providers**. We can still develop
everything else on free paper data and plug the historical vendor in only for the backtester.
