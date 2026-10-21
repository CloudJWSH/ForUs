importScripts("chain.js", "price.js", "quote.js");

let chain = Promise.resolve();

function locked(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function load() {
  const {pp} = await chrome.storage.local.get("pp");
  const st = pp || {};
  const old = st.settings || {};
  st.settings = {...DEFAULTS, ...old};
  if (!(old.model >= 14)) st.settings = {...st.settings, buffer: 0, model: 14};
  if (!st.wallet) st.wallet = {SOL: st.balance != null ? st.balance : st.settings.startSol, USDC: st.settings.startUsdc};
  delete st.balance;
  st.positions = st.positions || {};
  st.history = st.history || [];
  st.quotes = st.quotes || {};
  st.solUsd = st.solUsd || null;
  return st;
}

async function save(st) {
  st.history = st.history.slice(-2000);
  for (const m of Object.keys(st.quotes)) {
    if (!st.positions[m] && Date.now() - st.quotes[m].ts > 3600000) delete st.quotes[m];
  }
  await chrome.storage.local.set({pp: st});
}

async function fresh(st, mint, since) {
  const q = await quote(mint, st.settings, since);
  st.quotes[mint] = q;
  if (q.solUsd) st.solUsd = q.solUsd;
  return q;
}

async function landed(st, mint) {
  const wait = Math.max(0, Number(st.settings.delay) || 0) * 1000;
  if (!wait) return fresh(st, mint);
  const since = Date.now() + wait;
  await new Promise(r => setTimeout(r, wait));
  return fresh(st, mint, since);
}

function failed(st, q, side, why) {
  const s = st.settings;
  st.wallet.SOL -= s.priority;
  st.history.push({id: Date.now() + Math.random(), ts: Date.now(), mint: q.mint, symbol: q.symbol, side: "fehlgeschlagen", pay: payOf(q),
                   amount: 0, tokens: 0, fee: 0, gas: s.priority, reason: `${side}: ${why}`, mcUsd: mcOf(q) * (q.quoteUsd || 0),
                   quoteSym: q.quoteSym, feePct: feeOf(q, s) * 100, solUsd: q.solUsd});
  return `${side} gescheitert: ${why}. Kostet nur die Priority Fee (${fmtAmt(s.priority, "SOL")}).`;
}

function moved(a, b) {
  return fmt(Math.abs(b / a - 1) * 100, 1) + " %";
}

function doBuy(st, q, amount, seen) {
  const s = st.settings;
  const pay = payOf(q);
  const old = st.positions[q.mint];
  const rent = old ? 0 : Number(s.rent) || 0;
  if (!(amount > 0)) throw new Error("Betrag fehlt");
  if (amount > st.wallet[pay] + 1e-9) throw new Error(`Nicht genug ${pay}`);
  if (s.priority + rent > st.wallet.SOL - (pay === "SOL" ? amount : 0) + 1e-9) throw new Error("Nicht genug SOL für Priority Fee und Konto-Miete");
  const f = buyFill(q, amount, s);
  if (seen && s.slippage > 0) {
    const want = buyFill(seen, amount, s).tokens;
    if (f.tokens < want * (1 - s.slippage / 100)) return failed(st, q, "Kauf", `Kurs um ${moved(priceOf(seen), priceOf(q))} gestiegen, mehr als deine Slippage ${fmt(s.slippage, 0)} %`);
  }
  const price = priceOf(q);
  const p = old || {mint: q.mint, symbol: q.symbol, pay, quoteSym: q.quoteSym, tokens: 0, cost: 0, gas: 0, opened: Date.now(),
                    entryPrice: price, tp: s.tp, sl: s.sl, maxMin: s.maxMin, buys: 0};
  if (old && old.pay !== pay) throw new Error("Position in anderer Währung offen");
  p.entryPrice = (p.entryPrice * p.tokens + price * f.tokens) / (p.tokens + f.tokens);
  p.tokens += f.tokens;
  p.cost += amount;
  p.gas += s.priority + rent;
  p.buys += 1;
  st.positions[q.mint] = p;
  st.wallet[pay] -= amount;
  st.wallet.SOL -= s.priority + rent;
  st.history.push({id: Date.now() + Math.random(), ts: Date.now(), mint: q.mint, symbol: q.symbol, side: "kauf", pay, amount,
                   tokens: f.tokens, fee: f.fee, gas: s.priority + rent, rent, mcUsd: mcOf(q) * (q.quoteUsd || 0), quoteSym: q.quoteSym,
                   feePct: feeOf(q, s) * 100, solUsd: q.solUsd});
}

function doSell(st, q, share, reason, seen) {
  const s = st.settings;
  const p = st.positions[q.mint];
  if (!p) throw new Error("Keine Position");
  share = Math.min(1, Math.max(0, share));
  const all = share >= 0.999;
  const tokens = all ? p.tokens : p.tokens * share;
  const f = sellFill(q, tokens, s);
  if (seen && s.slippage > 0 && f.amount < sellFill(seen, tokens, s).amount * (1 - s.slippage / 100)) {
    return failed(st, q, "Verkauf", `Kurs um ${moved(priceOf(seen), priceOf(q))} gefallen, mehr als deine Slippage ${fmt(s.slippage, 0)} %`);
  }
  const part = tokens / p.tokens;
  const cost = p.cost * part, gas = p.gas * part;
  p.tokens -= tokens;
  p.cost -= cost;
  p.gas -= gas;
  st.wallet[p.pay] += f.amount;
  st.wallet.SOL -= s.priority;
  const pnl = f.amount - cost;
  st.history.push({id: Date.now() + Math.random(), ts: Date.now(), mint: q.mint, symbol: p.symbol, side: "verkauf", pay: p.pay,
                   amount: f.amount, tokens, fee: f.fee, gas: gas + s.priority, pnl, ret: cost ? pnl / cost : 0,
                   reason: reason || "von Hand", held: Date.now() - p.opened, mcUsd: mcOf(q) * (q.quoteUsd || 0),
                   quoteSym: q.quoteSym, feePct: feeOf(q, s) * 100, solUsd: q.solUsd});
  if (all || p.tokens <= 1e-6) delete st.positions[q.mint];
}

function exitReason(p, q) {
  const g = priceOf(q) / p.entryPrice - 1;
  if (p.tp && g >= p.tp / 100) return "Ziel";
  if (p.sl && g <= p.sl / 100) return "Stop";
  if (p.maxMin && Date.now() - p.opened >= p.maxMin * 60000) return "Zeit";
  return null;
}

async function checkAll(only) {
  return locked(async () => {
    const st = await load();
    const sold = [];
    if (only && !st.positions[only]) return sold;
    for (const p of Object.values(st.positions)) {
      if (only && p.mint !== only) continue;
      let q;
      try { q = await fresh(st, p.mint); } catch (e) { continue; }
      const why = exitReason(p, q);
      if (why) {
        try { q = await landed(st, p.mint); } catch (e) {}
        doSell(st, q, 1, why);
        sold.push({symbol: p.symbol, reason: why, pay: p.pay, amount: st.history[st.history.length - 1].amount});
      }
    }
    await save(st);
    return sold;
  });
}

async function memebotHint(mint) {
  const st = await load();
  const s = st.settings;
  if (!s.memebotPass || !s.memebotUrl) return null;
  const r = await fetch(s.memebotUrl.replace(/\/$/, "") + "/api/state", {
    headers: {Authorization: "Basic " + btoa("sophie:" + s.memebotPass)}
  });
  if (!r.ok) throw new Error("Memebot " + r.status);
  const h = (await r.json()).hinweise || {};
  const open = (h.open || []).find(x => x.mint === mint);
  if (open) return {...open, live: true};
  const old = (h.recent || []).find(x => x.mint === mint);
  return old ? {...old, live: false} : {none: true};
}

const ACTIONS = {
  get: () => load(),
  buy: m => locked(async () => {
    const st = await load();
    const seen = await fresh(st, m.mint);
    const bad = doBuy(st, await landed(st, m.mint), Number(m.amount), seen);
    await save(st);
    if (bad) throw new Error(bad);
    return st;
  }),
  sell: m => locked(async () => {
    const st = await load();
    const seen = await fresh(st, m.mint);
    const bad = doSell(st, await landed(st, m.mint), Number(m.share), m.reason, seen);
    await save(st);
    if (bad) throw new Error(bad);
    return st;
  }),
  rules: m => locked(async () => {
    const st = await load();
    const p = st.positions[m.mint];
    if (!p) throw new Error("Keine Position");
    for (const k of ["tp", "sl", "maxMin"]) if (m[k] !== undefined) p[k] = Number(m[k]) || 0;
    await save(st);
    return st;
  }),
  check: m => checkAll(m.mint),
  quote: m => locked(async () => {
    const st = await load();
    const q = await fresh(st, m.mint);
    await save(st);
    return q;
  }),
  settings: m => locked(async () => {
    const st = await load();
    st.settings = {...st.settings, ...m.settings};
    await save(st);
    return st;
  }),
  reset: () => locked(async () => {
    const st = await load();
    const s = st.settings;
    await chrome.storage.local.set({pp: {settings: s, wallet: {SOL: s.startSol, USDC: s.startUsdc}, positions: {}, history: [], quotes: {}, solUsd: st.solUsd}});
    return load();
  }),
  hint: m => memebotHint(m.mint),
  scout: async (m, sender) => {
    const host = sender && sender.url ? new URL(sender.url).hostname : "";
    if (!host.endsWith(".frame.claudeusercontent.com")) throw new Error("Unbekannte Quelle");
    const {scout} = await chrome.storage.local.get("scout");
    if (scout && scout.host && scout.host !== host) throw new Error("Anderes Scout-Board verbunden");
    await chrome.storage.local.set({scout: {host, ts: Date.now(), coins: m.coins || {}}});
    return true;
  },
  unscout: () => chrome.storage.local.remove("scout")
};

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  const fn = ACTIONS[m && m.op];
  if (!fn) return false;
  fn(m, sender).then(data => reply({ok: true, data}), e => reply({ok: false, error: String(e.message || e)}));
  return true;
});

