// Coin-Abschnitt: Marktwert von DexScreener, Dev-Anteil, größte Konten, Umlauf und Kurvenfortschritt direkt von der Blockchain.
// Nur lesende Abfragen, nichts davon braucht ein Wallet.
(function () {
  const root = document.getElementById("coin-live");
  if (!root) return;
  const EN = document.documentElement.lang === "en";
  const loc = EN ? "en-US" : "de-DE";
  const mint = root.dataset.mint, dev = root.dataset.dev;
  const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
  // pump.fun: 1 Mrd. Token, davon 793,1 Mio. auf der Kurve verkäuflich, 206,9 Mio. bleiben für den Pool.
  const CURVE_SELL = 793.1e6, CURVE_KEEP = 206.9e6;
  const set = (k, v) => { const el = root.querySelector(`[data-${k}]`); if (el) el.textContent = v; };
  const pct = x => x.toLocaleString(loc, {maximumFractionDigits: 2}) + " %";
  const usd = x => "$" + Math.round(x).toLocaleString(loc);
  const big = x => x.toLocaleString(loc, {notation: "compact", maximumFractionDigits: 2});
  const na = EN ? "not available" : "nicht verfügbar";

  root.addEventListener("click", e => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    navigator.clipboard?.writeText(b.dataset.copy).then(() => {
      const old = b.textContent;
      b.textContent = b.dataset.done;
      setTimeout(() => (b.textContent = old), 1500);
    });
  });

  function age() {
    const t = Date.parse(root.dataset.launched || "");
    if (!t) return;
    const h = Math.max(0, (Date.now() - t) / 36e5);
    const d = Math.floor(h / 24);
    if (d >= 1) set("age", d + (EN ? (d === 1 ? " day" : " days") : (d === 1 ? " Tag" : " Tage")));
    else set("age", Math.floor(h) + (EN ? " h" : " Std."));
  }

  async function rpc(method, params) {
    for (const url of RPCS) {
      try {
        const r = await fetch(url, {method: "POST", headers: {"content-type": "application/json"},
          body: JSON.stringify({jsonrpc: "2.0", id: 1, method, params})});
        const j = await r.json();
        if (j.result !== undefined) return j.result;
      } catch (e) { /* nächster Zugang */ }
    }
    throw new Error("rpc");
  }

  async function market() {
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      const pairs = ((await r.json()).pairs || []).filter(p => p.baseToken?.address === mint);
      const p = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (!p) throw 0;
      set("mc", usd(p.marketCap || p.fdv || 0));
      set("where", p.dexId === "pumpfun" ? (EN ? "bonding curve" : "Bonding-Kurve") : p.dexId === "pumpswap" ? "PumpSwap" : p.dexId);
      return p.dexId;
    } catch (e) { set("mc", na); set("where", "pump.fun"); return null; }
  }

  async function holders() {
    try {
      const supply = Number((await rpc("getTokenSupply", [mint])).value.uiAmount) || 0;
      set("supply", supply ? big(supply) : na);
      const own = await rpc("getTokenAccountsByOwner", [dev, {mint}, {encoding: "jsonParsed"}]);
      const devAmt = own.value.reduce((s, a) => s + (Number(a.account.data.parsed.info.tokenAmount.uiAmount) || 0), 0);
      set("dev-share", supply ? pct(devAmt / supply * 100) : na);
      const list = (await rpc("getTokenLargestAccounts", [mint])).value.slice(0, 10);
      const top = list.reduce((s, a) => s + (Number(a.uiAmount) || 0), 0);
      set("top", supply ? pct(top / supply * 100) : na);
      return Number(list[0]?.uiAmount) || 0;
    } catch (e) { set("dev-share", na); set("top", na); set("supply", na); return null; }
  }

  // Auf der Kurve ist das größte Konto die Kurve selbst: was ihr fehlt, ist verkauft.
  function curve(dex, largest) {
    if (dex && dex !== "pumpfun") return set("curve", EN ? "100 % · graduated" : "100 % · migriert");
    if (dex !== "pumpfun" || largest == null) return set("curve", na);
    const p = Math.min(1, Math.max(0, 1 - (largest - CURVE_KEEP) / CURVE_SELL));
    set("curve", pct(p * 100));
  }

  age();
  const io = new IntersectionObserver(async es => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    const [dex, largest] = await Promise.all([market(), holders()]);
    curve(dex, largest);
  });
  io.observe(root);
})();
