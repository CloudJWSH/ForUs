// Ersetzt die Chrome-APIs der Erweiterung durch Beispieldaten, damit Panel und Fenster
// für die Bilder der Website mit dem echten Code gezeichnet werden. Alle Werte sind Beispiele.
(() => {
  const now = Date.now(), min = 60000;
  const K = 30 * 1073e6;
  const curve = vTok => ({qRes: K / vTok, tRes: vTok});
  const base = {quoteSym: "SOL", quoteUsd: 180, solUsd: 180, supply: 1e9, fees: {lp: 0, protocol: 95, creator: 30},
    feeSource: "Fee-Config", source: "Blockchain", phase: "kurve", live: true, ts: now - 2000, backup: false};
  const SUNNY = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
  const FROG = "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT";
  const DOGE = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
  const quotes = {
    [SUNNY]: {...base, mint: SUNNY, symbol: "SUNNY", ...curve(800e6)},
    [FROG]: {...base, mint: FROG, symbol: "FROGGY", quoteSym: "USDC", quoteUsd: 1, ...{qRes: 41000, tRes: 610e6},
      fees: {lp: 20, protocol: 5, creator: 5}, phase: "pool"},
  };
  const entry = curve(914.4e6);
  const s = {startSol: 10, startUsdc: 1000, priority: 0.001, buffer: 0, delay: 1, slippage: 10, rent: 0.00204, feeOverride: "",
    sizesSol: [0.1, 0.25, 0.5, 1], sizesUsdc: [10, 25, 50, 100], tp: 60, sl: -20, maxMin: 10,
    rpc: "https://api.mainnet-beta.solana.com", memebotUrl: "", memebotPass: "", model: 14};
  const tok = 0.5 / 1.0125 * entry.tRes / (entry.qRes + 0.5 / 1.0125);
  const state = {
    settings: s, solUsd: 180, quotes,
    wallet: {SOL: 8.732, USDC: 975},
    positions: {
      [SUNNY]: {mint: SUNNY, symbol: "SUNNY", pay: "SOL", quoteSym: "SOL", tokens: tok, cost: 0.5, gas: 0.00304, opened: now - 7 * min,
        entryPrice: entry.qRes / entry.tRes, tp: 60, sl: -20, maxMin: 10, buys: 1},
      [FROG]: {mint: FROG, symbol: "FROGGY", pay: "USDC", quoteSym: "USDC", tokens: 395000, cost: 25, gas: 0.00304, opened: now - 3 * min,
        entryPrice: 25 / 1.003 / 395000, tp: 60, sl: -20, maxMin: 10, buys: 1},
    },
    history: [
      {ts: now - 95 * min, symbol: "MOODENG2", mint: DOGE, side: "kauf", pay: "SOL", amount: 0.25, tokens: 6.1e6, fee: 0.0031, feePct: 1.25, gas: 0.00304, rent: 0.00204, mcUsd: 7400, solUsd: 180},
      {ts: now - 88 * min, symbol: "MOODENG2", mint: DOGE, side: "verkauf", pay: "SOL", amount: 0.371, tokens: 6.1e6, fee: 0.0047, feePct: 1.25, gas: 0.001, pnl: 0.121, ret: 0.484, reason: "Ziel", mcUsd: 11200, solUsd: 180},
      {ts: now - 61 * min, symbol: "CATWIF", mint: DOGE, side: "kauf", pay: "SOL", amount: 0.5, tokens: 9.8e6, fee: 0.0062, feePct: 1.25, gas: 0.00304, rent: 0.00204, mcUsd: 9100, solUsd: 180},
      {ts: now - 52 * min, symbol: "CATWIF", mint: DOGE, side: "verkauf", pay: "SOL", amount: 0.384, tokens: 9.8e6, fee: 0.0049, feePct: 1.25, gas: 0.001, pnl: -0.116, ret: -0.232, reason: "Stop", mcUsd: 6900, solUsd: 180},
      {ts: now - 30 * min, symbol: "LUMEN", mint: DOGE, side: "fehlgeschlagen", pay: "SOL", amount: 0, tokens: 0, fee: 0, feePct: 1.25, gas: 0.001, reason: "Kauf: Kurs um +14,2 % gestiegen, mehr als deine Slippage 10 %", mcUsd: 24800, solUsd: 180},
      {ts: now - 7 * min, symbol: "SUNNY", mint: SUNNY, side: "kauf", pay: "SOL", amount: 0.5, tokens: tok, fee: 0.00617, feePct: 1.25, gas: 0.00304, rent: 0.00204, mcUsd: 6930, solUsd: 180},
      {ts: now - 3 * min, symbol: "FROGGY", mint: FROG, side: "kauf", pay: "USDC", amount: 25, tokens: 395000, fee: 0.075, feePct: 0.3, gas: 0.00304, rent: 0.00204, mcUsd: 67200, solUsd: 180},
    ],
  };
  const reply = m => {
    if (m.op === "get") return state;
    if (m.op === "quote") return quotes[m.mint];
    return [];
  };
  const listeners = () => ({addListener() {}, removeListener() {}});
  window.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage(m, cb) { setTimeout(() => cb && cb({ok: true, data: reply(m)}), 0); },
      connect() { return {onMessage: listeners(), onDisconnect: listeners(), postMessage() {}}; },
    },
    storage: {local: {get: (k, cb) => cb && cb({pp: state})}, onChanged: listeners()},
    permissions: {contains: async () => true, request: async () => true},
  };
  window.__pumpPaperSample = {SUNNY};
})();
