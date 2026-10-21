// Rechner auf der Startseite: Kauf oder Verkauf auf der pump.fun-Bonding-Kurve oder im Pool, mit Verzögerung und Slippage,
// gerechnet wie Pump Paper (price.js: buyFill/sellFill, background.js: Slippage-Prüfung). Rechenkern: kurve.js.
(function () {
  const form = document.getElementById("rechner");
  const P = window.PPKurve;
  if (!form || !P) return;
  const EN = document.documentElement.lang === "en";
  const T = EN ? {
    loc: "en-US", mio: " M tokens", tok: " tokens", musd: "M $", ok: "filled", fail: "failed",
    amt: {buy: c => `Amount (${c})`, sell: c => `Position value (${c})`}, front: {buy: c => `Others buy before you (${c})`, sell: c => `Others sell before you (${c})`},
    want: {buy: "Expected at click", sell: "Expected at click"}, impact: {buy: "Price impact of your buy", sell: "Price impact of your sell"},
    total: {buy: "Taken from account", sell: "Credited to account"},
    feeL: (pct, parts) => `Fee ${pct} (${parts})`,
    full: "This buy would fill the curve. On pump.fun the coin then migrates to the pool, and Pump Paper keeps calculating with the pool.",
    failed: (d, s, side) => `You get ${d} % less than expected, more than your ${s} % slippage. The ${side} fails and only costs the priority fee.`,
    fine: (fr, d, c) => `In the second before execution, others buy ${fr} ${c} ahead of you. You get ${d} % less than shown at the click, within your slippage.`,
    fineSell: (fr, d, c) => `In the second before execution, others sell ${fr} ${c} ahead of you. You get ${d} % less than shown at the click, within your slippage.`,
    usdc: " USDC coins have their own start values on pump.fun, which Pump Paper reads from the chain. Here they are approximated via the SOL price.",
    split: (n, t, d, pf) => `${n} buys: ${t} (${d}), ${pf} priority fee`,
    bad: (l, lo, hi) => `Please check “${l}”: allowed is ${lo} to ${hi}.`,
    sentence: o => `${o.side} of ${o.amt} on ${o.where} at ${o.mc}: ${o.got}, fee ${o.fee}, ${o.state}.${o.be ? " Break-even: price must rise " + o.be + "." : ""} Calculated with the Pump Paper calculator, play money.`,
    side: {buy: "Buy", sell: "Sell"}, where: {curve: "the curve", pool: "the pool"}, copied: "Copied",
  } : {
    loc: "de-DE", mio: " Mio. Token", tok: " Token", musd: " Mio. $", ok: "ausgeführt", fail: "gescheitert",
    amt: {buy: c => `Einsatz (${c})`, sell: c => `Wert deiner Position (${c})`}, front: {buy: c => `Andere kaufen vor dir (${c})`, sell: c => `Andere verkaufen vor dir (${c})`},
    want: {buy: "Erwartet beim Klick", sell: "Erwartet beim Klick"}, impact: {buy: "Kurswirkung deines Kaufs", sell: "Kurswirkung deines Verkaufs"},
    total: {buy: "Vom Konto ab", sell: "Aufs Konto"},
    feeL: (pct, parts) => `Gebühr ${pct} (${parts})`,
    full: "Die Kurve wäre mit diesem Kauf voll. Auf pump.fun geht der Coin dann in den Pool, Pump Paper rechnet danach mit dem Pool weiter.",
    failed: (d, s, side) => `Du bekommst ${d} % weniger als erwartet, mehr als deine Slippage von ${s} %. Der ${side} scheitert und kostet nur die Priority Fee.`,
    fine: (fr, d, c) => `In der Sekunde bis zur Ausführung kaufen andere für ${fr} ${c} vor dir. Du bekommst ${d} % weniger als beim Klick angezeigt, das liegt innerhalb deiner Slippage.`,
    fineSell: (fr, d, c) => `In der Sekunde bis zur Ausführung verkaufen andere für ${fr} ${c} vor dir. Du bekommst ${d} % weniger als beim Klick angezeigt, das liegt innerhalb deiner Slippage.`,
    usdc: " USDC-Coins haben auf pump.fun eigene Startwerte, die Pump Paper von der Blockchain liest. Hier sind sie über den SOL-Kurs angenähert.",
    split: (n, t, d, pf) => `${n} Käufe: ${t} (${d}), ${pf} Priority Fee`,
    bad: (l, lo, hi) => `Bitte „${l}“ prüfen: erlaubt ist ${lo} bis ${hi}.`,
    sentence: o => `${o.side} von ${o.amt} auf ${o.where} bei ${o.mc}: ${o.got}, Gebühr ${o.fee}, ${o.state}.${o.be ? " Break-even: Kurs muss um " + o.be + " steigen." : ""} Gerechnet mit dem Pump-Paper-Rechner, Spielgeld.`,
    side: {buy: "Kauf", sell: "Verkauf"}, where: {curve: "der Kurve", pool: "dem Pool"}, copied: "Kopiert",
  };
  const $ = id => document.getElementById(id);
  const f = (x, d) => x.toLocaleString(T.loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");
  const pct = (x, d = 1) => f(x * 100, d) + " %";
  const tok = x => x >= 1e6 ? f(x / 1e6, 2) + T.mio : f(x, 0) + T.tok;
  const usdFmt = x => EN ? "$" + (x >= 1e6 ? f(x / 1e6, 2) + "M" : f(x, 0)) : x >= 1e6 ? f(x / 1e6, 2) + T.musd : f(x, 0) + " $";
  let last = null;

  // Eingaben prüfen: ungültige Felder markieren und eine Meldung zeigen statt mit falschen Zahlen zu rechnen.
  function read() {
    const bad = [];
    // Bei USDC-Coins sind Einsatz und Fremdkäufe in USDC, die Grenzen wachsen mit dem SOL-Kurs.
    const usd = Number($("r-usd").value) || 180, usdc = $("r-pay").value === "USDC";
    $("r-amt").max = usdc ? Math.round(50 * usd) : 50;
    $("r-front").max = usdc ? Math.round(80 * usd) : 80;
    $("r-amt").step = usdc ? "1" : "0.01";
    $("r-front").step = usdc ? "1" : "0.1";
    const num = id => {
      const el = $(id), v = Number(String(el.value).replace(",", "."));
      const lo = Number(el.min), hi = el.max === "" ? Infinity : Number(el.max);
      const ok = el.value !== "" && isFinite(v) && v >= lo && v <= hi;
      el.setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok) bad.push(T.bad(el.closest("label").firstChild.textContent.trim() || el.closest("label").textContent.trim(), f(lo, 0), hi === Infinity ? "∞" : f(hi, 0)));
      return v;
    };
    const v = {mode: $("r-mode").value, market: $("r-market").value, pay: $("r-pay").value,
      amt: num("r-amt"), front: num("r-front"), slip: num("r-slip"), usd: num("r-usd"), split: Math.round(num("r-split")),
      prog: Math.min(95, Number($("r-prog").value)) / 100, poolSol: Number($("r-pool").value)};
    return {v, bad};
  }

  function labels(v) {
    const cur = v.pay;
    form.querySelector('[data-l="amt"]').textContent = T.amt[v.mode](cur);
    form.querySelector('[data-l="front"]').textContent = T.front[v.mode](cur);
    form.querySelector('[data-l="want"]').textContent = T.want[v.mode];
    form.querySelector('[data-l="impact"]').textContent = T.impact[v.mode];
    form.querySelector('[data-l="total"]').textContent = T.total[v.mode];
    form.querySelectorAll("[data-curve]").forEach(el => (el.hidden = v.market !== "curve"));
    form.querySelector("[data-pool]").hidden = v.market !== "pool";
    form.querySelectorAll("[data-buyrow]").forEach(el => (el.hidden = v.mode !== "buy"));
    $("r-split").closest("label").hidden = v.mode !== "buy";
    const fee = v.market === "pool" ? P.POOL_FEE : P.FEE;
    $("o-fee-l").textContent = T.feeL(f(fee * 100, 2) + " %", v.market === "pool" ? (EN ? "0.20 + 0.05" : "0,20 + 0,05") : (EN ? "0.95 + 0.30" : "0,95 + 0,30"));
  }

  function clear(msg) {
    ["o-mc", "o-fee", "o-want", "o-got", "o-impact", "o-be", "o-total", "o-split"].forEach(id => ($(id).textContent = "–"));
    const pill = $("o-state");
    pill.textContent = "–";
    pill.className = "state-pill";
    $("o-note").textContent = msg;
    $("o-note").classList.add("error");
    last = null;
  }

  function run() {
    const {v, bad} = read();
    labels(v);
    $("r-prog-out").value = Math.round(v.prog * 100) + " %";
    $("r-pool-out").value = f(v.poolSol, 0) + " SOL";
    if (bad.length) return clear(bad[0]);
    $("o-note").classList.remove("error");
    // USDC-Coins: Beträge in USDC, gerechnet über den SOL-Kurs auf derselben Kurvenform.
    const toSol = x => v.pay === "USDC" ? x / v.usd : x;
    const fromSol = x => v.pay === "USDC" ? x * v.usd : x;
    const money = (x, d = 5) => v.pay === "USDC" ? f(fromSol(x), 2) + " USDC" : f(x, d) + " SOL";
    // Priority Fee und Miete zahlt man immer in SOL, auch bei USDC-Coins.
    const sol = x => f(x, 5) + " SOL";
    const pool = v.market === "pool";
    const fee = pool ? P.POOL_FEE : P.FEE;
    const start = pool ? P.pool(v.poolSol) : P.atProgress(v.prog);
    const mc = P.mcSol(start);
    const amt = toSol(v.amt), front = toSol(v.front);
    $("o-mc").textContent = v.pay === "USDC" ? usdFmt(mc * v.usd) : f(mc, 1) + " SOL · " + usdFmt(mc * v.usd);
    $("o-prio").textContent = f(P.PRIORITY, 5) + " SOL";
    const pill = $("o-state");
    let failed, diff, note, out = {side: T.side[v.mode], amt: money(amt, 2), where: T.where[v.market], mc: f(mc, 1) + " SOL MC"};

    if (v.mode === "buy") {
      const want = P.buy(start, amt, fee, pool).tokens;
      const after = P.buy(start, front, fee, pool).next;
      const fill = P.buy(after, amt, fee, pool);
      const got = fill.tokens;
      diff = want > 0 ? 1 - got / want : 0;
      failed = v.slip > 0 && got < want * (1 - v.slip / 100);
      const full = !pool && (P.progress(fill.next) >= 0.9999);
      const impact = P.price(fill.next) / P.price(after) - 1;
      // Break-even: Verkauf der Menge bringt Einsatz, 2× Priority Fee und Miete zurück.
      const need = amt + 2 * P.PRIORITY + P.RENT;
      const be = P.breakEven(fill.next, got, need, fee);
      const beUp = P.price(be) / P.price(fill.next) - 1;
      $("o-fee").textContent = "−" + money(fill.fee);
      $("o-want").textContent = "≈ " + tok(want);
      $("o-got").textContent = "≈ " + tok(got) + (diff > 0.0005 ? " (−" + pct(diff) + ")" : "");
      $("o-impact").textContent = failed ? "–" : "+" + pct(impact, 2);
      $("o-be").textContent = failed || !(beUp > -1) ? "–" : "+" + pct(beUp) + " · MC " + f(P.mcSol(be), 1) + " SOL";
      $("o-total").textContent = failed ? sol(P.PRIORITY) : v.pay === "USDC" ? `${money(amt)} + ${sol(P.PRIORITY + P.RENT)}` : money(amt + P.PRIORITY + P.RENT);
      // Aufgeteilt: n kleinere Käufe nacheinander. Jeder braucht seine Sekunde, in der andere wieder vor dir kaufen,
      // und jeder kostet eine eigene Priority Fee. Ohne Fremdkäufe wäre die Menge gleich, die Formel hängt nicht vom Weg ab.
      const splitRow = form.querySelector("[data-splitrow]");
      splitRow.hidden = v.split <= 1;
      if (v.split > 1) {
        let c = start, sum = 0;
        for (let i = 0; i < v.split; i++) { c = P.buy(c, front, fee, pool).next; const b = P.buy(c, amt / v.split, fee, pool); sum += b.tokens; c = b.next; }
        $("o-split").textContent = T.split(v.split, "≈ " + tok(sum), (sum >= got ? "+" : "−") + pct(Math.abs(sum / got - 1), 2), sol(v.split * P.PRIORITY));
      }
      note = full ? T.full : failed ? T.failed(f(diff * 100, 1), f(v.slip, 0), T.side.buy) : T.fine(f(v.front, 2), f(diff * 100, 1), v.pay);
      out = {...out, got: "≈ " + tok(got), fee: money(fill.fee), be: failed ? "" : "+" + pct(beUp)};
    } else {
      // Verkauf: deine Position ist beim Klick amt wert; andere verkaufen vorher für front.
      const tokens = amt / P.price(start);
      const want = P.sell(start, tokens, fee).sol;
      const othersTok = front > 0 ? front * start.vTok / Math.max(1e-9, start.vSol - front) : 0;
      const after = start.vSol - front > 0 ? P.sell(start, othersTok, fee).next : start;
      const fill = P.sell(after, tokens, fee);
      diff = want > 0 ? 1 - fill.sol / want : 0;
      failed = start.vSol - front <= 0 || (v.slip > 0 && fill.sol < want * (1 - v.slip / 100));
      const impact = P.price(fill.next) / P.price(after) - 1;
      $("o-fee").textContent = "−" + money(fill.fee);
      $("o-want").textContent = "≈ " + money(want);
      $("o-got").textContent = "≈ " + money(fill.sol) + (diff > 0.0005 ? " (−" + pct(diff) + ")" : "");
      $("o-impact").textContent = failed ? "–" : pct(impact, 2);
      $("o-total").textContent = failed ? "−" + sol(P.PRIORITY) : v.pay === "USDC" ? `+${money(fill.sol)} · −${sol(P.PRIORITY)}` : "+" + money(fill.sol - P.PRIORITY);
      form.querySelector("[data-splitrow]").hidden = true;
      note = failed ? T.failed(f(diff * 100, 1), f(v.slip, 0), T.side.sell) : T.fineSell(f(v.front, 2), f(diff * 100, 1), v.pay);
      out = {...out, got: "≈ " + money(fill.sol), fee: money(fill.fee), be: ""};
    }
    pill.textContent = failed ? T.fail : T.ok;
    pill.className = "state-pill " + (failed ? "bad" : "good");
    $("o-note").textContent = note + (v.pay === "USDC" ? T.usdc : "");
    last = {...out, state: failed ? T.fail : T.ok};
  }

  form.addEventListener("input", run);
  form.addEventListener("change", run);
  form.addEventListener("reset", () => setTimeout(() => { run(); form.dispatchEvent(new Event("input", {bubbles: true})); }, 0));
  form.addEventListener("click", e => {
    const b = e.target.closest("[data-set-prog]");
    if (b) {
      $("r-prog").value = b.dataset.setProg;
      form.dispatchEvent(new Event("input", {bubbles: true}));
    }
    const c = e.target.closest("[data-copy-sentence]");
    if (c && last) {
      const text = T.sentence(last);
      const done = () => { const old = c.textContent; c.textContent = T.copied; setTimeout(() => (c.textContent = old), 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt("", text));
      else prompt("", text);
    }
  });
  form.addEventListener("submit", e => e.preventDefault());
  run();
})();
