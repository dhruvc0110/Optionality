// Strategy library for the Construct surface.
//
// A strategy is a set of legs. Given the MARKET (spot, days, vol, rate, q) and
// the chosen STRIKES, we price every option leg with Black-Scholes-Merton, then
// derive net cost, payoff-at-expiry extremes, break-evens, and aggregate Greeks.
//
// All per-share quantities are ×100 (CONTRACT) for the dollar figures, matching
// the one-contract convention used across the app.

import { blackScholes, daysToYears } from "../pricing/blackScholes.js";

export const CONTRACT = 100;

// P&L per share at expiry for one priced leg at terminal price S.
function legPnL(leg, S) {
  switch (leg.kind) {
    case "stock":
      return leg.dir === "long" ? S - leg.entry : leg.entry - S;
    case "call": {
      const v = Math.max(S - leg.strike, 0) - leg.premium;
      return leg.dir === "long" ? v : -v;
    }
    case "put": {
      const v = Math.max(leg.strike - S, 0) - leg.premium;
      return leg.dir === "long" ? v : -v;
    }
    default:
      return 0;
  }
}

const totalPnL = (legs, S) => legs.reduce((s, l) => s + legPnL(l, S), 0);

// True max gain / max loss per share. Payoff is piecewise-linear with kinks only
// at the strikes, so the extremes sit at S=0, at a strike, or out at infinity.
function extremes(legs) {
  const strikes = legs.filter((l) => l.strike != null).map((l) => l.strike);
  const vals = [0, ...strikes].map((S) => totalPnL(legs, S));
  let maxPS = Math.max(...vals);
  let minPS = Math.min(...vals);
  const slopeHi = legs.reduce((s, l) => {
    const sign = l.dir === "long" ? 1 : -1;
    if (l.kind === "call") return s + sign;
    if (l.kind === "stock") return s + (l.dir === "long" ? 1 : -1);
    return s; // puts are flat as S→∞
  }, 0);
  if (slopeHi > 0) maxPS = Infinity;
  if (slopeHi < 0) minPS = -Infinity;
  return { maxPS, minPS };
}

// Break-evens: scan [0, 2·spot] for sign changes in total P&L.
function breakevens(legs, spot) {
  const lo = 0;
  const hi = Math.max(2 * spot, 10);
  const N = 400;
  const out = [];
  let prev = totalPnL(legs, lo);
  for (let i = 1; i <= N; i++) {
    const S = lo + ((hi - lo) * i) / N;
    const cur = totalPnL(legs, S);
    if ((prev < 0 && cur >= 0) || (prev > 0 && cur <= 0)) {
      const Sprev = lo + ((hi - lo) * (i - 1)) / N;
      const t = prev / (prev - cur);
      out.push(+(Sprev + t * (S - Sprev)).toFixed(2));
    }
    prev = cur;
  }
  return out;
}

// ---- Strategy definitions ----
// strikes: each {key,label,def(spot)} — default strike derived from spot.
// legs(k, m): structural legs (no premiums yet); buildStrategy prices them.
const r2 = (x) => Math.round(x); // round strike to whole dollars

