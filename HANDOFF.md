# HANDOFF.md — Claude Code Hand-off Packet

This packet transitions the project from design (in the Claude chat app) to engineering (Claude
Code). It contains everything Claude Code needs to pick up with full context.

---

## Read in this order

1. **`CLAUDE.md`** — operating manual (purpose, rules, current state). Claude Code auto-loads it.
2. **`MEMORY.md`** — every decision made and why, plus the last session summary.
3. **`ERRORS.md`** — known dead ends (empty so far).
4. **`ROADMAP.md`** — the phased plan, status, and what's next.

## File manifest

| File | What it is |
|------|-----------|
| `CLAUDE.md` | Operating manual / always-on context |
| `MEMORY.md` | Decision log (D1–D11, P1) + session history |
| `ERRORS.md` | Failed-approach log (template, no entries yet) |
| `ROADMAP.md` | 5-phase roadmap with status and dependencies |
| `HANDOFF.md` | This file |
| `frontend/src/OptionsPrimer.jsx` | The one component built so far (React) |

## Repo structure (backend-less — see MEMORY D15)

All computation is client-side; no backend. Data lives in the user's Google Drive (OAuth). The
folders below (pricing / strategies / risk / monitor) are **client-side JS/React modules**, not a
server. A serverless proxy is added only at Layer 4 for the broker key.

```
repo-root/
├── CLAUDE.md  MEMORY.md  ERRORS.md  ROADMAP.md  HANDOFF.md
├── .github/workflows/    # CI: build Vite → deploy to GitHub Pages
├── frontend/             # React + Vite PWA (the whole app)
│   ├── public/icon.svg   # app icon (placeholder)
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── OptionsPrimer.jsx   # done
│       ├── pricing/      # L1: Black-Scholes-Merton + Greeks (client-side)
│       ├── strategies/   # L1: collar, put-spread collar, covered call, defined-risk spread
│       ├── risk/         # L2: portfolio honesty engine (the floor-enforcing spine)
│       ├── storage/      # L1: Google Drive (OAuth) persistence
│       └── monitor/      # L3: P&L/Greeks aggregation, gauges, alerts
└── (serverless proxy + backtester data: added at L4 / L5)
```

## First actions in Claude Code

1. **Confirm the tech stack** (MEMORY P1: Python backend + React frontend) before writing backend code.
2. **Set up Alpaca paper access** — *the user* creates their own Alpaca account and generates
   **paper** API keys, then puts them in a git-ignored `.env`. Claude Code must never create the
   account, handle the raw credentials in chat, or hardcode keys. Confirm options are enabled on
   the paper account.
3. **Build Phase 0 — the shared data layer:** a broker-agnostic interface returning quotes and
   option chains, with the Alpaca paper adapter as the first implementation. This sets the data
   shape every downstream component consumes, so get it right before moving on.

## Guardrails carried over (full detail in CLAUDE.md)

- The **honesty principle**: never show a return/floor number the system can't defend.
- The **floor is enforced at the portfolio level** by one risk layer (D4) — design toward this even
  in early phases.
- **Hard floor vs soft floor** (D6) is the core risk concept; thread it through data, risk, and UI.
- Respect all **confirmation gates** (deletes, external API calls with side effects, deploys).
- End every coding task with the four-part summary (changed / modified / not touched / follow-up).
