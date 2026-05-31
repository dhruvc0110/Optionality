import React, { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Coins,
  Layers,
  ArrowRight,
  ArrowLeft,
  Map as MapIcon,
  BookOpen,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";

/* ----------------------------------------------------------------
   PAYOFF ENGINE  (all values per-share; ×100 for one contract)
   A "leg" is one component of a strategy. P&L at EXPIRATION only.
-----------------------------------------------------------------*/
const legPnL = (leg, S) => {
  const { kind, dir, strike, premium, entry } = leg;
  const sign = dir === "long" ? 1 : -1;
  switch (kind) {
    case "stock":
      return S - entry; // long stock only (our strategies never short stock)
    case "call":
      return sign * (Math.max(S - strike, 0) - premium);
    case "put":
      return sign * (Math.max(strike - S, 0) - premium);
    default:
      return 0;
  }
};

const CONTRACT = 100;

/* ----------------------------------------------------------------
   STRATEGY REGISTRY
   Each strategy: meta + the sliders it exposes + a legs(params) fn.
   gainType / lossType drive the honest "max" labels in the readout.
-----------------------------------------------------------------*/
const STRATEGIES = {
  longCall: {
    name: "Long Call",
    stance: "Bullish",
    icon: TrendingUp,
    earns: "The stock rises well above the strike before expiry.",
    gainText: "Unlimited",
    lossText: "Limited to premium paid",
    gainType: "unlimited",
    lossType: "defined",
    risk: "Defined",
    blurb:
      "Pay a premium for the right to BUY 100 shares at the strike. Leveraged upside, and the most you can lose is what you paid.",
    sliders: [
      { key: "strike", label: "Strike", min: 70, max: 130, step: 1 },
      { key: "premium", label: "Premium", min: 1, max: 20, step: 0.25 },
    ],
    defaults: { strike: 100, premium: 5 },
    legs: (p) => [{ kind: "call", dir: "long", strike: p.strike, premium: p.premium }],
    center: (p) => p.strike,
  },
  longPut: {
    name: "Long Put",
    stance: "Bearish / Hedge",
    icon: TrendingDown,
    earns: "The stock falls well below the strike before expiry.",
    gainText: "Large (down to strike − premium)",
    lossText: "Limited to premium paid",
    gainType: "capped",
    lossType: "defined",
    risk: "Defined",
    blurb:
      "Pay a premium for the right to SELL 100 shares at the strike. Acts like insurance: it gains as the stock drops, and the most you lose is the premium.",
    sliders: [
      { key: "strike", label: "Strike", min: 70, max: 130, step: 1 },
      { key: "premium", label: "Premium", min: 1, max: 20, step: 0.25 },
    ],
    defaults: { strike: 100, premium: 5 },
    legs: (p) => [{ kind: "put", dir: "long", strike: p.strike, premium: p.premium }],
    center: (p) => p.strike,
  },
  coveredCall: {
    name: "Covered Call",
    stance: "Neutral / Income",
    icon: Coins,
    earns: "You collect premium; the stock stays flat or rises modestly.",
    gainText: "Capped at strike + premium",
    lossText: "Substantial (stock can fall, premium softens it)",
    gainType: "capped",
    lossType: "substantial",
    risk: "Soft floor",
    blurb:
      "Own 100 shares AND sell a call against them. The premium is income, but your upside is capped at the strike. Downside is the stock's, cushioned only by the premium.",
    sliders: [
      { key: "entry", label: "Stock entry", min: 70, max: 130, step: 1 },
      { key: "strike", label: "Call strike", min: 70, max: 140, step: 1 },
      { key: "premium", label: "Call premium", min: 1, max: 15, step: 0.25 },
    ],
    defaults: { entry: 100, strike: 110, premium: 4 },
    legs: (p) => [
      { kind: "stock", dir: "long", entry: p.entry },
      { kind: "call", dir: "short", strike: p.strike, premium: p.premium },
    ],
    center: (p) => p.entry,
  },
  cashSecuredPut: {
    name: "Cash-Secured Put",
    stance: "Neutral-Bullish / Income",
    icon: Coins,
    earns: "You collect premium; the stock stays above the strike.",
    gainText: "Capped at premium received",
    lossText: "Substantial (down to strike − premium)",
    gainType: "capped",
    lossType: "substantial",
    risk: "Soft floor",
    blurb:
      "Sell a put and set aside cash to buy the shares if assigned. You earn premium or get the stock at a discount — but a crash below the strike hurts.",
    sliders: [
      { key: "strike", label: "Put strike", min: 70, max: 130, step: 1 },
      { key: "premium", label: "Premium", min: 1, max: 15, step: 0.25 },
    ],
    defaults: { strike: 95, premium: 4 },
    legs: (p) => [{ kind: "put", dir: "short", strike: p.strike, premium: p.premium }],
    center: (p) => p.strike,
  },
  protectivePut: {
    name: "Protective Put",
    stance: "Bullish + Insured",
    icon: Shield,
    earns: "The stock rises; the put is insurance you hope not to use.",
    gainText: "Unlimited (less the premium)",
    lossText: "Capped: entry − strike + premium",
    gainType: "unlimited",
    lossType: "defined",
    risk: "Hard floor",
    blurb:
      "Own 100 shares AND buy a put. The put sets a hard floor on your loss no matter how far the stock falls — even on an overnight gap. The cost is the premium, which drags returns.",
    sliders: [
      { key: "entry", label: "Stock entry", min: 70, max: 130, step: 1 },
      { key: "strike", label: "Put strike", min: 60, max: 120, step: 1 },
      { key: "premium", label: "Put premium", min: 1, max: 15, step: 0.25 },
    ],
    defaults: { entry: 100, strike: 90, premium: 4 },
    legs: (p) => [
      { kind: "stock", dir: "long", entry: p.entry },
      { kind: "put", dir: "long", strike: p.strike, premium: p.premium },
    ],
    center: (p) => p.entry,
  },
  collar: {
    name: "Collar",
    stance: "Protected / Range-bound",
    icon: Shield,
    earns: "The sold call pays for the protective put — cheap or free insurance.",
    gainText: "Capped at call strike",
    lossText: "Capped at put strike (hard floor)",
    gainType: "capped",
    lossType: "defined",
    risk: "Hard floor",
    blurb:
      "Own 100 shares, buy a put (floor), sell a call (which pays for the put). Both your downside AND upside are fenced in. This is the backbone of a hard-floor portfolio.",
    sliders: [
      { key: "entry", label: "Stock entry", min: 70, max: 130, step: 1 },
      { key: "putK", label: "Put strike", min: 60, max: 110, step: 1 },
      { key: "putP", label: "Put cost", min: 1, max: 12, step: 0.25 },
      { key: "callK", label: "Call strike", min: 90, max: 150, step: 1 },
      { key: "callP", label: "Call credit", min: 1, max: 12, step: 0.25 },
    ],
    defaults: { entry: 100, putK: 92, putP: 4, callK: 112, callP: 4 },
    legs: (p) => [
      { kind: "stock", dir: "long", entry: p.entry },
      { kind: "put", dir: "long", strike: p.putK, premium: p.putP },
      { kind: "call", dir: "short", strike: p.callK, premium: p.callP },
    ],
    center: (p) => p.entry,
  },
  bullCallSpread: {
    name: "Bull Call Spread",
    stance: "Bullish / Defined",
    icon: Layers,
    earns: "The stock rises toward the higher strike; both cost and reward are fixed.",
    gainText: "Capped: (K2 − K1) − net cost",
    lossText: "Capped at net cost paid",
    gainType: "capped",
    lossType: "defined",
    risk: "Defined",
    blurb:
      "Buy a call at a lower strike, sell one at a higher strike. Cheaper than a lone call, with both maximum gain and maximum loss known up front.",
    sliders: [
      { key: "k1", label: "Buy strike", min: 80, max: 120, step: 1 },
      { key: "c1", label: "Buy premium", min: 1, max: 18, step: 0.25 },
      { key: "k2", label: "Sell strike", min: 90, max: 140, step: 1 },
      { key: "c2", label: "Sell premium", min: 0.5, max: 12, step: 0.25 },
    ],
    defaults: { k1: 100, c1: 6, k2: 110, c2: 2.5 },
    legs: (p) => [
      { kind: "call", dir: "long", strike: p.k1, premium: p.c1 },
      { kind: "call", dir: "short", strike: p.k2, premium: p.c2 },
    ],
    center: (p) => (p.k1 + p.k2) / 2,
  },
};

const STRAT_KEYS = Object.keys(STRATEGIES);

/* ----------------------------------------------------------------
   TRUE max gain / max loss (per share).
   Payoff-at-expiration is piecewise-linear in S, with kinks only at the
   strikes. So its extremes over [0, ∞) occur at S=0, at a strike, or out
   at infinity. Evaluating those points gives the real numbers — unlike the
   chart grid, which is clipped to a window and understates strategies whose
   worst/best case sits near S→0 (e.g. long put, cash-secured put).
-----------------------------------------------------------------*/
function payoffExtremes(legs) {
  const total = (S) => legs.reduce((sum, leg) => sum + legPnL(leg, S), 0);
  const strikes = legs
    .filter((l) => l.kind === "call" || l.kind === "put")
    .map((l) => l.strike);
  const vals = [0, ...strikes].map(total);
  let maxPerShare = Math.max(...vals);
  let minPerShare = Math.min(...vals);
  // Slope as S→∞: long call +1, short call −1, long stock +1, puts flat.
  const slopeHi = legs.reduce((s, leg) => {
    const sign = leg.dir === "long" ? 1 : -1;
    if (leg.kind === "call") return s + sign;
    if (leg.kind === "stock") return s + 1;
    return s;
  }, 0);
  if (slopeHi > 0) maxPerShare = Infinity; // unbounded upside
  if (slopeHi < 0) minPerShare = -Infinity; // unbounded downside
  return { maxPerShare, minPerShare };
}

/* ----------------------------------------------------------------
   Compute payoff curve + derived stats over a price grid
-----------------------------------------------------------------*/
function usePayoff(stratKey, params) {
  return useMemo(() => {
    if (!stratKey) return null; // some lesson steps have no chart
    const s = STRATEGIES[stratKey];
    const legs = s.legs(params);
    const center = s.center(params);
    const lo = Math.max(1, center * 0.55);
    const hi = center * 1.45;
    const steps = 90;
    const data = [];
    for (let i = 0; i <= steps; i++) {
      const S = lo + ((hi - lo) * i) / steps;
      const perShare = legs.reduce((sum, leg) => sum + legPnL(leg, S), 0);
      data.push({ price: +S.toFixed(2), pnl: +(perShare * CONTRACT).toFixed(2) });
    }
    const ext = payoffExtremes(legs);
    const maxPnl = ext.maxPerShare * CONTRACT; // may be Infinity (unbounded upside)
    const minPnl = ext.minPerShare * CONTRACT;
    // breakevens: sign changes
    const bes = [];
    for (let i = 1; i < data.length; i++) {
      const a = data[i - 1].pnl;
      const b = data[i].pnl;
      if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) {
        const t = a / (a - b);
        bes.push(+(data[i - 1].price + t * (data[i].price - data[i - 1].price)).toFixed(2));
      }
    }
    return { data, maxPnl, minPnl, bes, meta: s, legs };
  }, [stratKey, params]);
}

