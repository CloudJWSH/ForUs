// Gemeinsamer Rechenkern: pump.fun-Bonding-Kurve, Gebühren und simulierte Coins für das Strategie-Labor.
// Gerechnet wie Pump Paper (price.js). Läuft im Browser (window.PPKurve) und in Node (require) für die Tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PPKurve = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const V_SOL = 30, V_TOK = 1073e6, REAL_TOK = 793.1e6, SUPPLY = 1e9, K = V_SOL * V_TOK;
  const FEE = 0.0125, PRIORITY = 0.001, RENT = 0.00204;

  // Kurve als virtuelle Reserven; Preis in SOL je Token.
  const fresh = () => ({vSol: V_SOL, vTok: V_TOK});
  const atProgress = p => { const vTok = V_TOK - REAL_TOK * p; return {vSol: K / vTok, vTok}; };
  const price = c => c.vSol / c.vTok;
  const mcSol = c => price(c) * SUPPLY;
  const progress = c => (V_TOK - c.vTok) / REAL_TOK;

  // Kauf: Gebühr geht vom Einsatz ab, der Rest in die konstante Produktformel.
  function buy(c, sol, fee = FEE) {
    const net = sol * (1 - fee);
    const left = Math.max(0, c.vTok - (V_TOK - REAL_TOK));
    const out = Math.min(c.vTok * net / (c.vSol + net), left);
    return {tokens: out, next: {vSol: c.vSol + net, vTok: c.vTok - out}};
  }
  // Verkauf: Brutto aus der Formel, Gebühr geht vom Erlös ab.
  function sell(c, tokens, fee = FEE) {
    const gross = c.vSol * tokens / (c.vTok + tokens);
    return {sol: gross * (1 - fee), fee: gross * fee, next: {vSol: c.vSol - gross, vTok: c.vTok + tokens}};
  }

  // Zufall mit Startwert: gleicher Startwert, gleiche Coins.
  function rng(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Marktlagen: wie oft die Phasen vorkommen und wie viel SOL je Sekunde netto fließt.
  const SCENARIOS = {
    normal: {calm: 0.80, hype: 0.08, dump: 0.12, pull: 0.004, life: [180, 1800]},
    hype:   {calm: 0.58, hype: 0.30, dump: 0.12, pull: 0.0007, life: [300, 2400]},
    crash:  {calm: 0.60, hype: 0.05, dump: 0.35, pull: 0.01, life: [120, 1200]},
  };
  const PHASES = {calm: [-0.012, 0.06], hype: [0.12, 0.4], dump: [-0.3, 0.3]};

  // Ein simulierter Coin: Zustand der Kurve je Sekunde, bis er stirbt oder in den Pool migriert.
  // Wie auf pump.fun: Sniper kaufen schon im ersten Block und verkaufen bald wieder, oft verkauft auch der Dev.
  function coin(rand, scenario = "normal") {
    const S = SCENARIOS[scenario] || SCENARIOS.normal;
    const life = Math.round(S.life[0] + rand() * (S.life[1] - S.life[0]));
    const path = new Float64Array(life + 1);
    let vSol = V_SOL, phase = "calm", left = 0, end = "tot";
    const sniper = 1 + rand() * rand() * 14;               // SOL von Dev und Snipern schon im ersten Block
    const sniperExit = 20 + rand() * 100;                  // so lange verkaufen sie wieder
    const devAt = rand() < 0.55 ? Math.round(30 + rand() * life * 0.6) : -1;
    const devSol = 0.5 + rand() * 3;
    vSol += sniper;
    path[0] = K / vSol;
    for (let t = 1; t <= life; t++) {
      if (left-- <= 0) {
        const r = rand();
        phase = r < S.calm ? "calm" : r < S.calm + S.hype ? "hype" : "dump";
        left = 8 + Math.floor(rand() * 40);
      }
      const [drift, vol] = PHASES[phase];
      const g = (rand() + rand() + rand() - 1.5) * 2;  // grob normalverteilt
      // Je weiter die Kurve, desto mehr Geld bewegt sich.
      // Das Interesse lässt mit der Zeit nach.
      const scale = (1 + (vSol - V_SOL) / 25) * Math.max(0.15, Math.exp(-t / 600));
      // Wer gekauft hat, verkauft irgendwann wieder: Geld über dem Start fließt langsam ab.
      let flow = (drift + vol * g) * scale - S.pull * (vSol - V_SOL);
      if (phase === "hype" && rand() < 0.04) flow += 1 + rand() * 4;   // großer Kauf auf einen Schlag
      if (t <= sniperExit) flow -= sniper / sniperExit * (0.6 + rand() * 0.8);
      if (t === devAt) flow -= devSol;
      vSol = Math.max(V_SOL, vSol + flow);
      let vTok = K / vSol;
      if (vTok <= V_TOK - REAL_TOK) { vTok = V_TOK - REAL_TOK; path[t] = vTok; end = "migriert"; return {path: path.slice(0, t + 1), end}; }
      path[t] = vTok;
    }
    return {path, end};
  }
  const state = vTok => ({vSol: K / vTok, vTok});

  return {V_SOL, V_TOK, REAL_TOK, SUPPLY, K, FEE, PRIORITY, RENT, SCENARIOS,
          fresh, atProgress, price, mcSol, progress, buy, sell, rng, coin, state};
});
