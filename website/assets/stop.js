// Stop-Rechner der Anleitung: Wie weit ein Stop im Absturz unter der Marke landet.
// Erkennung bei offener Coinseite im Mittel 0,5 s, im Hintergrund 15 s (Prüfung alle 30 s), danach 1 s Verzögerung.
// Szenario Liquiditätsabzug: ein großer Verkauf drückt den Kurs auf einen Schlag, danach fällt er gleichmäßig weiter.
(function () {
  const form = document.getElementById("stop-rechner");
  if (!form) return;
  const FEE = 0.0125, PRIORITY = 0.001, DELAY = 1, OPEN = 0.5, BG = 15;
  const EN = document.documentElement.lang === "en";
  const T = EN ? {
    loc: "en-US", back: "back",
    none: "Without a crash the stop sells exactly at the mark, minus fees and priority fee.",
    note: (sl, r, o, b) => `Your stop is at −${sl} %. If the price keeps falling ${r} % per second, Pump Paper sells at ${o} % with the coin page open, and on average at ${b} % in the background. Fees on buy and sell are included.`,
    pull: (sl, g, o, b) => `Your stop is at −${sl} %. One big sell pushes the price ${g} % lower at once, so no stop can sell at the mark: Pump Paper sells at ${o} % with the page open and on average at ${b} % in the background.`,
    bad: (l, lo, hi) => `Please check “${l}”: allowed is ${lo} to ${hi}.`,
  } : {
    loc: "de-DE", back: "zurück",
    none: "Ohne Absturz verkauft der Stop genau an der Marke. Dazu kommen nur Gebühren und Priority Fee.",
    note: (sl, r, o, b) => `Dein Stop liegt bei −${sl} %. Fällt der Kurs weiter um ${r} % pro Sekunde, verkauft Pump Paper bei offener Seite bei ${o} %, im Hintergrund im Mittel bei ${b} %. Gebühren auf Kauf und Verkauf sind eingerechnet.`,
    pull: (sl, g, o, b) => `Dein Stop liegt bei −${sl} %. Ein großer Verkauf drückt den Kurs auf einen Schlag um ${g} %, kein Stop kann dann an der Marke verkaufen: Pump Paper verkauft bei offener Seite bei ${o} %, im Hintergrund im Mittel bei ${b} %.`,
    bad: (l, lo, hi) => `Bitte „${l}“ prüfen: erlaubt ist ${lo} bis ${hi}.`,
  };
  const $ = id => document.getElementById(id);
  const f = (x, d) => x.toLocaleString(T.loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");

  // Kurs relativ zum Einstieg, t Sekunden nachdem die Stop-Marke erreicht ist.
  const priceAt = (v, t) => t < 0
    ? (1 - v.sl / 100) * Math.pow(1 - v.rate / 100, t)
    : (1 - v.sl / 100) * (v.pull ? 1 - v.gap / 100 : 1) * Math.pow(1 - v.rate / 100, t);

  function exit(v, wait) {
    const price = priceAt(v, wait + DELAY);
    const back = v.amt * (1 - FEE) * price * (1 - FEE) - PRIORITY;
    return {pct: price - 1, back, loss: back - v.amt};
  }

  function chart(v) {
    const W = 320, H = 120, t0 = -3, t1 = 20;
    const pts = [];
    for (let t = t0; t <= t1; t += 0.25) {
      if (v.pull && t === 0) pts.push([0, priceAt(v, -1e-9)]);
      pts.push([t, priceAt(v, t)]);
    }
    const hi = Math.max(...pts.map(p => p[1])), lo = Math.min(...pts.map(p => p[1]));
    const pad = (hi - lo) * 0.1 || 0.05;
    const x = t => ((t - t0) / (t1 - t0)) * (W - 8) + 4;
    const y = p => H - 6 - ((p - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 12);
    const path = pts.map(([t, p], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(p).toFixed(1)}`).join("");
    const dot = (t, cls) => `<circle class="${cls}" cx="${x(t).toFixed(1)}" cy="${y(priceAt(v, t)).toFixed(1)}" r="4.5"/>`;
    const sy = y(1 - v.sl / 100).toFixed(1);
    $("st-chart").innerHTML = `<line class="stop" x1="0" x2="${W}" y1="${sy}" y2="${sy}"/><line class="zero" x1="${x(0)}" x2="${x(0)}" y1="0" y2="${H}"/>`
      + `<path class="ln" d="${path}"/>${dot(OPEN + DELAY, "open")}${dot(BG + DELAY, "bg")}`;
  }

  function run() {
    const bad = [];
    const num = (id, d) => {
      const el = $(id), v = Number(String(el.value).replace(",", "."));
      const lo = Number(el.min), hi = el.max === "" ? Infinity : Number(el.max);
      const ok = el.value !== "" && isFinite(v) && v >= lo && v <= hi;
      el.setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok) bad.push(T.bad(el.closest("label").firstChild.textContent.trim(), f(lo, lo % 1 ? 2 : 0), f(hi, 0)));
      return ok ? v : d;
    };
    const v = {amt: num("st-amt", 0.5), sl: num("st-sl", 20), rate: Math.min(15, Number($("st-rate").value)),
               pull: $("st-scen").value === "pull", gap: Number($("st-gap").value)};
    $("st-rate-out").value = f(v.rate, v.rate % 1 ? 1 : 0) + " %";
    $("st-gap-out").value = f(v.gap, 0) + " %";
    form.querySelector("[data-gap]").hidden = !v.pull;
    const note = $("st-note");
    note.classList.toggle("error", bad.length > 0);
    if (bad.length) {
      ["st-open", "st-bg", "st-open-sol", "st-bg-sol"].forEach(id => ($(id).textContent = "–"));
      note.textContent = bad[0];
      return;
    }
    const open = exit(v, OPEN), bg = exit(v, BG);
    $("st-open").textContent = f(open.pct * 100, 1) + " %";
    $("st-bg").textContent = f(bg.pct * 100, 1) + " %";
    $("st-open-sol").textContent = `${T.back} ${f(open.back, 3)} SOL (${f(open.loss, 3)})`;
    $("st-bg-sol").textContent = `${T.back} ${f(bg.back, 3)} SOL (${f(bg.loss, 3)})`;
    note.textContent = v.pull ? T.pull(f(v.sl, 0), f(v.gap, 0), f(open.pct * 100, 1), f(bg.pct * 100, 1))
      : v.rate === 0 ? T.none : T.note(f(v.sl, 0), f(v.rate, 1), f(open.pct * 100, 1), f(bg.pct * 100, 1));
    chart(v);
  }
  form.addEventListener("input", run);
  form.addEventListener("change", run);
  form.addEventListener("submit", e => e.preventDefault());
  run();
})();