// Total per-share P&L of a strategy at a given stock price (for the "now" readout).
const totalPnLAt = (legs, S) => legs.reduce((sum, leg) => sum + legPnL(leg, S), 0);

/* ----------------------------------------------------------------
   Small reusable payoff chart
-----------------------------------------------------------------*/
function PayoffChart({ data, bes, spot = null, height = 260, compact = false }) {
  // Gradient split is based on the VISIBLE curve, not the analytic extremes
  // (which can be Infinity for unbounded-upside strategies).
  const vis = data.map((d) => d.pnl);
  const vMax = Math.max(...vis);
  const vMin = Math.min(...vis);
  const off = vMax <= 0 ? 0 : vMin >= 0 ? 1 : vMax / (vMax - vMin);
  const gid = useMemo(() => "g" + Math.random().toString(36).slice(2, 8), []);
  return (
    <div className="chart-wrap">
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: compact ? -18 : 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor="#3fb950" stopOpacity={0.55} />
            <stop offset={off} stopColor="#3fb950" stopOpacity={0.05} />
            <stop offset={off} stopColor="#f85149" stopOpacity={0.05} />
            <stop offset={1} stopColor="#f85149" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id={gid + "s"} x1="0" y1="0" x2="0" y2="1">
            <stop offset={off} stopColor="#3fb950" stopOpacity={1} />
            <stop offset={off} stopColor="#f85149" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1c2230" strokeDasharray="2 4" />
        <XAxis
          dataKey="price"
          type="number"
          domain={["dataMin", "dataMax"]}
          tick={{ fill: "#6b7689", fontSize: 10, fontFamily: "var(--mono)" }}
          tickLine={false}
          axisLine={{ stroke: "#1c2230" }}
          tickCount={6}
          tickFormatter={(v) => `$${Math.round(v)}`}
        />
        <YAxis
          tick={{ fill: "#6b7689", fontSize: 10, fontFamily: "var(--mono)" }}
          tickLine={false}
          axisLine={false}
          width={compact ? 40 : 52}
          tickFormatter={(v) => (v === 0 ? "0" : `${v > 0 ? "+" : "−"}$${Math.abs(v)}`)}
        />
        <Tooltip
          contentStyle={{
            background: "#0d1117",
            border: "1px solid #2a3344",
            borderRadius: 8,
            fontFamily: "var(--mono)",
            fontSize: 12,
          }}
          labelStyle={{ color: "#9aa6b8" }}
          formatter={(v) => [`${v >= 0 ? "+" : "−"}$${Math.abs(v).toFixed(0)}`, "P&L"]}
          labelFormatter={(l) => `Stock @ $${l}`}
        />
        <ReferenceLine y={0} stroke="#3a4056" strokeWidth={1} />
        {bes.map((b, i) => (
          <ReferenceLine
            key={i}
            x={b}
            stroke="#e8b339"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            label={
              compact
                ? undefined
                : { value: `break-even $${b}`, position: "insideTopRight", fill: "#e8b339", fontSize: 9, fontFamily: "var(--mono)" }
            }
          />
        ))}
        {spot != null && (
          <ReferenceLine
            x={spot}
            stroke="#58a6ff"
            strokeWidth={1.5}
            label={{ value: `now $${spot}`, position: "insideTopLeft", fill: "#58a6ff", fontSize: 9, fontFamily: "var(--mono)" }}
          />
        )}
        <Area
          type="monotone"
          dataKey="pnl"
          stroke={`url(#${gid}s)`}
          strokeWidth={2.4}
          fill={`url(#${gid})`}
        />
      </AreaChart>
    </ResponsiveContainer>
      <div className="axis-hint">
        <span>→ Stock price at expiry</span>
        <span>↑ Profit / loss · 1 contract (100 sh)</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   PRIMER lesson steps
-----------------------------------------------------------------*/
const LESSON = [
  {
    title: "Start here: the price, and betting on it",
    body: "A share of a company trades at a live price — call it the spot price, what it costs right now. If you think it'll go up, you're 'bullish'; if down, 'bearish'. Options are simply a way to bet on that direction (or to protect yourself) for a small, known cost — instead of buying the shares outright.",
    aside: "Almost everything that follows — strikes, premiums, profit, loss — is measured against that one live number: where the stock is right now.",
    panel: {
      label: "The number everything hangs on",
      items: [
        { text: "Spot price = what the stock trades at this moment." },
        { text: "Up = bullish. Down = bearish." },
        { text: "An option lets you take a position for far less than buying 100 shares." },
      ],
    },
  },
  {
    title: "What an option actually is",
    body: "An option is a contract. It gives you the RIGHT — but never the obligation — to buy or sell 100 shares of one stock at a fixed price, on or before a set date. For that right, the buyer pays the seller a one-time fee called the premium.",
    aside: "Think of a deposit on a house. You pay a little to lock in a price for a while. If the deal makes sense later, you use it. If not, you walk away — losing only the deposit.",
    demo: "longCall",
  },
  {
    title: "The four ingredients",
    body: "Every option is fully described by four things. Get these four and you can read any option quote in the world.",
    aside: "When someone says 'I bought the AAPL 200 calls for June at $5', that's all four: underlying AAPL, strike 200, expiry June, premium $5.",
    panel: {
      label: "Read any option in four parts",
      items: [
        { text: "Underlying — which stock the contract is on." },
        { text: "Strike — the locked-in price you can buy or sell at." },
        { text: "Expiry — the deadline; after it, the contract is gone." },
        { text: "Premium — the price you pay (or collect) for the contract." },
      ],
    },
  },
  {
    title: "In, at, or out of the money",
    body: "'Moneyness' just asks: is the deal worth using right now? A $100-strike CALL is in-the-money when the stock is above $100 (you could buy cheap and sell high), and out-of-the-money below it. For a PUT it's the reverse.",
    aside: "Out-of-the-money options are cheaper because they're bets that haven't paid off yet — they only have value if the stock moves your way before the deadline.",
    demo: "longCall",
  },
  {
    title: "How the premium is priced",
    body: "A premium is two parts added together. INTRINSIC value is the part that's already real money — how deep in-the-money it is. TIME value is the price of hope: the chance the stock moves further before expiry. More time left, and more 'wobble' (volatility) in the stock, both make time value — and so the premium — bigger.",
    aside: "That's why an option slowly bleeds value as expiry nears even if the stock sits still — the hope is running out. It's called time decay. (Open the Simulator to see a premium split into intrinsic + time.)",
    demo: "longCall",
  },
  {
    title: "Where you break even",
    body: "Buying isn't free, so 'the stock went my way' isn't the same as 'I made money'. Pay $5 for a $100 call and you only profit ABOVE $105 — the strike plus the premium. For a put it's the strike MINUS the premium. The move has to clear both the strike and what you paid.",
    aside: "In the Simulator, drag 'Current price' and watch the break-even line: it shows exactly how far the stock must travel from today before you're in the green.",
    demo: "longCall",
  },
  {
    title: "Expiry, exercise & settlement",
    body: "Options have deadlines. Standard monthly options expire the third Friday of the month; 'weeklies' expire most Fridays. At expiry, an in-the-money option is automatically used (exercised); an out-of-the-money one simply expires worthless.",
    aside: "'Assignment' is the seller's side of exercise — they get called on to honour the contract. Single-stock options settle in actual shares (100 change hands); many index options settle in cash instead.",
    panel: {
      label: "What happens at the deadline",
      items: [
        { text: "Monthly: 3rd Friday. Weeklies: most Fridays." },
        { text: "In-the-money → auto-exercised (shares/cash change hands)." },
        { text: "Out-of-the-money → expires worthless; you keep nothing." },
        { text: "Seller being exercised against = 'assignment'." },
      ],
    },
  },
  {
    title: "Calls vs. Puts",
    body: "A CALL is the right to BUY at the strike — you want it when you expect the stock to rise. A PUT is the right to SELL at the strike — you want it when you expect the stock to fall, or to insure shares you already own.",
    aside: "Two words to remember: Call UP, Put DOWN. A call gains value as the stock climbs; a put gains value as it drops.",
    demo: "longPut",
  },
  {
    title: "Two sides: buying vs. selling",
    body: "When you BUY an option, your loss is capped at the premium — that's the worst case, full stop — while your gain can be large. The SELLER's math is the mirror image: the most they can make is the premium they collected, but their loss can be far bigger. Buyers pay for a chance; sellers collect income and carry the tail risk.",
    aside: "Most options expire worthless, which is why selling premium feels like easy income — right up until the month a stock gaps and the seller's 'small' premium meets a very large loss.",
    demo: "cashSecuredPut",
  },
  {
    title: "Rolling a position",
    body: "You don't have to wait for expiry. 'Rolling' means closing your current option early and opening a later or different one in the same move — to buy more time, lock in a gain, or repair a trade that's going against you. You either pay a little (a debit) or collect a little (a credit) to do it.",
    aside: "Rolling isn't magic. You're paying or collecting to reset the clock — useful, but every roll is another small bet, not a way to erase a bad one.",
    panel: {
      label: "Why people roll",
      items: [
        { text: "Out (later expiry) — buy more time for the thesis to work." },
        { text: "Up/down (new strike) — chase the stock or lock in a gain." },
        { text: "It's two trades at once: close the old, open the new." },
      ],
    },
  },
  {
    title: "When it worked — and when it blew up",
    body: "The mechanics are neutral; outcomes are not. A bought put is a HARD floor — your loss is contractually capped even in a crash. A naked sold option is only a SOFT floor — fine in calm markets, until a gap punches straight through it. Same option chain, very different nights' sleep.",
    aside: "Hard floors cost you a little every month. Soft floors pay you a little every month — until the one month they don't. That trade-off is the spine of this whole tool.",
    panel: {
      label: "Real and illustrative",
      items: [
        { tag: "worked", text: "March 2020: as markets fell ~34% in weeks, investors holding protective puts kept a hard floor — their downside was capped while everything else cratered." },
        { tag: "failed", text: "Jan 2021: traders short GameStop options were on the soft-floor side when it rocketed from ~$20 to ~$480 — 'small' premiums met catastrophic losses." },
        { tag: "failed", text: "Feb 2018 ('volmageddon'): short-volatility products lost ~96% in a single day when calm flipped to chaos overnight." },
        { tag: "note", text: "Illustrative: a retiree sells covered calls for steady income; a 40% rally gets the shares called away — real income, but a capped, missed run." },
      ],
    },
  },
];

/* ----------------------------------------------------------------
   UI atoms
-----------------------------------------------------------------*/
const riskColor = (r) =>
  r === "Hard floor"
    ? "#3fb950"
    : r === "Defined"
    ? "#58a6ff"
    : r === "Soft floor"
    ? "#e8b339"
    : "#f85149";

function StatPill({ label, value, tone }) {
  return (
    <div className="pill">
      <span className="pill-label">{label}</span>
      <span className="pill-value" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

const TAG_DOT = { worked: "#3fb950", failed: "#f85149", note: "#58a6ff" };
const TAG_TEXT = { worked: "Worked", failed: "Blew up", note: "Example" };

// Takeaway card shown for lesson steps that have no payoff chart.
function LessonPanel({ panel }) {
  return (
    <div className="lpanel">
      <div className="demo-label">{panel.label}</div>
      <ul className="lpanel-list">
        {panel.items.map((it, i) => (
          <li key={i} className={it.tag ? "lpanel-item tagged" : "lpanel-item"}>
            {it.tag ? (
              <span className="lpanel-tag" style={{ color: TAG_DOT[it.tag] }}>
                {TAG_TEXT[it.tag]}
              </span>
            ) : (
              <span className="lpanel-bullet" />
            )}
            <span className="lpanel-text">{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------
   Section <-> URL hash, so the phone back-gesture navigates between
   sections instead of exiting the app.
-----------------------------------------------------------------*/
const SECTIONS = ["primer", "reckoner", "sim"];
const sectionFromHash = () => {
  const h = (window.location.hash || "").replace("#", "");
  return SECTIONS.includes(h) ? h : "primer";
};

/* ----------------------------------------------------------------
   MAIN
-----------------------------------------------------------------*/
export default function OptionsPrimer() {
  const [section, setSection] = useState(() => sectionFromHash());
  const [step, setStep] = useState(0);

  // Each section change becomes a history entry; the back gesture pops it.
  const goSection = (next) => {
    if (next === section) return;
    window.history.pushState({ section: next }, "", `#${next}`);
    setSection(next);
  };

  useEffect(() => {
    // Base history entry for the section we loaded into.
    window.history.replaceState({ section }, "", `#${section}`);
    const onPop = (e) => {
      const next = (e.state && e.state.section) || sectionFromHash();
      setSection(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [stratKey, setStratKey] = useState("longCall");
  const [spot, setSpot] = useState(100); // "where the stock is now" — the anchor for the readout
  const [allParams, setAllParams] = useState(() => {
    const o = {};
    for (const k of STRAT_KEYS) o[k] = { ...STRATEGIES[k].defaults };
    return o;
  });

  const params = allParams[stratKey];
  const setParam = (key, val) =>
    setAllParams((prev) => ({ ...prev, [stratKey]: { ...prev[stratKey], [key]: val } }));

  const payoff = usePayoff(stratKey, params);

  // "Now" readout: P&L if the stock expired at today's price, and the move to break even.
  const spotPnL = Math.round(totalPnLAt(payoff.legs, spot) * CONTRACT);
  const nearestBE = payoff.bes.length
    ? payoff.bes.reduce((a, b) => (Math.abs(b - spot) < Math.abs(a - spot) ? b : a))
    : null;
  const movePct = nearestBE != null && spot ? ((nearestBE - spot) / spot) * 100 : null;
  // Premium = intrinsic + time value, but only meaningful for a single bought/sold option.
  const singleOpt =
    payoff.legs.length === 1 &&
    (payoff.legs[0].kind === "call" || payoff.legs[0].kind === "put");
  let premiumSplit = null;
  if (singleOpt) {
    const leg = payoff.legs[0];
    const rawIntrinsic =
      leg.kind === "call" ? Math.max(spot - leg.strike, 0) : Math.max(leg.strike - spot, 0);
    // A premium can never be less than intrinsic value in a real market.
    const belowIntrinsic = rawIntrinsic > leg.premium;
    const intrinsic = Math.min(rawIntrinsic, leg.premium);
    premiumSplit = {
      premium: leg.premium,
      intrinsic,
      timeVal: leg.premium - intrinsic,
      rawIntrinsic,
      belowIntrinsic,
    };
  }

  const openInSim = (key) => {
    setStratKey(key);
    goSection("sim");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  };

  const lessonDemoKey = LESSON[step].demo;
  const lessonPayoff = usePayoff(lessonDemoKey, allParams[lessonDemoKey]);

  return (
    <div className="root">
      <style>{CSS}</style>

      {/* HEADER */}
      <header className="hdr">
        <div className="hdr-mark">◆</div>
        <div>
          <h1 className="hdr-title">Options, demystified</h1>
          <p className="hdr-sub">A ready reckoner, a primer, and a live payoff lab — for the long-only investor</p>
        </div>
      </header>

      {/* NAV */}
      <nav className="nav">
        <button className={section === "primer" ? "on" : ""} onClick={() => goSection("primer")}>
          <BookOpen size={15} /> Primer
        </button>
        <button className={section === "reckoner" ? "on" : ""} onClick={() => goSection("reckoner")}>
          <MapIcon size={15} /> Reckoner
        </button>
        <button className={section === "sim" ? "on" : ""} onClick={() => goSection("sim")}>
          <SlidersHorizontal size={15} /> Simulator
        </button>
      </nav>

      {/* ============ RECKONER ============ */}
      {section === "reckoner" && (
        <section className="wrap fade">
          <p className="lede">
            Seven plays, at a glance. Each one is a different answer to a single question:{" "}
            <em>how much risk will I trade for how much return?</em> Green floors are{" "}
            <strong style={{ color: "#3fb950" }}>hard</strong> (survive a crash); amber are{" "}
            <strong style={{ color: "#e8b339" }}>soft</strong> (a gap can break them).
          </p>
          <div className="grid">
            {STRAT_KEYS.map((k, i) => {
              const s = STRATEGIES[k];
              const Icon = s.icon;
              return (
                <article className="card" key={k} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="card-top">
                    <Icon size={18} className="card-icon" />
                    <span className="risk-tag" style={{ color: riskColor(s.risk), borderColor: riskColor(s.risk) }}>
                      {s.risk}
                    </span>
                  </div>
                  <h3 className="card-name">{s.name}</h3>
                  <span className="card-stance">{s.stance}</span>
                  <p className="card-blurb">{s.blurb}</p>
                  <div className="card-rows">
                    <div>
                      <span>Max gain</span>
                      <strong style={{ color: "#3fb950" }}>{s.gainText}</strong>
                    </div>
                    <div>
                      <span>Max loss</span>
                      <strong style={{ color: "#f85149" }}>{s.lossText}</strong>
                    </div>
                  </div>
                  <button className="card-cta" onClick={() => openInSim(k)}>
                    Open in simulator <ArrowRight size={13} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ PRIMER ============ */}
      {section === "primer" && (
        <section className="wrap fade">
          <div className="progress">
            {LESSON.map((_, i) => (
              <span key={i} className={i <= step ? "dot on" : "dot"} onClick={() => setStep(i)} />
            ))}
          </div>
          <div className="lesson">
            <div className="lesson-text">
              <span className="lesson-count">
                {String(step + 1).padStart(2, "0")} / {String(LESSON.length).padStart(2, "0")}
              </span>
              <h2 className="lesson-title">{LESSON[step].title}</h2>
              <p className="lesson-body">{LESSON[step].body}</p>
              <div className="lesson-aside">
                <span>↳</span>
                <p>{LESSON[step].aside}</p>
              </div>
            </div>
            <div className="lesson-demo">
              {lessonDemoKey ? (
                <>
                  <div className="demo-label">
                    {STRATEGIES[lessonDemoKey].name} — payoff at expiry
                  </div>
                  <PayoffChart
                    {...lessonPayoff}
                    spot={STRATEGIES[lessonDemoKey].center(allParams[lessonDemoKey])}
                    height={220}
                    compact
                  />
                  <button className="demo-link" onClick={() => openInSim(lessonDemoKey)}>
                    Tinker with this <ArrowRight size={12} />
                  </button>
                </>
              ) : (
                <LessonPanel panel={LESSON[step].panel} />
              )}
            </div>
          </div>
          <div className="lesson-nav">
            <button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft size={14} /> Back
            </button>
            {step < LESSON.length - 1 ? (
              <button className="primary" onClick={() => setStep((s) => s + 1)}>
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button className="primary" onClick={() => goSection("sim")}>
                Go to simulator <ArrowRight size={14} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* ============ SIMULATOR ============ */}
      {section === "sim" && (
        <section className="wrap fade">
          <div className="sim-strats">
            {STRAT_KEYS.map((k) => (
              <button
                key={k}
                className={k === stratKey ? "chip on" : "chip"}
                onClick={() => setStratKey(k)}
              >
                {STRATEGIES[k].name}
              </button>
            ))}
          </div>

          <div className="sim-grid">
            <div className="sim-chart-card">
              <div className="sim-chart-head">
                <div>
                  <h3>{payoff.meta.name}</h3>
                  <span>{payoff.meta.stance} · earns when {payoff.meta.earns.toLowerCase()}</span>
                </div>
                <span className="risk-tag" style={{ color: riskColor(payoff.meta.risk), borderColor: riskColor(payoff.meta.risk) }}>
                  {payoff.meta.risk}
                </span>
              </div>
              <PayoffChart {...payoff} spot={spot} height={300} />
              <div className="now-readout">
                <p>
                  At today's <strong style={{ color: "#58a6ff" }}>${spot}</strong>, if it expired
                  right now this position is{" "}
                  <strong style={{ color: spotPnL >= 0 ? "#3fb950" : "#f85149" }}>
                    {spotPnL >= 0 ? "+" : "−"}${Math.abs(spotPnL).toLocaleString()}
                  </strong>
                  .
                  {nearestBE != null && (
                    <>
                      {" "}Break-even is at <strong style={{ color: "#e8b339" }}>${nearestBE}</strong> —
                      the stock must {movePct > 0 ? "rise" : "fall"}{" "}
                      <strong>{Math.abs(movePct).toFixed(1)}%</strong> from here
                      {Math.abs(movePct) < 0.05 ? " (you're right at it)" : ""}.
                    </>
                  )}
                </p>
                {premiumSplit &&
                  (premiumSplit.belowIntrinsic ? (
                    <p className="prem-split">
                      A ${premiumSplit.premium} premium is below this option's{" "}
                      <strong style={{ color: "#58a6ff" }}>
                        ${premiumSplit.rawIntrinsic.toFixed(2)}
                      </strong>{" "}
                      intrinsic value — a real market would never price it that low. Raise the
                      premium (or move the price) to see a realistic split.
                    </p>
                  ) : (
                    <p className="prem-split">
                      Premium <strong>${premiumSplit.premium}</strong> ={" "}
                      <strong style={{ color: "#58a6ff" }}>
                        ${premiumSplit.intrinsic.toFixed(2)}
                      </strong>{" "}
                      intrinsic (already real) +{" "}
                      <strong style={{ color: "#e8b339" }}>
                        ${premiumSplit.timeVal.toFixed(2)}
                      </strong>{" "}
                      time value (the price of hope, fades by expiry).
                    </p>
                  ))}
              </div>
              <div className="sim-stats">
                <StatPill
                  label="Max gain"
                  value={
                    isFinite(payoff.maxPnl)
                      ? `+$${Math.round(payoff.maxPnl).toLocaleString()}`
                      : "Unlimited ↑"
                  }
                  tone="#3fb950"
                />
                <StatPill
                  label="Max loss"
                  value={
                    isFinite(payoff.minPnl)
                      ? `−$${Math.abs(Math.round(payoff.minPnl)).toLocaleString()}`
                      : "Unlimited ↓"
                  }
                  tone="#f85149"
                />
                <StatPill
                  label={payoff.bes.length > 1 ? "Breakevens" : "Breakeven"}
                  value={payoff.bes.length ? payoff.bes.map((b) => `$${b}`).join(" / ") : "—"}
                  tone="#e8b339"
                />
              </div>
              {(payoff.meta.risk === "Soft floor") && (
                <div className="warn">
                  <AlertTriangle size={14} />
                  <span>
                    Soft floor: this max loss assumes an orderly market. An overnight gap on a single
                    stock can push the loss well past this line — the risk the tool flags before you trade.
                  </span>
                </div>
              )}
            </div>

            <div className="sim-controls">
              <div className="ctrl-head">Where is the stock now?</div>
              <div className="ctrl spot-ctrl">
                <div className="ctrl-top">
                  <label>Current price</label>
                  <span className="ctrl-val" style={{ color: "#58a6ff" }}>${spot}</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={130}
                  step={1}
                  value={spot}
                  onChange={(e) => setSpot(+e.target.value)}
                />
              </div>
              <div className="ctrl-head" style={{ marginTop: 18 }}>Adjust the trade</div>
              {payoff.meta.sliders.map((sl) => (
                <div className="ctrl" key={sl.key}>
                  <div className="ctrl-top">
                    <label>{sl.label}</label>
                    <span className="ctrl-val">
                      {sl.label.toLowerCase().includes("strike") || sl.label.toLowerCase().includes("entry")
                        ? `$${params[sl.key]}`
                        : `$${params[sl.key]}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={params[sl.key]}
                    onChange={(e) => setParam(sl.key, +e.target.value)}
                  />
                </div>
              ))}
              <button
                className="reset"
                onClick={() =>
                  setAllParams((prev) => ({ ...prev, [stratKey]: { ...STRATEGIES[stratKey].defaults } }))
                }
              >
                Reset to defaults
              </button>
              <p className="sim-note">
                One contract = 100 shares, so P&L is shown in dollars for a single contract. Curves
                are payoff <em>at expiration</em> — they don't model time decay or volatility yet.
              </p>
            </div>
          </div>
        </section>
      )}

      <footer className="ftr">
        Educational tool · payoffs shown at expiration · not investment advice. Options involve
        substantial risk and aren't suitable for every investor.
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------------
   STYLES — refined "financial terminal × editorial" dark theme
-----------------------------------------------------------------*/
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');

:root{
  --bg:#080b11; --panel:#0d1117; --panel2:#10161f; --line:#1c2230;
  --ink:#e6ebf2; --mut:#8a94a6; --dim:#6b7689;
  --gold:#e8b339; --green:#3fb950; --red:#f85149; --blue:#58a6ff;
  --display:'Fraunces',Georgia,serif; --body:'DM Sans',system-ui,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box;}
.root{
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(232,179,57,.06), transparent 60%),
    radial-gradient(900px 500px at -10% 10%, rgba(88,166,255,.05), transparent 55%),
    var(--bg);
  color:var(--ink); font-family:var(--body); min-height:100vh;
  padding:0 0 60px; line-height:1.5;
}
.root::before{
  content:""; position:fixed; inset:0; pointer-events:none; opacity:.025;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
/* header */
.hdr{display:flex;align-items:center;gap:16px;padding:32px 26px 20px;max-width:1080px;margin:0 auto;}
.hdr-mark{font-size:26px;color:var(--gold);line-height:1;transform:translateY(2px);}
.hdr-title{font-family:var(--display);font-weight:600;font-size:30px;margin:0;letter-spacing:-.01em;}
.hdr-sub{margin:3px 0 0;color:var(--mut);font-size:13.5px;}
/* nav */
.nav{display:flex;gap:6px;padding:0 22px;max-width:1080px;margin:0 auto 22px;border-bottom:1px solid var(--line);}
.nav button{
  display:flex;align-items:center;gap:7px;background:none;border:none;color:var(--dim);
  font-family:var(--body);font-size:13.5px;font-weight:500;padding:11px 14px;cursor:pointer;
  border-bottom:2px solid transparent;margin-bottom:-1px;transition:.18s;
}
.nav button:hover{color:var(--ink);}
.nav button.on{color:var(--gold);border-bottom-color:var(--gold);}
.wrap{max-width:1080px;margin:0 auto;padding:6px 22px 0;}
.fade{animation:fade .5s ease both;}
@keyframes fade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.lede{color:var(--mut);font-size:14.5px;max-width:680px;margin:8px 0 22px;}
.lede em{font-family:var(--display);font-style:italic;color:var(--ink);}
/* reckoner grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:14px;}
.card{
  background:linear-gradient(180deg,var(--panel2),var(--panel));
  border:1px solid var(--line);border-radius:13px;padding:17px 17px 15px;
  display:flex;flex-direction:column;animation:fade .5s ease both;transition:.2s;
}
.card:hover{border-color:#2a3344;transform:translateY(-2px);}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:11px;}
.card-icon{color:var(--gold);}
.risk-tag{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;
  border:1px solid;border-radius:5px;padding:3px 6px;}
.card-name{font-family:var(--display);font-weight:600;font-size:18px;margin:0;}
.card-stance{color:var(--dim);font-size:11.5px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.05em;}
.card-blurb{color:var(--mut);font-size:12.8px;margin:9px 0 12px;flex:1;}
.card-rows{display:flex;flex-direction:column;gap:5px;font-size:11.5px;margin-bottom:13px;}
.card-rows div{display:flex;justify-content:space-between;gap:10px;}
.card-rows span{color:var(--dim);}
.card-rows strong{font-family:var(--mono);font-weight:600;font-size:11px;text-align:right;}
.card-cta{
  display:flex;align-items:center;justify-content:center;gap:6px;background:none;
  border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:8px;font-family:var(--body);
  font-size:12.5px;font-weight:500;cursor:pointer;transition:.18s;
}
.card-cta:hover{border-color:var(--gold);color:var(--gold);}
/* primer */
.progress{display:flex;gap:8px;margin:6px 0 22px;}
.dot{width:34px;height:4px;border-radius:3px;background:var(--line);cursor:pointer;transition:.2s;}
.dot.on{background:var(--gold);}
.lesson{display:grid;grid-template-columns:1.1fr .9fr;gap:30px;align-items:start;}
.lesson-count{font-family:var(--mono);color:var(--gold);font-size:12px;letter-spacing:.08em;}
.lesson-title{font-family:var(--display);font-weight:600;font-size:27px;margin:8px 0 14px;letter-spacing:-.01em;line-height:1.15;}
.lesson-body{color:var(--ink);font-size:15px;opacity:.92;margin:0 0 16px;}
.lesson-aside{display:flex;gap:10px;background:var(--panel);border-left:2px solid var(--gold);
  border-radius:0 8px 8px 0;padding:13px 15px;}
.lesson-aside span{color:var(--gold);font-family:var(--mono);}
.lesson-aside p{margin:0;color:var(--mut);font-size:13px;}
.lesson-demo{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);
  border-radius:13px;padding:15px 14px 12px;}
.demo-label{font-family:var(--mono);font-size:11px;color:var(--dim);text-transform:uppercase;
  letter-spacing:.05em;margin-bottom:6px;}
.demo-link{display:flex;align-items:center;gap:5px;background:none;border:none;color:var(--gold);
  font-family:var(--body);font-size:12px;cursor:pointer;margin:8px auto 0;}
.lesson-nav{display:flex;justify-content:space-between;margin:30px 0 0;}
.lesson-nav button{display:flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--line);
  color:var(--ink);border-radius:9px;padding:10px 18px;font-family:var(--body);font-size:13.5px;font-weight:500;cursor:pointer;transition:.18s;}
.lesson-nav button:hover:not(:disabled){border-color:#2a3344;}
.lesson-nav button:disabled{opacity:.35;cursor:default;}
.lesson-nav .primary{background:var(--gold);color:#1a1405;border-color:var(--gold);font-weight:600;}
/* simulator */
.sim-strats{display:flex;flex-wrap:wrap;gap:7px;margin:4px 0 20px;}
.chip{background:var(--panel);border:1px solid var(--line);color:var(--mut);border-radius:20px;
  padding:7px 14px;font-family:var(--body);font-size:12.5px;cursor:pointer;transition:.16s;}
.chip:hover{color:var(--ink);border-color:#2a3344;}
.chip.on{background:var(--gold);color:#1a1405;border-color:var(--gold);font-weight:600;}
.sim-grid{display:grid;grid-template-columns:1.55fr .85fr;gap:18px;align-items:start;}
.sim-chart-card,.sim-controls{background:linear-gradient(180deg,var(--panel2),var(--panel));
  border:1px solid var(--line);border-radius:14px;padding:18px;}
.sim-chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px;}
.sim-chart-head h3{font-family:var(--display);font-weight:600;font-size:20px;margin:0;}
.sim-chart-head span{color:var(--dim);font-size:12px;}
.sim-stats{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;}
.pill{flex:1;min-width:120px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 13px;}
.pill-label{display:block;color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;font-family:var(--mono);}
.pill-value{display:block;font-family:var(--mono);font-weight:600;font-size:16px;margin-top:3px;}
.warn{display:flex;gap:9px;align-items:flex-start;margin-top:14px;background:rgba(232,179,57,.07);
  border:1px solid rgba(232,179,57,.3);border-radius:10px;padding:11px 13px;color:var(--gold);}
.warn span{color:#d8c08a;font-size:12.3px;line-height:1.45;}
.ctrl-head{font-family:var(--mono);font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;}
.ctrl{margin-bottom:15px;}
.ctrl-top{display:flex;justify-content:space-between;margin-bottom:7px;}
.ctrl label{font-size:13px;color:var(--mut);}
.ctrl-val{font-family:var(--mono);font-size:13px;color:var(--gold);font-weight:600;}
.ctrl input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:3px;background:var(--line);outline:none;}
.ctrl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;
  background:var(--gold);cursor:pointer;border:2px solid var(--bg);box-shadow:0 0 0 1px var(--gold);}
.ctrl input[type=range]::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:var(--gold);
  cursor:pointer;border:2px solid var(--bg);}
.reset{width:100%;background:none;border:1px solid var(--line);color:var(--mut);border-radius:8px;
  padding:8px;font-family:var(--body);font-size:12.5px;cursor:pointer;margin-top:4px;transition:.16s;}
.reset:hover{color:var(--ink);border-color:#2a3344;}
.sim-note{color:var(--dim);font-size:11.5px;margin:14px 0 0;line-height:1.5;}
.sim-note em{color:var(--mut);font-style:italic;}
.ftr{max-width:1080px;margin:36px auto 0;padding:18px 22px 0;border-top:1px solid var(--line);
  color:var(--dim);font-size:11.5px;text-align:center;}
/* payoff chart axis caption */
.chart-wrap{display:flex;flex-direction:column;}
.axis-hint{display:flex;justify-content:space-between;gap:10px;margin-top:4px;padding:0 2px;
  font-family:var(--mono);font-size:9.5px;color:var(--dim);letter-spacing:.02em;}
.axis-hint span:last-child{text-align:right;}
/* lesson takeaway panel (chart-less steps) */
.lpanel{display:flex;flex-direction:column;}
.lpanel-list{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:12px;}
.lpanel-item{display:flex;gap:10px;align-items:flex-start;}
.lpanel-bullet{flex:none;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:7px;}
.lpanel-tag{flex:none;width:62px;font-family:var(--mono);font-size:9.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.04em;margin-top:2px;}
.lpanel-text{color:var(--mut);font-size:13px;line-height:1.45;}
.lpanel-item.tagged .lpanel-text{color:var(--ink);opacity:.92;}
/* simulator "now" readout + premium split */
.now-readout{margin-top:12px;border-top:1px solid var(--line);padding-top:12px;}
.now-readout p{margin:0;color:var(--mut);font-size:13px;line-height:1.55;}
.now-readout .prem-split{margin-top:8px;font-size:12.3px;color:var(--dim);}
.spot-ctrl input[type=range]::-webkit-slider-thumb{background:var(--blue);box-shadow:0 0 0 1px var(--blue);}
.spot-ctrl input[type=range]::-moz-range-thumb{background:var(--blue);}
@media(max-width:760px){
  .lesson,.sim-grid{grid-template-columns:1fr;}
  .hdr{padding:24px 16px 16px;gap:12px;}
  .hdr-title{font-size:23px;}
  .hdr-sub{font-size:12.5px;}
  .nav{padding:0 12px;}
  .nav button{padding:12px 11px;font-size:13px;}
  .wrap{padding:6px 16px 0;}
  .lede{font-size:14px;}
  .lesson{gap:22px;}
  .lesson-title{font-size:23px;}
  .lesson-body{font-size:14.5px;}
  .sim-grid{gap:14px;}
  .ftr{padding:18px 16px 0;}
  /* Larger tap area on the primer progress dots (visual bar stays thin) */
  .progress{gap:6px;}
  .dot{height:4px;padding:9px 0;box-sizing:content-box;background-clip:content-box;}
}
`;
