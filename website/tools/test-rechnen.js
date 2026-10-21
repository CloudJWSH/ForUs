// Tests für den Rechenkern (assets/kurve.js) und das Strategie-Labor (assets/strategie.js), ohne Browser.
// Aufruf: node website/tools/test-rechnen.js
const assert = require("assert");
const P = require("../assets/kurve.js");
const S = require("../assets/strategie.js");
let n = 0;
const test = (name, fn) => { fn(); n++; };

test("Startwerte der Kurve", () => {
  const c = P.fresh();
  assert.ok(Math.abs(P.mcSol(c) - 27.96) < 0.01);       // 30 SOL / 1,073 Mrd. Token × 1 Mrd.
  assert.strictEqual(P.progress(c), 0);
  assert.ok(Math.abs(P.progress(P.atProgress(0.5)) - 0.5) < 1e-9);
});
test("Kauf und Verkauf kosten zusammen etwa 2 × Gebühr", () => {
  const c = P.atProgress(0.2), b = P.buy(c, 1), s = P.sell(b.next, b.tokens);
  assert.ok(s.sol < 1 && s.sol > 0.97, s.sol);
});
test("Kurve gibt nie mehr Token her, als verkäuflich sind", () => {
  const b = P.buy(P.fresh(), 1e6);
  assert.ok(b.tokens <= P.REAL_TOK + 1);
});
test("Pool beginnt beim Preis, an dem die Kurve endet", () => {
  const end = P.price(P.atProgress(1)), start = P.price(P.pool());
  assert.ok(Math.abs(start / end - 1) < 0.001, `${start} vs ${end}`);
});
test("Gebühr wie in Pump Paper: Einsatz / (1 + Gebühr)", () => {
  const b = P.buy(P.fresh(), 1);
  assert.ok(Math.abs(b.fee - (1 - 1 / 1.0125)) < 1e-12);
});
test("Break-even bringt genau den Bedarf zurück", () => {
  const b = P.buy(P.atProgress(0.3), 0.5), need = 0.505;
  const be = P.breakEven(b.next, b.tokens, need);
  assert.ok(Math.abs(P.sell(be, b.tokens).sol - need) < 1e-9);
});
test("Gleicher Startwert, gleiche Coins", () => {
  const a = P.coin(P.rng(5)), b = P.coin(P.rng(5));
  assert.deepStrictEqual(Array.from(a.path.slice(0, 50)), Array.from(b.path.slice(0, 50)));
});
test("Simulierte Kurve fällt nie unter den Start", () => {
  const r = P.rng(9);
  for (let i = 0; i < 50; i++) for (const v of P.coin(r).path) assert.ok(v <= P.V_TOK + 1e-6);
});
test("Beispiel-Strategien sind gültig", () => {
  for (const t of Object.values(S.TEMPLATES)) assert.ok(S.validate(t).ok);
  assert.ok(S.validate(S.DEFAULT).ok);
});
test("Prüfung meldet falsche Felder", () => {
  const v = S.validate({format: "pump-paper-strategy", version: 1, exit: {stopPct: 300}, size: {mode: "x", value: 1}});
  assert.ok(!v.ok);
  assert.ok(v.errors.some(e => e.field === "exit.stopPct"));
  assert.ok(v.errors.some(e => e.field === "size.mode"));
  assert.ok(!S.validate("{kaputt").ok);
});
test("Backtest ist wiederholbar und die Kasse stimmt", () => {
  const a = S.backtest(S.DEFAULT, {seed: 3}), b = S.backtest(S.DEFAULT, {seed: 3});
  assert.strictEqual(a.end, b.end);
  const sum = a.trades.reduce((x, t) => x + t.pnl, 0);
  assert.ok(Math.abs(a.start + sum - a.end) < 1e-9, `${a.start + sum} vs ${a.end}`);
});
test("Höchstens N offene Positionen", () => {
  const s = S.clone(S.DEFAULT); s.limits.maxOpen = 1; s.exit.timeMin = 60; s.exit.targetPct = null; s.exit.stopPct = null;
  const r = S.backtest(s, {seed: 2, coins: 40, every: 10});
  const ivals = r.trades.filter(t => !t.failed).map(t => [t.t - t.held, t.t]).sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < ivals.length; i++) assert.ok(ivals[i][0] >= ivals[i - 1][1] - 2, "Positionen überlappen");
});
test("Satz beschreibt Ziel und Stop", () => {
  assert.ok(/\+60 %/.test(S.describe(S.DEFAULT)) && /−20 %/.test(S.describe(S.DEFAULT, true)));
});
console.log(`Rechentests: ${n} in Ordnung`);
