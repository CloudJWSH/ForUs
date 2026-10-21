// Strategie-Labor, Rechenteil: Format der Strategie-Datei prüfen, als Satz beschreiben und auf Papier testen.
// Nur Simulation: hier wird nichts gekauft. Läuft im Browser (window.PPStrategie) und in Node für die Tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./kurve.js"));
  else root.PPStrategie = factory(root.PPKurve);
})(typeof self !== "undefined" ? self : this, function (P) {
  const FORMAT = "pump-paper-strategy", VERSION = 1;

  // Grenzen je Feld: [min, max]. null heißt "aus".
  const LIMITS = {
    "entry.mcUsd.min": [0, 1e8], "entry.mcUsd.max": [0, 1e8],
    "entry.progress.min": [0, 100], "entry.progress.max": [0, 100],
    "entry.ageMin.min": [0, 1440], "entry.ageMin.max": [0, 1440],
    "size.value": [0.001, 1000],
    "exit.targetPct": [1, 10000], "exit.stopPct": [1, 100], "exit.timeMin": [1, 1440],
    "exit.trailingPct": [1, 100], "exit.partial.sellPct": [1, 99],
    "limits.maxOpen": [1, 50], "limits.pauseAfterLosses.count": [1, 50], "limits.pauseAfterLosses.minutes": [1, 1440],
    "execution.delaySec": [0, 30], "execution.slippagePct": [0.1, 100], "execution.priorityFee": [0, 0.1],
  };

  const DEFAULT = {
    format: FORMAT, version: VERSION, name: "Meine Strategie", note: "",
    entry: {mcUsd: {min: 5000, max: 20000}, progress: {min: 0, max: 60}, ageMin: {min: 0, max: 30}},
    size: {mode: "sol", value: 0.25},
    exit: {targetPct: 60, stopPct: 20, timeMin: 10, trailingPct: null, partial: null},
    limits: {maxOpen: 3, pauseAfterLosses: null},
    execution: {delaySec: 1, slippagePct: 10, priorityFee: 0.001},
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const TEMPLATES = {
    frueh: Object.assign(clone(DEFAULT), {name: "Früh rein, schnell raus",
      entry: {mcUsd: {min: 0, max: 8000}, progress: {min: 0, max: 15}, ageMin: {min: 0, max: 3}},
      exit: {targetPct: 30, stopPct: 15, timeMin: 5, trailingPct: null, partial: null}}),
    migration: Object.assign(clone(DEFAULT), {name: "Nur nahe Migration",
      entry: {mcUsd: {min: 30000, max: 80000}, progress: {min: 70, max: 95}, ageMin: {min: 0, max: 60}},
      exit: {targetPct: 25, stopPct: 12, timeMin: 15, trailingPct: null, partial: null}}),
    weit: Object.assign(clone(DEFAULT), {name: "Kleiner Einsatz, weites Ziel",
      size: {mode: "sol", value: 0.1},
      exit: {targetPct: 200, stopPct: 35, timeMin: 30, trailingPct: 25, partial: {sellPct: 50}}}),
    streng: Object.assign(clone(DEFAULT), {name: "Strenger Stop",
      exit: {targetPct: 40, stopPct: 8, timeMin: 8, trailingPct: null, partial: null},
      limits: {maxOpen: 2, pauseAfterLosses: {count: 3, minutes: 30}}}),
  };
  const TEMPLATE_EN = {frueh: "Early in, quick out", migration: "Only near migration", weit: "Small size, wide target", streng: "Tight stop"};

  const get = (o, path) => path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);

  // Prüft eine Strategie Feld für Feld. Gibt die bereinigte Strategie und alle Fehler zurück.
  function validate(input, en) {
    const errors = [];
    const err = (field, de, eng) => errors.push({field, text: en ? eng : de});
    let s = input;
    if (typeof s === "string") {
      try { s = JSON.parse(s); } catch (e) { return {ok: false, errors: [{field: "", text: en ? "Not valid JSON." : "Kein gültiges JSON."}]}; }
    }
    if (!s || typeof s !== "object" || Array.isArray(s)) return {ok: false, errors: [{field: "", text: en ? "Not a strategy object." : "Keine Strategie."}]};
    if (s.format !== FORMAT) err("format", `"format" muss "${FORMAT}" sein.`, `"format" must be "${FORMAT}".`);
    if (s.version !== VERSION) err("version", `Unbekannte Version ${s.version}, unterstützt wird ${VERSION}.`, `Unknown version ${s.version}, supported is ${VERSION}.`);
    const out = clone(DEFAULT);
    out.name = String(s.name || out.name).slice(0, 60);
    out.note = String(s.note || "").slice(0, 500);
    // Nur bekannte Felder werden übernommen; Wallets, Schlüssel oder Server-Adressen haben im Format keinen Platz.
    const known = new Set(["format", "version", "name", "note", "entry", "size", "exit", "limits", "execution"]);
    for (const k of Object.keys(s)) if (!known.has(k)) err(k, `Unbekanntes Feld "${k}" wird ignoriert.`, `Unknown field "${k}" is ignored.`);
    const num = (path, optional) => {
      const v = get(s, path);
      if (v === undefined) return get(DEFAULT, path);
      if (v === null && optional) return null;
      const n = Number(v);
      const [lo, hi] = LIMITS[path];
      if (!isFinite(n)) { err(path, `${path}: keine Zahl.`, `${path}: not a number.`); return get(DEFAULT, path); }
      if (n < lo || n > hi) { err(path, `${path}: muss zwischen ${lo} und ${hi} liegen.`, `${path}: must be between ${lo} and ${hi}.`); return Math.min(hi, Math.max(lo, n)); }
      return n;
    };
    for (const key of ["mcUsd", "progress", "ageMin"]) {
      out.entry[key] = {min: num(`entry.${key}.min`), max: num(`entry.${key}.max`)};
      if (out.entry[key].min > out.entry[key].max) err(`entry.${key}`, `entry.${key}: min ist größer als max.`, `entry.${key}: min is larger than max.`);
    }
    const mode = get(s, "size.mode") ?? "sol";
    if (!["sol", "percent"].includes(mode)) err("size.mode", `size.mode muss "sol" oder "percent" sein.`, `size.mode must be "sol" or "percent".`);
    out.size = {mode: mode === "percent" ? "percent" : "sol", value: num("size.value")};
    if (out.size.mode === "percent" && out.size.value > 100) err("size.value", "size.value: höchstens 100 %.", "size.value: at most 100 %.");
    out.exit.targetPct = num("exit.targetPct", true);
    out.exit.stopPct = num("exit.stopPct", true);
    out.exit.timeMin = num("exit.timeMin", true);
    out.exit.trailingPct = num("exit.trailingPct", true);
    const partial = get(s, "exit.partial");
    out.exit.partial = partial ? {sellPct: num("exit.partial.sellPct")} : null;
    if (out.exit.partial && out.exit.targetPct == null) err("exit.partial", "Teilverkauf braucht ein Ziel.", "A partial sell needs a target.");
    out.limits.maxOpen = Math.round(num("limits.maxOpen"));
    const pause = get(s, "limits.pauseAfterLosses");
    out.limits.pauseAfterLosses = pause ? {count: Math.round(num("limits.pauseAfterLosses.count")), minutes: num("limits.pauseAfterLosses.minutes")} : null;
    out.execution = {delaySec: num("execution.delaySec"), slippagePct: num("execution.slippagePct"), priorityFee: num("execution.priorityFee")};
    const fatal = errors.filter(e => !/ignoriert|ignored/.test(e.text));
    return {ok: fatal.length === 0, errors, strategy: out};
  }

  // Die Regeln als lesbarer Satz.
  function describe(s, en) {
    const n = (x, d = 0) => Number(x).toLocaleString(en ? "en-US" : "de-DE", {maximumFractionDigits: d});
    const usd = x => "$" + n(x);
    const e = s.entry, x = s.exit;
    const size = s.size.mode === "percent" ? `${n(s.size.value, 1)} %${en ? " of the balance" : " vom Guthaben"}` : `${n(s.size.value, 3)} SOL`;
    const parts = [];
    if (en) {
      parts.push(`Buy ${size} when the market cap is ${usd(e.mcUsd.min)}–${usd(e.mcUsd.max)}, the curve is ${n(e.progress.min)}–${n(e.progress.max)} % full and the coin is ${n(e.ageMin.min)}–${n(e.ageMin.max)} min old.`);
      const out = [];
      if (x.targetPct != null) out.push(x.partial ? `sell ${n(x.partial.sellPct)} % at +${n(x.targetPct)} %` : `sell at +${n(x.targetPct)} %`);
      if (x.trailingPct != null) out.push(`trail ${n(x.trailingPct)} % below the high`);
      if (x.stopPct != null) out.push(`stop at −${n(x.stopPct)} %`);
      if (x.timeMin != null) out.push(`sell after ${n(x.timeMin)} min`);
      parts.push(out.length ? "Then " + out.join(", ") + "." : "Then hold until the coin ends.");
      parts.push(`At most ${s.limits.maxOpen} open at once` + (s.limits.pauseAfterLosses ? `, pause ${n(s.limits.pauseAfterLosses.minutes)} min after ${s.limits.pauseAfterLosses.count} losses in a row.` : "."));
    } else {
      parts.push(`Kaufe ${size}, wenn der Marktwert ${usd(e.mcUsd.min)} bis ${usd(e.mcUsd.max)} beträgt, die Kurve zu ${n(e.progress.min)} bis ${n(e.progress.max)} % voll ist und der Coin ${n(e.ageMin.min)} bis ${n(e.ageMin.max)} Min. alt ist.`);
      const out = [];
      if (x.targetPct != null) out.push(x.partial ? `bei +${n(x.targetPct)} % ${n(x.partial.sellPct)} % verkaufen` : `bei +${n(x.targetPct)} % verkaufen`);
      if (x.trailingPct != null) out.push(`${n(x.trailingPct)} % unter dem Hoch nachziehen`);
      if (x.stopPct != null) out.push(`Stop bei −${n(x.stopPct)} %`);
      if (x.timeMin != null) out.push(`nach ${n(x.timeMin)} Min. verkaufen`);
      parts.push(out.length ? "Dann " + out.join(", ") + "." : "Dann halten, bis der Coin endet.");
      parts.push(`Höchstens ${s.limits.maxOpen} gleichzeitig offen` + (s.limits.pauseAfterLosses ? `, nach ${s.limits.pauseAfterLosses.count} Verlusten in Folge ${n(s.limits.pauseAfterLosses.minutes)} Min. Pause.` : "."));
    }
    return parts.join(" ");
  }

  const SYL = ["pe", "po", "mo", "ka", "ru", "zi", "lo", "fro", "sun", "do", "ge", "bo", "mi", "ta", "nu", "wa"];
  const name = rand => (SYL[Math.floor(rand() * 16)] + SYL[Math.floor(rand() * 16)] + (rand() < 0.4 ? SYL[Math.floor(rand() * 16)] : "")).toUpperCase();

  // Test auf simulierten Coins. Ein Coin startet alle `every` Sekunden, jeder wird höchstens einmal gekauft.
  function backtest(s, opt = {}) {
    const o = Object.assign({seed: 1, coins: 120, scenario: "normal", solUsd: 180, start: 10, every: 45, hold: false}, opt);
    const rand = P.rng(o.seed);
    const coins = [];
    for (let i = 0; i < o.coins; i++) {
      const c = P.coin(rand, o.scenario);
      coins.push({id: i, name: name(rand), t0: i * o.every, path: c.path, end: c.end, done: false, pos: null, pending: null});
    }
    const ex = s.execution, X = o.hold ? {targetPct: null, stopPct: null, timeMin: null, trailingPct: null, partial: null} : s.exit;
    const delay = Math.round(ex.delaySec), slip = ex.slippagePct / 100, prio = ex.priorityFee;
    let cash = o.start, open = 0, streak = 0, pausedUntil = -1;
    const trades = [], equity = [{t: 0, v: o.start}];
    const cost = {fee: 0, prio: 0, rent: 0};
    let failed = 0, signals = 0;
    const at = (c, t) => P.state(c.path[Math.min(c.path.length - 1, Math.max(0, t - c.t0))]);
    const mcUsd = st => P.mcSol(st) * o.solUsd;
    const endT = coins.length ? coins[coins.length - 1].t0 + Math.max(...coins.map(c => c.path.length)) + delay + 2 : 0;

    function close(c, t, frac, reason) {
      const p = c.pos, st = at(c, t + delay);
      const tok = frac >= 1 ? p.tokens : p.tokens * frac;
      const r = P.sell(st, tok);
      cash += r.sol - prio;
      cost.fee += r.fee; cost.prio += prio;
      p.tokens -= tok; p.back += r.sol - prio; p.reasons.push(reason);
      if (p.tokens <= 1e-6) {
        const pnl = p.back - p.cost;
        trades.push({coin: c.name, mcIn: p.mcIn, mcOut: mcUsd(st), reason: p.reasons.join(" + "), pnl, ret: pnl / p.cost, held: t + delay - p.t, t: t + delay});
        equity.push({t: t + delay, v: cash});
        c.pos = null; c.done = true; open--;
        if (pnl < 0) {
          streak++;
          const pl = s.limits.pauseAfterLosses;
          if (pl && streak >= pl.count) { pausedUntil = t + pl.minutes * 60; streak = 0; }
        } else streak = 0;
      }
    }

    for (let t = 0; t <= endT; t++) {
      for (const c of coins) {
        if (c.done || t < c.t0) continue;
        const age = t - c.t0, last = age >= c.path.length - 1;
        // Offener Kauf: nach der Verzögerung zum dann gültigen Kurs, mit Slippage-Grenze.
        if (c.pending && t >= c.pending.at) {
          const pd = c.pending; c.pending = null;
          const fill = P.buy(at(c, t), pd.sol);
          if (fill.tokens < pd.want * (1 - slip) || fill.tokens <= 0) {
            cash -= prio; cost.prio += prio; failed++; open--; c.done = true;
            trades.push({coin: c.name, mcIn: pd.mc, mcOut: null, reason: "fail", pnl: -prio, ret: -prio / pd.sol, held: 0, t, failed: true});
            equity.push({t, v: cash});
            continue;
          }
          const spent = pd.sol + prio + P.RENT;
          cash -= spent; cost.fee += pd.sol * P.FEE; cost.prio += prio; cost.rent += P.RENT;
          const st = fill.next;
          c.pos = {tokens: fill.tokens, cost: spent, back: 0, entry: P.price(st), peak: P.price(st), t, mcIn: mcUsd(st), reasons: [], partDone: false};
          continue;
        }
        if (c.pos) {
          const st = at(c, t), pr = P.price(st), p = c.pos;
          p.peak = Math.max(p.peak, pr);
          const ret = pr / p.entry - 1;
          if (last) { close(c, t, 1, c.end === "migriert" ? "migration" : "end"); continue; }
          if (X.targetPct != null && !p.partDone && ret >= X.targetPct / 100) {
            if (X.partial) { p.partDone = true; close(c, t, X.partial.sellPct / 100, "target-part"); if (!c.pos) continue; }
            else { close(c, t, 1, "target"); continue; }
          }
          if (X.trailingPct != null && (!X.partial || p.partDone) && pr <= p.peak * (1 - X.trailingPct / 100) && p.peak > p.entry) { close(c, t, 1, "trailing"); continue; }
          if (X.stopPct != null && ret <= -X.stopPct / 100) { close(c, t, 1, "stop"); continue; }
          if (X.timeMin != null && t - p.t >= X.timeMin * 60) { close(c, t, 1, "time"); continue; }
          continue;
        }
        if (c.pending || last) { if (last) c.done = true; continue; }
        // Einstieg prüfen.
        const st = at(c, t), mc = mcUsd(st), pg = P.progress(st) * 100, e = s.entry;
        if (mc < e.mcUsd.min || mc > e.mcUsd.max || pg < e.progress.min || pg > e.progress.max) continue;
        if (age / 60 < e.ageMin.min) continue;
        if (age / 60 > e.ageMin.max) { c.done = true; continue; }
        signals++;
        if (t < pausedUntil || open >= s.limits.maxOpen) continue;
        const sol = s.size.mode === "percent" ? cash * s.size.value / 100 : s.size.value;
        if (sol < 0.001 || sol + prio + P.RENT > cash) continue;
        c.pending = {at: t + delay, sol, want: P.buy(st, sol).tokens, mc};
        open++;
      }
    }
    return {trades, equity, cost, failed, signals, coins: coins.length, start: o.start, end: cash, stats: stats(trades, equity, o.start)};
  }

  function stats(trades, equity, start) {
    const done = trades.filter(t => !t.failed);
    const wins = done.filter(t => t.pnl > 0), losses = done.filter(t => t.pnl <= 0);
    const sumW = wins.reduce((a, t) => a + t.pnl, 0), sumL = -losses.reduce((a, t) => a + t.pnl, 0);
    let peak = start, dd = 0, ddPct = 0;
    for (const p of equity) { peak = Math.max(peak, p.v); dd = Math.max(dd, peak - p.v); ddPct = Math.max(ddPct, peak ? (peak - p.v) / peak : 0); }
    const pnl = trades.reduce((a, t) => a + t.pnl, 0);
    return {n: done.length, wins: wins.length, hit: done.length ? wins.length / done.length : 0, pnl,
            pf: sumL ? sumW / sumL : (sumW ? Infinity : 0), avgWin: wins.length ? sumW / wins.length : 0,
            avgLoss: losses.length ? -sumL / losses.length : 0, dd, ddPct,
            held: done.length ? done.reduce((a, t) => a + t.held, 0) / done.length : 0};
  }

  // Einstiegsregeln auf eigene Papier-Trades aus der CSV anwenden: welche Käufe hätte die Strategie erlaubt?
  // Fortschritt und Alter stehen nicht in der CSV, dort zählt nur der Marktwert beim Kauf.
  function csvTest(s, rows) {
    const lastBuy = {}, all = [], kept = [];
    for (const r of rows) {
      if (r.side === "kauf") lastBuy[r.mint] = lastBuy[r.mint] || r;
      if (r.side === "verkauf" && lastBuy[r.mint]) {
        const b = lastBuy[r.mint]; delete lastBuy[r.mint];
        const solUsd = r.solUsd || b.solUsd || 180;
        const pnl = r.pay === "USDC" ? r.pnl / solUsd : r.pnl;
        const t = {coin: r.symbol, mcIn: b.mcUsd, mcOut: r.mcUsd, reason: r.reason, pnl, ret: r.ret, held: (r.ts - b.ts) / 1000};
        all.push(t);
        if (b.mcUsd >= s.entry.mcUsd.min && b.mcUsd <= s.entry.mcUsd.max) kept.push(t);
      }
    }
    const sum = l => {
      const st = stats(l, [], 0);
      return st;
    };
    return {all: sum(all), kept: sum(kept), keptTrades: kept, allTrades: all};
  }

  return {FORMAT, VERSION, LIMITS, DEFAULT, TEMPLATES, TEMPLATE_EN, validate, describe, backtest, csvTest, clone};
});
