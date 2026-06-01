import React, { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { PayoffChart } from "../OptionsPrimer.jsx";
import {
  STRATEGY_LIB,
  STRATEGY_KEYS,
  defaultStrikes,
  buildStrategy,
} from "../strategies/library.js";
import { connectDrive, loadPositions, savePositions } from "../storage/googleDrive.js";

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

// Plain-language explanations, reused by both the tap-to-explain notes and the
// expandable guide. group: "input" = something you set · "output" = computed.
const EXPLAIN = {
  spot: { label: "Current price (spot)", group: "input", text: "Where the stock trades right now. Every number is measured against it. You set it here; once broker data is connected, it'll fill in automatically." },
  days: { label: "Days to expiry", group: "input", text: "How long until the option's deadline. More days means more time value — and so a bigger premium." },
  vol: { label: "Volatility", group: "input", text: "How much the stock is assumed to swing over a year. This is an assumption you set — NOT live market data yet (that arrives when broker data is connected). Higher volatility → bigger premium." },
  rate: { label: "Risk-free rate", group: "input", text: "The baseline interest rate the pricing model uses (think short-term government bonds). It only nudges the numbers slightly." },
  account: { label: "Account size", group: "input", text: "Your hypothetical account. It does NOT affect pricing — it's used only to judge whether a trade fits: the capital it needs, the % of your account, and how many you could afford." },
  strike: { label: "Strike", group: "input", text: "A price you lock in with the option — the level you'd buy or sell at. You choose it, and it's the main lever on a trade's risk and reward." },
  premium: { label: "Net premium / credit", group: "output", text: "The cash for the option legs. A credit (green) means you collect money up front for selling options; a debit (red) means you pay it. It's the leg premiums × 100 shares." },
  maxGain: { label: "Max gain", group: "output", text: "The most the trade can make at expiry, for one contract. 'Unlimited ↑' means the upside isn't capped." },
  maxLoss: { label: "Max loss", group: "output", text: "The most the trade can lose at expiry, for one contract. With a hard floor it's fixed in writing; with a soft floor an overnight gap can push past it." },
  breakeven: { label: "Breakeven", group: "output", text: "The stock price at expiry where you come out even. Move past it in your favour and you're in profit." },
  delta: { label: "Delta", group: "output", text: "Roughly how many shares of exposure you carry — how much the position gains or loses for each $1 the stock moves, near today's price." },
  theta: { label: "Theta", group: "output", text: "Time decay: how much the position gains or loses per day from time passing alone. Positive means time is working for you." },
  vega: { label: "Vega", group: "output", text: "Volatility sensitivity: how much you gain or lose if assumed volatility rises by 1%. Negative means rising volatility hurts this trade." },
  capital: { label: "Capital required", group: "output", text: "The cash to actually put the trade on — the shares net of option cash, or the cash at risk for an options-only trade. Compared with your account size to see if it fits." },
};

function Info({ k, explain, setExplain }) {
  return (
    <button
      className="info-btn"
      aria-label="Explain"
      onClick={(e) => {
        e.stopPropagation();
        setExplain(explain === k ? null : k);
      }}
    >
      i
    </button>
  );
}

function ExplainNote({ k, onClose }) {
  const e = EXPLAIN[k];
  if (!e) return null;
  return (
    <div className="explain-note">
      <div className="explain-note-head">
        <strong>{e.label}</strong>
        <button onClick={onClose} aria-label="Close">×</button>
      </div>
      <p>{e.text}</p>
    </div>
  );
}

export default function Construct() {
  const [key, setKey] = useState("collar");
  const [account, setAccount] = useState(25000);
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

  // Tracked positions, saved to the user's Google Drive.
  const [positions, setPositions] = useState([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Tap-to-explain + the expandable guide.
  const [explain, setExplain] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const info = (k) => <Info k={k} explain={explain} setExplain={setExplain} />;

  const handleConnect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await connectDrive();
      setPositions(await loadPositions());
      setConnected(true);
    } catch (e) {
      setMsg(e.message || "Couldn't connect to Drive.");
    } finally {
      setBusy(false);
    }
  };

  const handlePlace = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let current = positions;
      if (!connected) {
        await connectDrive();
        current = await loadPositions(); // pull existing before appending
        setConnected(true);
      }
      const pos = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        strategyKey: key,
        name: def.name,
        market: { ...market },
        strikes: { ...strikes },
        capitalRequired: Math.round(cap),
        maxLoss: built.maxLoss,
        placedAt: new Date().toISOString(),
      };
      const next = [pos, ...current];
      await savePositions(next);
      setPositions(next);
      setMsg("Saved to your Drive.");
    } catch (e) {
      setMsg(e.message || "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id) => {
    setBusy(true);
    setMsg(null);
    try {
      const next = positions.filter((p) => p.id !== id);
      await savePositions(next);
      setPositions(next);
    } catch (e) {
      setMsg(e.message || "Couldn't update.");
    } finally {
      setBusy(false);
    }
  };

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

  // Capital efficiency for a small account.
  const cap = built.capitalRequired;
  const pctOfAccount = account ? (cap / account) * 100 : 0;
  const contracts = cap > 0 ? Math.floor(account / cap) : 0;
  const overBudget = cap > account;
  const heavy = !overBudget && pctOfAccount > 60;

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

      <button className="guide-toggle" onClick={() => setGuideOpen((o) => !o)}>
        {guideOpen ? "▾" : "▸"} What am I looking at? — every input and number explained
      </button>
      {guideOpen && (
        <div className="guide">
          <div className="guide-group">What you set (inputs)</div>
          {Object.entries(EXPLAIN)
            .filter(([, e]) => e.group === "input")
            .map(([k, e]) => (
              <div className="guide-item" key={k}>
                <strong>{e.label}</strong>
                <p>{e.text}</p>
              </div>
            ))}
          <div className="guide-group">What the app computes (outputs)</div>
          {Object.entries(EXPLAIN)
            .filter(([, e]) => e.group === "output")
            .map(([k, e]) => (
              <div className="guide-item" key={k}>
                <strong>{e.label}</strong>
                <p>{e.text}</p>
              </div>
            ))}
        </div>
      )}

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
              info={info("premium")}
            />
            <StatPill label="Max gain" value={money(built.maxGain)} tone="#3fb950" info={info("maxGain")} />
            <StatPill label="Max loss" value={money(built.maxLoss)} tone="#f85149" info={info("maxLoss")} />
            <StatPill
              label={built.breakevens.length > 1 ? "Breakevens" : "Breakeven"}
              value={built.breakevens.length ? built.breakevens.map((b) => `$${b}`).join(" / ") : "—"}
              tone="#e8b339"
              info={info("breakeven")}
            />
          </div>

          <div className="greeks-row">
            <Greek label="Delta" value={Math.round(built.greeks.delta)} hint="≈ shares of exposure" info={info("delta")} />
            <Greek
              label="Theta"
              value={`${built.greeks.theta >= 0 ? "+" : "−"}$${Math.abs(built.greeks.theta).toFixed(1)}`}
              hint="$ / day from time"
              info={info("theta")}
            />
            <Greek
              label="Vega"
              value={`${built.greeks.vega >= 0 ? "+" : "−"}$${Math.abs(built.greeks.vega).toFixed(1)}`}
              hint="$ per 1% vol"
              info={info("vega")}
            />
          </div>

          {EXPLAIN[explain]?.group === "output" && (
            <ExplainNote k={explain} onClose={() => setExplain(null)} />
          )}

          <div className="cap-readout">
            <div className="cap-line">
              <span>Capital required {info("capital")}</span>
              <strong style={{ color: overBudget ? "#f85149" : "#e6ebf2" }}>
                ${Math.round(cap).toLocaleString()}
              </strong>
            </div>
            <p className={overBudget ? "cap-note over" : "cap-note"}>
              {overBudget
                ? `More than your $${account.toLocaleString()} account — too big as one contract. Try cheaper strikes, a smaller account target, or a more capital-efficient structure (spreads cost far less than owning shares).`
                : `${pctOfAccount.toFixed(0)}% of your $${account.toLocaleString()} account · room for about ${contracts} contract${contracts === 1 ? "" : "s"}.${heavy ? " That's a big chunk for one position." : ""}`}
            </p>
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

          <button className="place-btn" onClick={handlePlace} disabled={busy}>
            {busy ? "Working…" : "I placed this — track it"}
          </button>
        </div>

        <div className="sim-controls">
          <div className="ctrl-head">The market</div>
          <Slider label="Current price" val={market.spot} suffix="" prefix="$" min={50} max={200} step={1} onChange={(v) => setM("spot", v)} tone="#58a6ff" info={info("spot")} />
          <Slider label="Days to expiry" val={market.days} suffix=" d" prefix="" min={7} max={365} step={1} onChange={(v) => setM("days", v)} info={info("days")} />
          <Slider label="Volatility" val={Math.round(market.vol * 100)} suffix="%" prefix="" min={5} max={120} step={1} onChange={(v) => setM("vol", v / 100)} info={info("vol")} />
          <Slider label="Risk-free rate" val={+(market.rate * 100).toFixed(2)} suffix="%" prefix="" min={0} max={8} step={0.25} onChange={(v) => setM("rate", v / 100)} info={info("rate")} />

          <div className="ctrl-head" style={{ marginTop: 18 }}>Your account</div>
          <Slider label="Account size" val={account} prefix="$" suffix="" min={5000} max={50000} step={1000} onChange={setAccount} tone="#3fb950" info={info("account")} />

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
              info={info("strike")}
            />
          ))}

          {EXPLAIN[explain]?.group === "input" && (
            <ExplainNote k={explain} onClose={() => setExplain(null)} />
          )}

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

      <div className="positions">
        <div className="pos-head">
          <span>Your positions</span>
          <span className="pos-sub">
            {connected ? "saved to your Google Drive" : "connect Drive to save & sync across devices"}
          </span>
        </div>
        {!connected && (
          <button className="connect-btn" onClick={handleConnect} disabled={busy}>
            {busy ? "Connecting…" : "Connect Google Drive"}
          </button>
        )}
        {msg && <p className="pos-msg">{msg}</p>}
        {connected && positions.length === 0 && (
          <p className="pos-empty">
            No tracked positions yet. Build a trade above and tap "I placed this — track it".
          </p>
        )}
        {positions.map((p) => (
          <div className="pos-row" key={p.id}>
            <div className="pos-info">
              <strong>{p.name}</strong>
              <span className="pos-meta">
                ${p.market.spot} spot · {p.market.days}d ·{" "}
                {Object.values(p.strikes).map((s) => `$${s}`).join(" / ")} · cap $
                {p.capitalRequired.toLocaleString()}
              </span>
            </div>
            <button className="pos-del" onClick={() => handleRemove(p.id)} disabled={busy} aria-label="Remove position">
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatPill({ label, value, tone, info }) {
  return (
    <div className="pill">
      <span className="pill-label">
        {label}
        {info}
      </span>
      <span className="pill-value" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

function Greek({ label, value, hint, info }) {
  return (
    <div className="greek">
      <span className="greek-val">{value}</span>
      <span className="greek-label">
        {label}
        {info}
      </span>
      <span className="greek-hint">{hint}</span>
    </div>
  );
}

function Slider({ label, val, min, max, step, onChange, prefix = "", suffix = "", tone = "#e8b339", info }) {
  return (
    <div className="ctrl">
      <div className="ctrl-top">
        <label>
          {label}
          {info}
        </label>
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