const feeds = new Map();
const lastCheck = {};

function feedFor(mint) {
  let f = feeds.get(mint);
  if (f) return f;
  f = {ports: new Set(), live: null};
  const send = m => { for (const p of f.ports) { try { p.postMessage(m); } catch (e) {} } };
  f.live = new Live(mint, q => {
    send({q});
    if (Date.now() - (lastCheck[mint] || 0) > 1000) {
      lastCheck[mint] = Date.now();
      checkAll(mint).then(sold => { if (sold.length) send({sold}); }).catch(() => {});
    }
  }, error => send({error}));
  feeds.set(mint, f);
  return f;
}

function leave(port, mint) {
  const f = mint && feeds.get(mint);
  if (!f) return;
  f.ports.delete(port);
  if (!f.ports.size) {
    f.live.close();
    feeds.delete(mint);
  }
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "live") return;
  let mint = null;
  port.onMessage.addListener(m => {
    if (!m || !m.mint || m.mint === mint) return;
    leave(port, mint);
    mint = m.mint;
    const f = feedFor(mint);
    f.ports.add(port);
    if (f.live.q) port.postMessage({q: f.live.q});
  });
  port.onDisconnect.addListener(() => leave(port, mint));
});

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("check", {periodInMinutes: 0.5}));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("check", {periodInMinutes: 0.5}));
chrome.alarms.onAlarm.addListener(a => { if (a.name === "check") checkAll(null); });
