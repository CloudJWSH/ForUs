// Stop-Rechner der Anleitung: Wie weit ein Stop im Absturz unter der Marke landet.
// Erkennung bei offener Coinseite im Mittel 0,5 s, im Hintergrund 15 s (Prüfung alle 30 s), danach 1 s Verzögerung.
(function () {
  const form = document.getElementById("stop-rechner");
  if (!form) return;
  const FEE = 0.0125, PRIORITY = 0.001, DELAY = 1;
  const $ = id => document.getElementById(id);
  const num = (id, d) => { const v = Number(String($(id).value).replace(",", ".")); return isFinite(v) && v >= 0 ? v : d; };
  const f = (x, d) => x.toLocaleString("de-DE", {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");

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
    $("st-open-sol").textContent = "zurück " + f(open.back, 3) + " SOL (" + f(open.loss, 3) + ")";
    $("st-bg-sol").textContent = "zurück " + f(bg.back, 3) + " SOL (" + f(bg.loss, 3) + ")";
    $("st-note").textContent = rate === 0
      ? "Ohne Absturz verkauft der Stop genau an der Marke. Dazu kommen nur Gebühren und Priority Fee."
      : "Dein Stop liegt bei −" + f(sl, 0) + " %. Fällt der Kurs weiter um " + f(rate, 1) + " % pro Sekunde, verkauft Pump Paper bei offener Seite bei " + f(open.pct * 100, 1) + " %, im Hintergrund im Mittel bei " + f(bg.pct * 100, 1) + " %. Gebühren auf Kauf und Verkauf sind eingerechnet.";
  }
  form.addEventListener("input", run);
  form.addEventListener("submit", e => e.preventDefault());
  run();
})();
