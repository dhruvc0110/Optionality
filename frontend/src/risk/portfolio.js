// Portfolio-level risk math (the Honesty Engine core), shared by the Construct
// risk panel and the Monitor dashboard. Pure: takes tracked positions, returns
// worst-case / soft-floor / gap-stress / aggregate Greeks. Dollar figures; the
// UI turns them into % of the account.

import { buildStrategy, STRATEGY_LIB } from "../strategies/library.js";

export function computePortfolioRisk(positions) {
  const rebuilt = positions.map((p) => {
    const b = buildStrategy(p.strategyKey, p.strikes, p.market);
    const floor = STRATEGY_LIB[p.strategyKey]?.floor || "soft";
    const worst = isFinite(b.maxLoss) ? Math.abs(b.maxLoss) : Infinity;
    return { p, b, floor, worst };
  });

  let totalWorst = 0,
    softWorst = 0,
    hardWorst = 0,
    unbounded = false,
    netPremium = 0,
    capital = 0;
  const greeks = { delta: 0, theta: 0, vega: 0 };

  for (const r of rebuilt) {
    if (!isFinite(r.worst)) unbounded = true;
    else {
      totalWorst += r.worst;
      if (r.floor === "soft") softWorst += r.worst;
      else hardWorst += r.worst;
    }
    greeks.delta += r.b.greeks.delta;
    greeks.theta += r.b.greeks.theta;
    greeks.vega += r.b.greeks.vega;
    netPremium += r.b.netOptionPremium; // + debit / − credit
    capital += r.b.capitalRequired;
  }

  // Portfolio P&L if every underlying moves by `move` (e.g. -0.20 = down 20%).
  const pnlAtMove = (move) =>
    rebuilt.reduce((s, r) => s + r.b.pnlAt(r.p.market.spot * (1 + move)), 0);

  const gapStress = [0.1, 0.2, 0.35].map((g) => ({ gap: g, pnl: pnlAtMove(-g) }));

  return {
    count: positions.length,
    rebuilt,
    totalWorst,
    softWorst,
    hardWorst,
    unbounded,
    greeks,
    netPremium,
    capital,
    gapStress,
    pnlAtMove,
  };
}
