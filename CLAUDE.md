# CLAUDE.md — Operating Manual

> Claude Code reads this file first, every session. It is the source of truth for how to
> work on this project. Read `MEMORY.md`, `ERRORS.md`, and `ROADMAP.md` immediately after this.

---

## 1. What this project is

A tool that **constructs, backtests, and monitors** a multi-strategy portfolio of stocks and
options. It **targets** 18–24% annualized returns while holding portfolio losses near a **15%
cap**, for a single user running **under $50k** of capital.

### The honesty principle (governs every feature — do not violate)

18–24% with a 15% floor is a **target, not a guarantee**. Protection costs return; return-boosting
(premium selling, concentration) widens downside. The tool must always show the trade-off and the
conditions under which the floor *holds* vs *breaks*. **Never display a confident number the system
cannot defend.** When a target is unreachable in current conditions, the tool says so.

---

## 2. Who you're working with

A **business user with no coding experience.** Make technology calls in plain language. When you
need a decision from them, present it as a **multiple-choice question** (clear options + your
recommendation), never as open-ended jargon.

---

## 3. How to work here (the rules — non-negotiable)

**Communication**
- No filler openers ("Great question!", "Certainly!"). Start with the answer.
- Match length to complexity. No padding, no restating the question.
- Disagree honestly when warranted. Come back with answers, not just questions.
- Flag uncertainty explicitly. Never fill knowledge gaps with plausible-sounding guesses.

**Before significant work**
- Show 2–3 approaches and wait for a choice before proceeding.
- For architecture / perf / data-model / long-term decisions: reason step-by-step first, surface
  trade-offs and assumptions that won't hold at scale, *then* recommend.
- Ask, don't assume. Any unstated structural pattern = at least Medium Ambiguity → confirm first.
- Simplest solution first. No abstractions or flexibility that weren't requested.

**While editing**
- Only touch files/functions/lines directly related to the task. Never refactor, rename, or
  "improve" anything unasked. Note it at the end instead.
- Before rewriting/removing content already created: stop, describe the change, wait for confirmation.

**Hard confirmation gates (must hear "yes" in the current message)**
- Deleting files, overwriting code, dropping data, removing dependencies.
- Deploying/pushing, running migrations/schema changes, any external API call with side effects.
- Sending/posting/sharing/scheduling anything outside the conversation.
- "You mentioned this earlier" is **not** confirmation.

**After any coding task, end with:**
`Files changed` / `What was modified` (one line each) / `Files intentionally not touched` / `Follow-up needed`.

### The 4 invariables — answer these before writing non-trivial code
| Question | Maps to | Why |
|----------|---------|-----|
| Where does state live? | Ownership & truth | Consistency, blast radius |
| Where does feedback live? | Observability | Debugging, monitoring |
| What breaks if I delete this? | Coupling & fragility | Safe refactoring |
| When does timing work? | Async & ordering | Race conditions, correctness |

If state ownership, blast radius, timing, security, or pattern-fit is unclear on non-trivial work
→ flag and ask, or defer explicitly.

---

## 4. Session protocol

- **Start of session:** read `MEMORY.md` (decisions + last summary), `ERRORS.md` (known dead ends),
  `ROADMAP.md` (what's next). Never contradict a logged decision without flagging it first.
- **After any significant decision:** append to `MEMORY.md` — *What was decided / Why / What was
  rejected and why.*
- **When an approach takes >2 attempts:** log it in `ERRORS.md` — *What didn't work / What worked
  instead / Note for next time.* Check `ERRORS.md` before trying similar tasks.
- **On "session end" / "wrapping up":** write a summary to `MEMORY.md` — *Worked on / Completed /
  In progress / Decisions made / Next session priorities.*

---

## 5. Tech stack

**LOCKED:** Provider ramp — build/test on **Alpaca paper**, go live on **Tradier Pro**. Data layer
must be written **broker-agnostic** so Tradier slots in without a rewrite. (See MEMORY D8, D11.)

**LOCKED (D15, revises D12): backend-less.** An **installable React PWA**, all computation
**client-side** (pricing, Greeks, honesty engine, risk math). The user's positions/data live in
**their own Google Drive** via **Google OAuth (`drive.file`)**, mirroring the proven `FinApp` app.
Deploy is **GitHub Pages** (Vite builds to static files via CI). The PWA works as a plain URL (no
forced install, no OS lock-in) and pins to the home screen (standalone, fullscreen, gesture-
correct). No always-on server.

**Security:** No secret keys exist in Layers 0–3 (just math + the user's own Drive). When live
broker data arrives (**Layer 4**), add a **single serverless function** to hold the broker key —
never put trade-execution keys in the PWA bundle (frontend code is fully readable). The **user
creates their own Alpaca/broker account and keys** — do not create accounts or handle their
credentials. (D15.)

---

## 6. Current state

- ✅ **Options Primer + Simulator** (`frontend/src/OptionsPrimer.jsx`) — educational page, three
  sections (Reckoner / Primer / Simulator), payoff-at-expiration engine. Introduces the
  hard-floor vs soft-floor concept the whole tool depends on.
- ⬜ **Everything else** — see `ROADMAP.md`. Next up: **Phase 0 shared data layer** on Alpaca paper.

---

## 7. Document map

| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file — operating manual |
| `MEMORY.md` | Decision log + session summaries |
| `ERRORS.md` | Failed-approach log |
| `ROADMAP.md` | Phased plan, status, dependencies, deferred items |
| `HANDOFF.md` | Packet orientation + setup steps |
| `frontend/src/OptionsPrimer.jsx` | The one component built so far |
