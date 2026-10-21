// Stop-Rechner der Anleitung: Wie weit ein Stop im Absturz unter der Marke landet.
// Erkennung bei offener Coinseite im Mittel 0,5 s, im Hintergrund 15 s (Prüfung alle 30 s), danach 1 s Verzögerung.
(function () {
  const form = document.getElementById("stop-rechner");
  if (!form) return;
  const FEE = 0.0125, PRIORITY = 0.001, DELAY = 1;
  const EN = document.documentElement.lang === "en";
  const T = EN ? {
    loc: "en-US", back: "back",
    none: "Without a crash the stop sells exactly at the mark, minus fees and priority fee.",
    note: (sl, r, o, b) => `Your stop is at −${sl} %. If the price keeps falling ${r} % per second, Pump Paper sells at ${o} % with the coin page open, and on average at ${b} % in the background. Fees on buy and sell are included.`,
  } : {
    loc: "de-DE", back: "zurück",
    none: "Ohne Absturz verkauft der Stop genau an der Marke. Dazu kommen nur Gebühren und Priority Fee.",
    note: (sl, r, o, b) => `Dein Stop liegt bei −${sl} %. Fällt der Kurs weiter um ${r} % pro Sekunde, verkauft Pump Paper bei offener Seite bei ${o} %, im Hintergrund im Mittel bei ${b} %. Gebühren auf Kauf und Verkauf sind eingerechnet.`,
  };
  const $ = id => document.getElementById(id);
  const num = (id, d) => { const v = Number(String($(id).value).replace(",", ".")); return isFinite(v) && v >= 0 ? v : d; };
  const f = (x, d) => x.toLocaleString(T.loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");

  function exit(amt, sl, rate, wait) {
    const price = (1 - sl / 100) * Math.pow(1 - rate / 100, wait + DELAY);
    const back = amt * (1 - FEE) * price * (1 - FEE) - PRIORITY;
    return {pct: price - 1, back, loss: back - amt};
  }

  function run() {
    const amt = num("st-amt", 0.5), sl = Math.min(95, num("st-sl", 20)), rate = Math.min(15, num("st-rate", 3));
    $("st-rate-out").value = f(rate, rate % 1 ? 1 : 0) + " %";
    const open = exit(amt, sl, rate, 0.5), bg = exit(amt, sl, rate, 15);
    $("st-open").textContent = f(open.pct * 100, 1) + " %";
    $("st-bg").textContent = f(bg.pct * 100, 1) + " %";
    $("st-open-sol").textContent = `${T.back} ${f(open.back, 3)} SOL (${f(open.loss, 3)})`;
    $("st-bg-sol").textContent = `${T.back} ${f(bg.back, 3)} SOL (${f(bg.loss, 3)})`;
    $("st-note").textContent = rate === 0 ? T.none : T.note(f(sl, 0), f(rate, 1), f(open.pct * 100, 1), f(bg.pct * 100, 1));
  }
  form.addEventListener("input", run);
  form.addEventListener("submit", e => e.preventDefault());
  run();
})();
