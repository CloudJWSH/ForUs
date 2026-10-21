const DEX = "https://api.dexscreener.com/tokens/v1/solana/";
const cache = {fees: null, feesTs: 0, decimals: {[WSOL]: 9, [USDC]: 6}, usd: {}, meta: {}, quotes: {}, used: null, cool: {}};

async function rpc(url, method, params) {
  const r = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"},
                              body: JSON.stringify({jsonrpc: "2.0", id: 1, method, params})});
  if (!r.ok) throw new Error("RPC " + r.status);
  const j = await r.json();
  if (j.error) throw new Error("RPC " + (j.error.message || j.error.code));
  return j.result;
}

function rpcList(s) {
  return [...new Set([s.rpc || DEFAULTS.rpc, ...BACKUP_RPCS])];
}

async function rpcAny(s, method, params) {
  const list = rpcList(s);
  const ready = list.filter(u => !(cache.cool[u] > Date.now()));
  let last;
  for (const url of ready.length ? ready : list) {
    try {
      const res = await rpc(url, method, params);
      cache.used = url;
      return res;
    } catch (e) {
      last = e;
      cache.cool[url] = Date.now() + (/429|403|401/.test(e.message) ? 60000 : 15000);
    }
  }
  throw last || new Error("Kein Solana-Zugang erreichbar");
}

async function accounts(s, keys) {
  const res = await rpcAny(s, "getMultipleAccounts", [keys, {encoding: "base64", commitment: "processed"}]);
  return res.value.map(a => a ? fromBase64(a.data[0]) : null);
}

async function feeConfigs(s) {
  if (cache.fees && Date.now() - cache.feesTs < 600000) return cache.fees;
  const [curve, pool] = await accounts(s, [FEE_CONFIG_CURVE, FEE_CONFIG_POOL]);
  cache.fees = {curve: curve ? decodeFeeConfig(curve) : null, pool: pool ? decodeFeeConfig(pool) : null};
  cache.feesTs = Date.now();
  return cache.fees;
}

async function dexPairs(mint) {
  const r = await fetch(DEX + mint);
  if (!r.ok) throw new Error("DexScreener " + r.status);
  return (await r.json()) || [];
}

async function usdPrice(mint) {
  if (mint === USDC) return 1;
  const c = cache.usd[mint];
  if (c && Date.now() - c.ts < 60000) return c.v;
  let v = null;
  const pairs = await dexPairs(mint);
  if (mint === WSOL) {
    const usd = pairs.filter(p => p.baseToken.address === WSOL && ["USDC", "USDT"].includes(p.quoteToken.symbol) && p.liquidity);
    usd.sort((a, b) => (b.liquidity.usd || 0) - (a.liquidity.usd || 0));
    if (usd.length) v = Number(usd[0].priceNative);
  } else {
    const own = pairs.filter(p => p.baseToken.address === mint && p.priceUsd);
    own.sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0));
    if (own.length) v = Number(own[0].priceUsd);
  }
  if (v) cache.usd[mint] = {v, ts: Date.now()};
  return v || (c ? c.v : null);
}

async function meta(mint) {
  if (cache.meta[mint]) return cache.meta[mint];
  try {
    const pairs = await dexPairs(mint);
    const p = pairs.find(x => x.baseToken.address === mint);
    if (p) {
      cache.meta[mint] = {symbol: (p.baseToken.symbol || "").trim(), name: p.baseToken.name || "", quoteSym: p.quoteToken.symbol};
      return cache.meta[mint];
    }
  } catch (e) {}
  return {symbol: mint.slice(0, 6), name: ""};
}

async function decimals(s, mint) {
  if (cache.decimals[mint] != null) return cache.decimals[mint];
  const [m] = await accounts(s, [mint]);
  if (!m) throw new Error("Quote-Mint nicht gefunden");
  cache.decimals[mint] = mintInfo(m).decimals;
  return cache.decimals[mint];
}

