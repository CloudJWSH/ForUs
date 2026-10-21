// Coin-Abschnitt der Startseite: Marktwert von DexScreener, Dev-Anteil und größte Konten direkt von der Blockchain.
// Nur lesende Abfragen, nichts davon braucht ein Wallet.
(function () {
  const root = document.getElementById("coin-live");
  if (!root) return;
  const EN = document.documentElement.lang === "en";
  const loc = EN ? "en-US" : "de-DE";
  const mint = root.dataset.mint, dev = root.dataset.dev;
  const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
  const set = (k, v) => { const el = root.querySelector(`[data-${k}]`); if (el) el.textContent = v; };
  const pct = x => x.toLocaleString(loc, {maximumFractionDigits: 2}) + " %";
  const usd = x => "$" + Math.round(x).toLocaleString(loc);
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
    } catch (e) { set("mc", na); set("where", "pump.fun"); }
  }

  async function holders() {
    try {
      const supply = Number((await rpc("getTokenSupply", [mint])).value.uiAmount) || 0;
      const own = await rpc("getTokenAccountsByOwner", [dev, {mint}, {encoding: "jsonParsed"}]);
      const devAmt = own.value.reduce((s, a) => s + (Number(a.account.data.parsed.info.tokenAmount.uiAmount) || 0), 0);
      set("dev-share", supply ? pct(devAmt / supply * 100) : na);
      const big = (await rpc("getTokenLargestAccounts", [mint])).value.slice(0, 10);
      const top = big.reduce((s, a) => s + (Number(a.uiAmount) || 0), 0);
      set("top", supply ? pct(top / supply * 100) : na);
    } catch (e) { set("dev-share", na); set("top", na); }
  }

  const io = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    market();
    holders();
  });
  io.observe(root);
})();
