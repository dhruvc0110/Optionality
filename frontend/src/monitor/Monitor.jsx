import React, { useState, useEffect, useMemo } from "react";
import { connectDrive, loadPositions } from "../storage/googleDrive.js";
import { computePortfolioRisk } from "../risk/portfolio.js";
import { STRATEGY_LIB } from "../strategies/library.js";

const money = (v) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString()}`;

function Gauge({ label, pct, cap, value, fill = "#3fb950" }) {
  const scale = Math.max(pct, cap, 1) * 1.25;
  const over = pct > cap;
  return (
    <div className="gauge">
      <div className="gauge-top">
        <span>{label}</span>
        <strong style={{ color: over ? "#f85149" : fill }}>{value}</strong>
      </div>
      <div className="riskbar">
        <div className="riskbar-fill" style={{ width: Math.min(pct / scale, 1) * 100 + "%", background: over ? "#f85149" : fill }} />
        <div className="riskbar-cap" style={{ left: Math.min(cap / scale, 1) * 100 + "%" }} />
      </div>
    </div>
  );
}

function MonStat({ label, value, hint }) {
  return (
    <div className="greek">
      <span className="greek-val">{value}</span>
      <span className="greek-label">{label}</span>
      <span className="greek-hint">{hint}</span>
    </div>
  );
}

export default function Monitor({ positions, setPositions, connected, setConnected, account, riskBudgetPct }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [move, setMove] = useState(-10);
  const [openId, setOpenId] = useState(null);

  // Pull the latest positions from Drive whenever the dashboard opens (if signed in).
  useEffect(() => {
    let alive = true;
    if (connected) {
      (async () => {
        try {
          const ps = await loadPositions();
          if (alive) setPositions(ps);
        } catch {
          /* ignore — show what we have */
        }
      })();
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const RISK = useMemo(() => (positions.length ? computePortfolioRisk(positions) : null), [positions]);
  const pct = (v) => (account ? (v / account) * 100 : 0);

  const handleConnect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await connectDrive();
      setConnected(true);
      setPositions(await loadPositions());
    } catch (e) {
      setMsg(e.message || "Couldn't connect.");
    } finally {
      setBusy(false);
    }
  };
  const handleRefresh = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setPositions(await loadPositions());
    } catch (e) {
      setMsg(e.message || "Couldn't refresh.");
    } finally {
      setBusy(false);
    }
  };

  let status = "Healthy",
    statusColor = "#3fb950";
  if (RISK) {
    const worstPct = pct(RISK.totalWorst),
      softPct = pct(RISK.softWorst);
    if (worstPct > 15 || softPct > riskBudgetPct) {
      status = "Over limit";
      statusColor = "#f85149";
    } else if (worstPct > 12 || softPct > riskBudgetPct * 0.8) {
      status = "Caution";
      statusColor = "#e8b339";
    }
  }

  return (
    <section className="wrap fade">
      <p className="lede">
        Your portfolio at a glance — health, distance to the 15% floor, and how it behaves if the
        market moves. Built from your tracked positions.
      </p>

      <div className="mon-bar">
        <button className="connect-btn" onClick={connected ? handleRefresh : handleConnect} disabled={busy}>
          {busy ? "Working…" : connected ? "Refresh" : "Connect Google Drive"}
        </button>
        {msg && <span className="pos-msg">{msg}</span>}
      </div>

      {!RISK && (
        <p className="pos-empty">
          No tracked positions yet. Build a trade in Construct and tap "I placed this — track it"
          {connected ? "." : ", then connect Drive here."}
        </p>
      )}

      {RISK && (
        <>
          <div className="health-card" style={{ borderColor: statusColor + "55" }}>
            <div className="health-status" style={{ color: statusColor }}>{status}</div>
            <div className="health-sub">
              {RISK.count} position{RISK.count === 1 ? "" : "s"} · {money(RISK.capital)} deployed of $
              {account.toLocaleString()}
            </div>
            <div className="health-gauges">
              <Gauge
                label="Worst case vs 15% floor"
                pct={pct(RISK.totalWorst)}
                cap={15}
                value={`${pct(RISK.totalWorst).toFixed(1)}%`}
              />
              <Gauge
                label={`Soft-floor vs ${riskBudgetPct}% budget`}
                pct={pct(RISK.softWorst)}
                cap={riskBudgetPct}
                value={`${pct(RISK.softWorst).toFixed(1)}%`}
                fill="#e8b339"
              />
            </div>
          </div>

          <div className="mon-grid">
            <MonStat label="Delta" value={Math.round(RISK.greeks.delta)} hint="≈ shares of exposure" />
            <MonStat label="Theta" value={`${RISK.greeks.theta >= 0 ? "+" : "−"}$${Math.abs(RISK.greeks.theta).toFixed(1)}`} hint="$ / day" />
            <MonStat label="Vega" value={`${RISK.greeks.vega >= 0 ? "+" : "−"}$${Math.abs(RISK.greeks.vega).toFixed(1)}`} hint="$ / 1% vol" />
            <MonStat label="Net premium" value={money(-RISK.netPremium)} hint={RISK.netPremium < 0 ? "collected" : "paid"} />
          </div>

          <div className="scenario">
            <div className="scenario-head">
              If the market moves{" "}
              <strong style={{ color: move < 0 ? "#f85149" : "#3fb950" }}>
                {move > 0 ? "+" : ""}
                {move}%
              </strong>{" "}
              tomorrow
            </div>
            {(() => {
              const pnl = RISK.pnlAtMove(move / 100);
              return (
                <div className="scenario-out">
                  <strong style={{ color: pnl < 0 ? "#f85149" : "#3fb950" }}>{money(pnl)}</strong>
                  <span>{pct(pnl).toFixed(1)}% of account</span>
                </div>
              );
            })()}
            <input type="range" min={-40} max={20} step={1} value={move} onChange={(e) => setMove(+e.target.value)} />
            <p className="risk-caveat">
              Structural estimate (positions as entered). Live P&amp;L and earnings dates arrive with
              broker data (Layer 4).
            </p>
          </div>

          <div className="mon-positions">
            <div className="risk-gap-head">Positions · tap to explain</div>
            {RISK.rebuilt.map(({ p, b, floor }) => (
              <div className="mon-pos" key={p.id}>
                <button className="mon-pos-row" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                  <span className="mon-pos-name">
                    {p.ticker ? `${p.ticker} · ` : ""}
                    {p.name}
                  </span>
                  <span
                    className="mon-pos-floor"
                    style={{ color: floor === "soft" ? "#e8b339" : floor === "hard" ? "#3fb950" : "#58a6ff" }}
                  >
                    {floor} floor
                  </span>
                </button>
                {openId === p.id && (
                  <div className="mon-pos-explain">
                    <p>{STRATEGY_LIB[p.strategyKey]?.note}</p>
                    <p className="mon-pos-meta">
                      Worst case {money(b.maxLoss)} · max gain{" "}
                      {b.maxGain === Infinity ? "unlimited" : money(b.maxGain)} · breakeven{" "}
                      {b.breakevens.map((x) => `$${x}`).join(" / ") || "—"}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