function symbolOf(mint, m) {
  if (mint === WSOL) return "SOL";
  if (mint === USDC) return "USDC";
  return m || mint.slice(0, 4);
}

async function chainQuote(mint, s) {
  const bc = await bondingCurve(mint);
  const [curveRaw] = await accounts(s, [bc]);
  const fees = await feeConfigs(s).catch(() => ({}));
  const curve = curveRaw ? decodeCurve(curveRaw) : null;
  const quoteMint = curve ? curve.quoteMint : WSOL;
  const qd = await decimals(s, quoteMint);
  if (curve && !curve.complete && curve.vtok > 0n) {
    const mc = curve.vquote * curve.supply / curve.vtok;
    const f = fees.curve ? pickFees(fees.curve, quoteMint, mc, curve.creatorFeeBps) : {lp: 0, protocol: 95, creator: 30};
    return {phase: "kurve", quoteMint, qRes: Number(curve.vquote) / 10 ** qd, tRes: Number(curve.vtok) / 1e6, qd, bd: 6, curve: bc,
            supply: Number(curve.supply) / 1e6, fees: f, feeSource: fees.curve ? "Fee-Config" : "Standard", source: "Blockchain"};
  }
  const pool = await poolAddress(mint, quoteMint);
  const [poolRaw] = await accounts(s, [pool]);
  if (!poolRaw) throw new Error(curve ? "Kurve fertig, Pool noch nicht da" : "Coin nicht gefunden");
  const p = decodePool(poolRaw);
  const [baseVault, quoteVault, baseMint] = await accounts(s, [p.baseVault, p.quoteVault, mint]);
  const base = tokenAmount(baseVault);
  const quote = tokenAmount(quoteVault) + p.virtualQuote;
  const info = mintInfo(baseMint);
  const canonical = p.creator === await poolAuthority(mint);
  const mc = base > 0n ? quote * info.supply / base : 0n;
  const f = fees.pool ? pickFees(fees.pool, quoteMint, mc, p.creatorFeeBps, canonical) : {lp: 20, protocol: 5, creator: 0};
  return {phase: "pool", quoteMint, qRes: Number(quote) / 10 ** qd, tRes: Number(base) / 10 ** info.decimals, qd, bd: info.decimals,
          pool, baseVault: p.baseVault, quoteVault: p.quoteVault, raw: {base: Number(base), vault: Number(tokenAmount(quoteVault)), virt: Number(p.virtualQuote)},
          supply: Number(info.supply) / 10 ** info.decimals, fees: f, feeSource: fees.pool ? "Fee-Config" : "Standard", source: "Blockchain"};
}

async function dexQuote(mint) {
  const pairs = (await dexPairs(mint)).filter(p => p.baseToken.address === mint && Number(p.priceNative) > 0);
  if (!pairs.length) throw new Error("Kein Kurs gefunden");
  pairs.sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0));
  const p = pairs[0];
  const liq = p.liquidity || {};
  const price = Number(p.priceNative);
  const tRes = liq.base > 0 ? liq.base : 1e12;
  const qRes = liq.base > 0 ? liq.quote : price * 1e12;
  return {phase: p.dexId === "pumpfun" ? "kurve" : "pool", quoteMint: p.quoteToken.address, qRes, tRes, supply: 1e9,
          fees: p.dexId === "pumpfun" ? {lp: 0, protocol: 95, creator: 30} : {lp: 20, protocol: 5, creator: 0},
          feeSource: "Schätzung", source: liq.base > 0 ? "DexScreener" : "DexScreener, nur Preis"};
}

