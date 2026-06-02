// Broker-agnostic live quotes (Layer 4, prices-first).
//
// v1 adapter: Yahoo Finance via a public CORS proxy — keyless, free, no account.
// It's intentionally graceful: any failure returns null, so the app simply falls
// back to manual price entry. When a broker is connected later (Alpaca/Tradier
// via the serverless proxy), a new adapter slots in behind this same getQuote().
//
// Caveat: a public proxy + an unofficial endpoint can rate-limit or change. This
// is fine for a single user; it's a convenience, never a dependency.

const PROXY = "https://corsproxy.io/?url=";

export async function getQuote(ticker) {
  const sym = (ticker || "").trim().toUpperCase();
  if (!sym) return null;
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
  try {
    const r = await fetch(PROXY + encodeURIComponent(target));
    if (!r.ok) return null;
    const j = await r.json();
    const m = j?.chart?.result?.[0]?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return null;
    return {
      ticker: sym,
      price: m.regularMarketPrice,
      currency: m.currency || "USD",
      at: Date.now(),
    };
  } catch {
    return null;
  }
}