export const STRATEGY_LIB = {
  coveredCall: {
    name: "Covered Call",
    stance: "Neutral / income",
    floor: "soft",
    note: "Own 100 shares and sell a call against them. Premium is income; upside is capped at the strike; downside is the stock's, softened only by the premium.",
    strikes: [{ key: "callK", label: "Call strike", def: (s) => r2(s * 1.1) }],
    legs: (k) => [
      { kind: "stock", dir: "long" },
      { kind: "call", dir: "short", strike: k.callK },
    ],
  },
  cashSecuredPut: {
    name: "Cash-Secured Put",
    stance: "Neutral-bullish / income",
    floor: "soft",
    note: "Sell a put and set aside cash to buy the shares if assigned. Earn premium, or get the stock at a discount — but a crash below the strike hurts.",
    strikes: [{ key: "putK", label: "Put strike", def: (s) => r2(s * 0.95) }],
    legs: (k) => [{ kind: "put", dir: "short", strike: k.putK }],
  },
  protectivePut: {
    name: "Protective Put",
    stance: "Bullish + insured",
    floor: "hard",
    note: "Own 100 shares and buy a put. The put is a hard floor on your loss — it survives an overnight gap. The cost is the premium, which drags returns.",
    strikes: [{ key: "putK", label: "Put strike", def: (s) => r2(s * 0.9) }],
    legs: (k) => [
      { kind: "stock", dir: "long" },
      { kind: "put", dir: "long", strike: k.putK },
    ],
  },
  collar: {
    name: "Collar",
    stance: "Protected / range-bound",
    floor: "hard",
    note: "Own 100 shares, buy a put (floor), sell a call (which pays for the put). Both downside and upside are fenced in. The backbone of a hard-floor portfolio.",
    strikes: [
      { key: "putK", label: "Put strike (floor)", def: (s) => r2(s * 0.92) },
      { key: "callK", label: "Call strike (cap)", def: (s) => r2(s * 1.1) },
    ],
    legs: (k) => [
      { kind: "stock", dir: "long" },
      { kind: "put", dir: "long", strike: k.putK },
      { kind: "call", dir: "short", strike: k.callK },
    ],
  },
  putSpreadCollar: {
    name: "Put-Spread Collar",
    stance: "Protected / cheaper hedge",
    floor: "hard",
    note: "A collar where a further-OTM short put helps pay for the protection. Cheaper than a plain collar, but the hard floor only holds DOWN TO the short put strike — below that, downside resumes.",
    strikes: [
      { key: "longPutK", label: "Long put (floor)", def: (s) => r2(s * 0.92) },
      { key: "shortPutK", label: "Short put (trapdoor)", def: (s) => r2(s * 0.8) },
      { key: "callK", label: "Call strike (cap)", def: (s) => r2(s * 1.1) },
    ],
    legs: (k) => [
      { kind: "stock", dir: "long" },
      { kind: "put", dir: "long", strike: k.longPutK },
      { kind: "put", dir: "short", strike: k.shortPutK },
      { kind: "call", dir: "short", strike: k.callK },
    ],
  },
  bullCallSpread: {
    name: "Bull Call Spread",
    stance: "Bullish / defined risk",
    floor: "defined",
    note: "Buy a call, sell a higher one. Cheaper than a lone call, with both max gain and max loss fixed up front. No stock owned.",
    strikes: [
      { key: "lowK", label: "Buy strike", def: (s) => r2(s) },
      { key: "highK", label: "Sell strike", def: (s) => r2(s * 1.1) },
    ],
    legs: (k) => [
      { kind: "call", dir: "long", strike: k.lowK },
      { kind: "call", dir: "short", strike: k.highK },
    ],
  },
};

export const STRATEGY_KEYS = Object.keys(STRATEGY_LIB);

export const defaultStrikes = (key, spot) => {
  const out = {};
  for (const s of STRATEGY_LIB[key].strikes) out[s.key] = s.def(spot);
  return out;
};

// Price a strategy: returns priced legs + derived metrics. All dollar figures
// are per ONE contract (×100). market = { spot, days, vol, rate, q }.
export function buildStrategy(key, strikes, market) {
  const def = STRATEGY_LIB[key];
  const { spot, days, vol, rate = 0, q = 0 } = market;
  const T = daysToYears(days);

  const legs = def.legs(strikes).map((leg) => {
    if (leg.kind === "stock") {
      return { ...leg, entry: spot, premium: 0, greeks: { delta: leg.dir === "long" ? 1 : -1 } };
    }
    const bs = blackScholes(leg.kind, spot, leg.strike, T, vol, rate, q);
    return { ...leg, premium: bs.price, greeks: bs };
  });

  // Net cash to ENTER, per share (+ = you pay / debit, − = you collect / credit).
  // Stock legs are excluded from "net premium" — shown separately as capital.
  const netOptionPremium =
    legs
      .filter((l) => l.kind !== "stock")
      .reduce((s, l) => s + (l.dir === "long" ? l.premium : -l.premium), 0) * CONTRACT;
  const stockOutlay =
    legs.filter((l) => l.kind === "stock" && l.dir === "long").length > 0 ? spot * CONTRACT : 0;

  const ext = extremes(legs);
  const bes = breakevens(legs, spot);

  // Aggregate Greeks per contract (×100). Stock contributes delta only.
  const sign = (l) => (l.dir === "long" ? 1 : -1);
  const agg = { delta: 0, gamma: 0, theta: 0, vega: 0 };
  for (const l of legs) {
    if (l.kind === "stock") {
      agg.delta += sign(l) * 1 * CONTRACT;
    } else {
      agg.delta += sign(l) * l.greeks.delta * CONTRACT;
      agg.gamma += sign(l) * l.greeks.gamma * CONTRACT;
      agg.theta += sign(l) * l.greeks.thetaPerDay * CONTRACT; // $/day
      agg.vega += sign(l) * l.greeks.vegaPer1pct * CONTRACT; // $ per 1% vol
    }
  }

  return {
    meta: def,
    legs,
    netOptionPremium, // $ for the options only (+debit / −credit)
    stockOutlay, // $ to buy the 100 shares, if any
    maxGain: ext.maxPS * CONTRACT,
    maxLoss: ext.minPS * CONTRACT,
    breakevens: bes,
    greeks: agg,
    pnlAt: (S) => totalPnL(legs, S) * CONTRACT,
  };
}