async function quote(mint, s, since) {
  const hit = cache.quotes[mint];
  if (hit && (since != null ? hit.ts >= since : Date.now() - hit.ts < 1500)) return hit;
  let q, err;
  try { q = await chainQuote(mint, s); } catch (e) { err = e; }
  if (!q) {
    try { q = await dexQuote(mint); } catch (e) { throw new Error(err ? err.message : e.message); }
  }
  const m = await meta(mint);
  const qm = q.quoteMint === WSOL || q.quoteMint === USDC ? {} : await meta(q.quoteMint);
  q.mint = mint;
  q.symbol = m.symbol || mint.slice(0, 6);
  q.name = m.name;
  q.quoteSym = symbolOf(q.quoteMint, qm.symbol || m.quoteSym);
  q.solUsd = await usdPrice(WSOL).catch(() => null);
  q.quoteUsd = q.quoteMint === WSOL ? q.solUsd : await usdPrice(q.quoteMint).catch(() => null);
  q.ts = Date.now();
  if (q.source === "Blockchain") {
    q.rpcHost = new URL(cache.used).host;
    q.backup = cache.used !== (s.rpc || DEFAULTS.rpc);
  }
  cache.quotes[mint] = q;
  return q;
}

function wsUrl(http) {
  return (cache.used || http || DEFAULTS.rpc).replace(/^http/, "ws");
}

class Live {
  constructor(mint, onQuote, onError) {
    this.mint = mint;
    this.onQuote = onQuote;
    this.onError = onError;
    this.closed = false;
    this.subs = {};
    this.start();
  }

  async start() {
    if (this.closed) return;
    let q, s;
    try {
      const {pp} = await chrome.storage.local.get("pp");
      s = {...DEFAULTS, ...((pp && pp.settings) || {})};
      cache.quotes[this.mint] = null;
      q = await quote(this.mint, s);
    } catch (e) {
      this.onError(e.message);
      this.retry(5000);
      return;
    }
    this.q = q;
    this.onQuote(q);
    if (q.source !== "Blockchain") {
      this.retry(4000);
      return;
    }
    const keys = q.phase === "kurve" ? [[q.curve, "curve"]] : [[q.pool, "pool"], [q.baseVault, "base"], [q.quoteVault, "quote"]];
    this.raw = q.raw ? {...q.raw} : null;
    const ws = new WebSocket(wsUrl(s.rpc));
    this.ws = ws;
    ws.onopen = () => keys.forEach(([k, kind], i) => {
      this.subs["id" + (i + 1)] = kind;
      ws.send(JSON.stringify({jsonrpc: "2.0", id: i + 1, method: "accountSubscribe", params: [k, {encoding: "base64", commitment: "processed"}]}));
    });
    ws.onmessage = e => {
      let m;
      try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.id && typeof m.result === "number") {
        this.subs[m.result] = this.subs["id" + m.id];
        return;
      }
      if (m.method !== "accountNotification") return;
      const kind = this.subs[m.params.subscription];
      const v = m.params.result && m.params.result.value;
      if (!kind || !v) return;
      this.update(kind, fromBase64(v.data[0]));
    };
    ws.onerror = () => { cache.cool[cache.used] = Date.now() + 15000; };
    ws.onclose = () => { if (this.ws === ws) this.retry(3000); };
  }

  update(kind, data) {
    const q = {...this.q};
    if (kind === "curve") {
      const c = decodeCurve(data);
      if (c.complete) {
        this.restart();
        return;
      }
      q.qRes = Number(c.vquote) / 10 ** q.qd;
      q.tRes = Number(c.vtok) / 1e6;
    } else {
      if (kind === "pool") this.raw.virt = Number(decodePool(data).virtualQuote);
      if (kind === "base") this.raw.base = Number(tokenAmount(data));
      if (kind === "quote") this.raw.vault = Number(tokenAmount(data));
      q.tRes = this.raw.base / 10 ** q.bd;
      q.qRes = (this.raw.vault + this.raw.virt) / 10 ** q.qd;
    }
    q.ts = Date.now();
    q.live = true;
    this.q = q;
    cache.quotes[this.mint] = q;
    this.onQuote(q);
  }

  restart() {
    const ws = this.ws;
    this.ws = null;
    if (ws) ws.close();
    this.retry(500);
  }

  retry(ms) {
    clearTimeout(this.timer);
    if (!this.closed) this.timer = setTimeout(() => this.start(), ms);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    if (ws) ws.close();
  }
}
