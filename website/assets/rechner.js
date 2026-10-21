// Rechner auf der Startseite: Kauf auf der pump.fun-Bonding-Kurve mit Verzögerung und Slippage,
// gerechnet wie Pump Paper (price.js: buyFill, background.js: Slippage-Prüfung).
(function () {
  const form = document.getElementById("rechner");
  if (!form) return;
  const V_SOL = 30, V_TOK = 1073e6, REAL_TOK = 793.1e6, SUPPLY = 1e9;
  const K = V_SOL * V_TOK, FEE = 0.0125, PRIORITY = 0.001, RENT = 0.00204;
  const EN = document.documentElement.lang === "en";
  const T = EN ? {
    loc: "en-US", mio: " M tokens", tok: " tokens", musd: "M $", ok: "filled", fail: "failed",
    full: "This buy would fill the curve. On pump.fun the coin then migrates to the pool, and Pump Paper keeps calculating with the pool.",
    failed: (d, s) => `You get ${d} % less than expected, more than your ${s} % slippage. The buy fails and only costs the priority fee.`,
    fine: (fr, d) => `In the second before execution, others buy ${fr} SOL ahead of you. You get ${d} % less than shown at the click, within your slippage.`,
  } : {
    loc: "de-DE", mio: " Mio. Token", tok: " Token", musd: " Mio. $", ok: "ausgeführt", fail: "gescheitert",
    full: "Die Kurve wäre mit diesem Kauf voll. Auf pump.fun geht der Coin dann in den Pool, Pump Paper rechnet danach mit dem Pool weiter.",
    failed: (d, s) => `Deine Menge liegt ${d} % unter der erwarteten, mehr als deine Slippage von ${s} %. Der Kauf scheitert und kostet nur die Priority Fee.`,
    fine: (fr, d) => `In der Sekunde bis zur Ausführung kaufen andere für ${fr} SOL vor dir. Du bekommst ${d} % weniger als beim Klick angezeigt, das liegt innerhalb deiner Slippage.`,
  };
  const $ = id => document.getElementById(id);
  const num = (id, d) => { const v = Number(String($(id).value).replace(",", ".")); return isFinite(v) && v >= 0 ? v : d; };
  const f = (x, d) => x.toLocaleString(T.loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");
  const tok = x => x >= 1e6 ? f(x / 1e6, 2) + T.mio : f(x, 0) + T.tok;
  const usdFmt = x => x >= 1e6 ? f(x / 1e6, 2) + T.musd : f(x, 0) + " $";

  // Kauf auf der Kurve: Gebühr geht vom Einsatz ab, der Rest in die konstante Produktformel.
  function buy(state, sol) {
    const net = sol * (1 - FEE);
    const out = Math.min(state.vTok * net / (state.vSol + net), state.left);
    return {tokens: out, next: {vSol: state.vSol + net, vTok: state.vTok - out, left: state.left - out}};
  }

  function run() {
    const amt = num("r-amt", 0.5), front = num("r-front", 0), slip = num("r-slip", 10), usd = num("r-usd", 180);
    const prog = Math.min(95, num("r-prog", 20)) / 100;
    $("r-prog-out").value = Math.round(prog * 100) + " %";
    const sold = prog * REAL_TOK;
    const vTok = V_TOK - sold;
    const start = {vSol: K / vTok, vTok, left: REAL_TOK - sold};
    const mcSol = start.vSol / start.vTok * SUPPLY;
    const want = buy(start, amt).tokens;
    const after = buy(start, front).next;
    const got = buy(after, amt).tokens;
    const diff = want > 0 ? 1 - got / want : 0;
    const failed = slip > 0 && got < want * (1 - slip / 100);
    const full = after.left <= 0 || got >= after.left - 1;
    // Kurswirkung: Kurs direkt nach deinem Kauf gegenüber dem Kurs davor.
    const mine = buy(after, amt).next;
    const impact = (mine.vSol / mine.vTok) / (after.vSol / after.vTok) - 1;
    // Break-even: Kurs, bei dem der Verkauf deiner Menge nach Gebühr alles zurückbringt (Einsatz, 2× Priority Fee, Miete).
    // Auf der Kurve gilt vSol·vTok = K, gesucht ist vTok mit K·T / (vTok·(vTok+T)) = Brutto.
    const need = (amt + 2 * PRIORITY + RENT) / (1 - FEE);
    const vTokBe = (-got + Math.sqrt(got * got + 4 * K * got / need)) / 2;
    const be = (K / vTokBe / vTokBe) / (mine.vSol / mine.vTok) - 1;

    $("o-mc").textContent = f(mcSol, 1) + " SOL · " + usdFmt(mcSol * usd);
    $("o-fee").textContent = "−" + f(amt * FEE, 5) + " SOL";
    $("o-want").textContent = "≈ " + tok(want);
    $("o-got").textContent = "≈ " + tok(got) + (diff > 0.0005 ? " (−" + f(diff * 100, 1) + " %)" : "");
    const pill = $("o-state");
    pill.textContent = failed ? T.fail : T.ok;
    pill.className = "state-pill " + (failed ? "bad" : "good");
    $("o-impact").textContent = failed ? "–" : "+" + f(impact * 100, 2) + " %";
    $("o-be").textContent = failed || !(be > -1) ? "–" : "+" + f(be * 100, 1) + " % · MC " + f(K / vTokBe / vTokBe * SUPPLY, 1) + " SOL";
    $("o-total").textContent = f(failed ? PRIORITY : amt + PRIORITY + RENT, 5) + " SOL";
    $("o-note").textContent = full ? T.full : failed ? T.failed(f(diff * 100, 1), f(slip, 0)) : T.fine(f(front, 2), f(diff * 100, 1));
  }

  form.addEventListener("input", run);
  form.addEventListener("click", e => {
    const b = e.target.closest("[data-set-prog]");
    if (!b) return;
    $("r-prog").value = b.dataset.setProg;
    form.dispatchEvent(new Event("input", {bubbles: true}));
  });
  form.addEventListener("submit", e => e.preventDefault());
  run();
})();
