// Rechner auf der Startseite: Kauf auf der pump.fun-Bonding-Kurve mit Verzögerung und Slippage,
// gerechnet wie Pump Paper (price.js: buyFill, background.js: Slippage-Prüfung).
(function () {
  const form = document.getElementById("rechner");
  if (!form) return;
  const V_SOL = 30, V_TOK = 1073e6, REAL_TOK = 793.1e6, SUPPLY = 1e9;
  const K = V_SOL * V_TOK, FEE = 0.0125, PRIORITY = 0.001, RENT = 0.00204;
  const $ = id => document.getElementById(id);
  const num = (id, d) => { const v = Number(String($(id).value).replace(",", ".")); return isFinite(v) && v >= 0 ? v : d; };
  const f = (x, d) => x.toLocaleString("de-DE", {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");
  const tok = x => x >= 1e6 ? f(x / 1e6, 2) + " Mio. Token" : f(x, 0) + " Token";
  const usdFmt = x => x >= 1e6 ? f(x / 1e6, 2) + " Mio. $" : f(x, 0) + " $";

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

    $("o-mc").textContent = f(mcSol, 1) + " SOL · " + usdFmt(mcSol * usd);
    $("o-fee").textContent = "−" + f(amt * FEE, 5) + " SOL";
    $("o-want").textContent = "≈ " + tok(want);
    $("o-got").textContent = "≈ " + tok(got) + (diff > 0.0005 ? " (−" + f(diff * 100, 1) + " %)" : "");
    const pill = $("o-state");
    pill.textContent = failed ? "gescheitert" : "ausgeführt";
    pill.className = "state-pill " + (failed ? "bad" : "good");
    $("o-total").textContent = f(failed ? PRIORITY : amt + PRIORITY + RENT, 5) + " SOL";
    $("o-note").textContent = full
      ? "Die Kurve wäre mit diesem Kauf voll. Auf pump.fun geht der Coin dann in den Pool, Pump Paper rechnet danach mit dem Pool weiter."
      : failed
        ? "Deine Menge liegt " + f(diff * 100, 1) + " % unter der erwarteten, mehr als deine Slippage von " + f(slip, 0) + " %. Der Kauf scheitert und kostet nur die Priority Fee."
        : "In der Sekunde bis zur Ausführung kaufen andere für " + f(front, 2) + " SOL vor dir. Du bekommst " + f(diff * 100, 1) + " % weniger als beim Klick angezeigt, das liegt innerhalb deiner Slippage.";
  }

  form.addEventListener("input", run);
  form.addEventListener("submit", e => e.preventDefault());
  run();
})();
