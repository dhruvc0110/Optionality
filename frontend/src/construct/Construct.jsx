import React, { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { PayoffChart } from "../OptionsPrimer.jsx";
import {
  STRATEGY_LIB,
  STRATEGY_KEYS,
  defaultStrikes,
  buildStrategy,
} from "../strategies/library.js";

const floorColor = (f) =>
  f === "hard" ? "#3fb950" : f === "defined" ? "#58a6ff" : "#e8b339";
const floorLabel = (f) =>
  f === "hard" ? "Hard floor" : f === "defined" ? "Defined risk" : "Soft floor";

const money = (v) =>
  v === Infinity
    ? "Unlimited ↑"
    : v === -Infinity
    ? "Unlimited ↓"
    : `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString()}`;

const legDesc = (l) =>
  l.kind === "stock"
    ? "100 shares"
    : `${l.kind === "call" ? "CALL" : "PUT"} $${l.strike}`;

export default function Construct() {
  const [key, setKey] = useState("collar");
  const [market, setMarket] = useState({ spot: 100, days: 90, vol: 0.25, rate: 0.04, q: 0 });
  const [allStrikes, setAllStrikes] = useState(() => {
    const o = {};
    for (const k of STRATEGY_KEYS) o[k] = defaultStrikes(k, 100);
    return o;
  });

  const strikes = allStrikes[key];
  const setStrike = (sk, v) =>
    setAllStrikes((p) => ({ ...p, [key]: { ...p[key], [sk]: v } }));
  const setM = (field, v) => setMarket((p) => ({ ...p, [field]: v }));

  const built = useMemo(() => buildStrategy(key, strikes, market), [key, strikes, market]);

  const chartData = useMemo(() => {
    const lo = Math.max(1, market.spot * 0.55);
    const hi = market.spot * 1.45;
    const N = 90;
    const data = [];
    for (let i = 0; i <= N; i++) {
      const S = lo + ((hi - lo) * i) / N;
      data.push({ price: +S.toFixed(2), pnl: +built.pnlAt(S).toFixed(2) });
    }
    return data;
  }, [built, market.spot]);

  const def = STRATEGY_LIB[key];
  const np = built.netOptionPremium;

  return (
    <section className="wrap fade">
      <p className="lede">
        Build a real trade and price it. Pick the structure, set the{" "}
        <em>market</em> and your strikes — the model prices every leg, then shows what it
        costs, how it behaves, and whether its floor is{" "}
        <strong style={{ color: "#3fb950" }}>hard</strong> or{" "}
        <strong style={{ color: "#e8b339" }}>soft</strong>.
      </p>

      <div className="sim-strats">
        {STRATEGY_KEYS.map((k) => (
          <button key={k} className={k === key ? "chip on" : "chip"} onClick={() => setKey(k)}>
            {STRATEGY_LIB[k].name}
          </button>
        ))}
      </div>

      <div className="sim-grid">
        <div className="sim-chart-card">
          <div className="sim-chart-head">
            <div>
              <h3>{def.name}</h3>
              <span>{def.stance}</span>
            </div>
            <span
              className="risk-tag"
              style={{ color: floorColor(def.floor), borderColor: floorColor(def.floor) }}
            >
              {floorLabel(def.floor)}
            </span>
          </div>

          <PayoffChart data={chartData} bes={built.breakevens} spot={market.spot} height={280} />

          <div className="sim-stats">
            <StatPill
              label={np < 0 ? "Net credit" : "Net premium"}
              value={money(Math.abs(np)) + (np < 0 ? " in" : " out")}
              tone={np < 0 ? "#3fb950" : "#f85149"}
            />
            <StatPill label="Max gain" value={money(built.maxGain)} tone="#3fb950" />
            <StatPill label="Max loss" value={money(built.maxLoss)} tone="#f85149" />
            <StatPill
              label={built.breakevens.length > 1 ? "Breakevens" : "Breakeven"}
              value={built.breakevens.length ? built.breakevens.map((b) => `$${b}`).join(" / ") : "—"}
              tone="#e8b339"
            />
          </div>

          <div className="greeks-row">
            <Greek label="Delta" value={Math.round(built.greeks.delta)} hint="≈ shares of exposure" />
            <Greek
              label="Theta"
              value={`${built.greeks.theta >= 0 ? "+" : "−"}$${Math.abs(built.greeks.theta).toFixed(1)}`}
              hint="$ / day from time"
            />
            <Greek
              label="Vega"
              value={`${built.greeks.vega >= 0 ? "+" : "−"}$${Math.abs(built.greeks.vega).toFixed(1)}`}
              hint="$ per 1% vol"
            />
          </div>

          <div className="legs">
            <div className="legs-head">Legs (priced)</div>
            {built.legs.map((l, i) => (
              <div className="leg-row" key={i}>
                <span className={`leg-dir ${l.dir}`}>{l.dir === "long" ? "BUY" : "SELL"}</span>
                <span className="leg-desc">{legDesc(l)}</span>
                <span className="leg-prem">
                  {l.kind === "stock" ? `@ $${l.entry}` : `@ $${l.premium.toFixed(2)}`}
                </span>
              </div>
            ))}
            {built.stockOutlay > 0 && (
              <div className="legs-foot">
                Shares cost <strong>${built.stockOutlay.toLocaleString()}</strong> to buy.
              </div>
            )}
          </div>

          {def.floor === "soft" && (
            <div className="warn">
              <AlertTriangle size={14} />
              <span>
                Soft floor: this max loss assumes an orderly market. An overnight gap can push
                the loss well past it — there's no bought option underneath to stop the fall.
              </span>
            </div>
          )}
          {def.note && <p className="construct-note">{def.note}</p>}
        </div>

        <div className="sim-controls">
          <div className="ctrl-head">The market</div>
          <Slider label="Current price" val={market.spot} suffix="" prefix="$" min={50} max={200} step={1} onChange={(v) => setM("spot", v)} tone="#58a6ff" />
          <Slider label="Days to expiry" val={market.days} suffix=" d" prefix="" min={7} max={365} step={1} onChange={(v) => setM("days", v)} />
          <Slider label="Volatility" val={Math.round(market.vol * 100)} suffix="%" prefix="" min={5} max={120} step={1} onChange={(v) => setM("vol", v / 100)} />
          <Slider label="Risk-free rate" val={+(market.rate * 100).toFixed(2)} suffix="%" prefix="" min={0} max={8} step={0.25} onChange={(v) => setM("rate", v / 100)} />

          <div className="ctrl-head" style={{ marginTop: 18 }}>Your strikes</div>
          {def.strikes.map((s) => (
            <Slider
              key={s.key}
              label={s.label}
              val={strikes[s.key]}
              prefix="$"
              suffix=""
              min={50}
              max={200}
              step={1}
              onChange={(v) => setStrike(s.key, v)}
            />
          ))}

          <button
            className="reset"
            onClick={() => setAllStrikes((p) => ({ ...p, [key]: defaultStrikes(key, market.spot) }))}
          >
            Reset strikes to defaults
          </button>
          <p className="sim-note">
            Premiums are the model's <em>theoretical</em> value (Black-Scholes) from your inputs.
            Real fills differ; live-market implied volatility comes when broker data is connected.
          </p>
        </div>
      </div>
    </section>
  );
}

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

function Greek({ label, value, hint }) {
  return (
    <div className="greek">
      <span className="greek-val">{value}</span>
      <span className="greek-label">{label}</span>
      <span className="greek-hint">{hint}</span>
    </div>
  );
}

function Slider({ label, val, min, max, step, onChange, prefix = "", suffix = "", tone = "#e8b339" }) {
  return (
    <div className="ctrl">
      <div className="ctrl-top">
        <label>{label}</label>
        <span className="ctrl-val" style={{ color: tone }}>
          {prefix}
          {val}
          {suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}
