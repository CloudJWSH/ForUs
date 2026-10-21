(() => {
  if (window.__pumpPaperScout) return;
  window.__pumpPaperScout = true;

  const mintOf = link => {
    const m = String(link || "").match(/pump\.fun\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
    return m ? m[1] : null;
  };

  window.addEventListener("message", e => {
    const d = e.data;
    if (e.source !== window || !d || d.source !== "scout-board" || !Array.isArray(d.coins)) return;
    const coins = {};
    for (const c of d.coins) {
      const mint = mintOf(c.link);
      if (!mint) continue;
      coins[mint] = {mint, sym: String(c.sym || ""), name: String(c.name || ""), status: String(c.status || "beobachten"),
                     quelle: String(c.quelle || ""), von: String(c.von || ""), notiz: String(c.notiz || ""),
                     mc: Number(c.mc) || 0, ath: Number(c.ath) || 0, v1h: Number(c.v1h) || 0, ts: Number(c.aktualisiert) || 0};
    }
    try { chrome.runtime.sendMessage({op: "scout", coins}, () => chrome.runtime.lastError); } catch (x) {}
  });

  window.postMessage({source: "pump-paper", type: "scout-hello"}, "*");
})();
