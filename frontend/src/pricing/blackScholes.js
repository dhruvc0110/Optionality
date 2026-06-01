// Black-Scholes-Merton pricing + Greeks for European options on a stock or
// index paying a continuous dividend yield q. Pure functions, no dependencies.
//
// Conventions (chosen to be intuitive in the UI):
//   - T   : time to expiry in YEARS (use daysToYears for a day count).
//   - sigma (volatility) and r, q are decimals: 20% = 0.20.
//   - price, intrinsic etc. are PER SHARE. Multiply by 100 for one contract.
//   - delta : change in option price per $1 change in spot.
//   - gamma : change in delta per $1 change in spot.
//   - vega  : returned per 1.00 (100%) change in vol; vegaPer1pct divides by 100.
//   - theta : returned per YEAR; thetaPerDay divides by 365 (calendar days).
//   - rho   : per 1.00 change in the rate.
//
// Equity options are American (early exercise possible); BSM is the standard,
// widely-used approximation for their price and Greeks. True American pricing
// (binomial) is a later refinement, not needed for construction/teaching here.

const SQRT2PI = Math.sqrt(2 * Math.PI);

// Standard normal probability density.
export function normPDF(x) {
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

// Standard normal CDF via Abramowitz & Stegun 7.1.26 (abs error < 7.5e-8).
export function normCDF(x) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

export const daysToYears = (days) => days / 365;

function d1d2(S, K, T, sigma, r, q) {
  const vsqrt = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vsqrt;
  return [d1, d1 - vsqrt];
}

// Intrinsic value per share at expiry / for a degenerate input.
function intrinsic(type, S, K) {
  return type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
}

// Full price + Greeks. type is "call" | "put".
export function blackScholes(type, S, K, T, sigma, r = 0, q = 0) {
  // Degenerate cases: no time left, or no volatility — fall back to discounted intrinsic.
  if (T <= 0 || sigma <= 0) {
    const price = intrinsic(type, S, K);
    const delta = type === "call" ? (S > K ? 1 : 0) : S < K ? -1 : 0;
    return { price, delta, gamma: 0, vega: 0, vegaPer1pct: 0, theta: 0, thetaPerDay: 0, rho: 0 };
  }

  const [d1, d2] = d1d2(S, K, T, sigma, r, q);
  const eqt = Math.exp(-q * T);
  const ert = Math.exp(-r * T);
  const Nd1 = normCDF(d1);
  const Nd2 = normCDF(d2);
  const nd1 = normPDF(d1);

  let price, delta, theta, rho;
  if (type === "call") {
    price = S * eqt * Nd1 - K * ert * Nd2;
    delta = eqt * Nd1;
    theta =
      -(S * eqt * nd1 * sigma) / (2 * Math.sqrt(T)) -
      r * K * ert * Nd2 +
      q * S * eqt * Nd1;
    rho = K * T * ert * Nd2;
  } else {
    price = K * ert * normCDF(-d2) - S * eqt * normCDF(-d1);
    delta = -eqt * normCDF(-d1);
    theta =
      -(S * eqt * nd1 * sigma) / (2 * Math.sqrt(T)) +
      r * K * ert * normCDF(-d2) -
      q * S * eqt * normCDF(-d1);
    rho = -K * T * ert * normCDF(-d2);
  }

  const gamma = (eqt * nd1) / (S * sigma * Math.sqrt(T));
  const vega = S * eqt * nd1 * Math.sqrt(T); // per 1.00 change in vol

  return {
    price,
    delta,
    gamma,
    vega,
    vegaPer1pct: vega / 100,
    theta, // per year
    thetaPerDay: theta / 365,
    rho,
  };
}

// Convenience: theoretical price only.
export function bsPrice(type, S, K, T, sigma, r = 0, q = 0) {
  return blackScholes(type, S, K, T, sigma, r, q).price;
}

// Implied volatility from a market price, via bisection (robust, no derivative
// blow-ups). Returns null if the price is outside the no-arbitrage band.
export function impliedVol(type, marketPrice, S, K, T, r = 0, q = 0, tol = 1e-6, maxIter = 100) {
  if (T <= 0) return null;
  const floor = intrinsic(type, S, K) * Math.exp(-r * T); // rough lower bound
  if (marketPrice <= floor) return null;
  let lo = 1e-4;
  let hi = 5; // 500% vol — wide enough for any traded option
  let priceHi = bsPrice(type, S, K, T, hi, r, q);
  if (marketPrice > priceHi) return null; // beyond what 500% vol can produce
  for (let i = 0; i < maxIter; i++) {
    const mid = 0.5 * (lo + hi);
    const p = bsPrice(type, S, K, T, mid, r, q);
    if (Math.abs(p - marketPrice) < tol) return mid;
    if (p > marketPrice) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}
