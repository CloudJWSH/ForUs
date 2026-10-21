// Demo auf der Startseite: ein simulierter Coin auf einer pump.fun-Bonding-Kurve.
// Andere Händler bewegen den Kurs zufällig, du handelst mit Spielgeld nach den Regeln von Pump Paper:
// Ausführung nach 1 s zum dann gültigen Kurs, Slippage-Grenze 10 %, Priority Fee, Konto-Miete,
// Ziel +60 % und Stop −20 % ohne Slippage-Grenze. Nichts davon ist ein echter Coin.
(function () {
  const root = document.getElementById("demo");
  if (!root) return;
  const EN = document.documentElement.lang === "en";
  const T = EN ? {
    loc: "en-US", mio: " M", buy: "Buy", sold: "Sold", failed: "Failed", wait: "Executing in 1 s …",
    noPos: "No position. Buy with one of the buttons.", pos: "Position", cost: "cost", value: "value now",
    target: "Target", stop: "Stop", hand: "manual", migrated: "The curve is full: the coin migrated. The demo starts a new coin.",
    slip: d => `price moved ${d} %, more than your 10 % slippage`, rent: "incl. account rent", nosol: "Not enough SOL",
    log: "Trades",
  } : {
    loc: "de-DE", mio: " Mio.", buy: "Kauf", sold: "Verkauf", failed: "Gescheitert", wait: "Ausführung in 1 s …",
    noPos: "Keine Position. Kauf mit einem der Knöpfe.", pos: "Position", cost: "Einsatz", value: "Wert jetzt",
    target: "Ziel", stop: "Stop", hand: "von Hand", migrated: "Die Kurve ist voll, der Coin ist migriert. Die Demo startet einen neuen Coin.",
    slip: d => `Kurs um ${d} % bewegt, mehr als deine Slippage von 10 %`, rent: "mit Konto-Miete", nosol: "Nicht genug SOL",
    log: "Trades",
  };
  const V_SOL = 30, V_TOK = 1073e6, REAL_TOK = 793.1e6, K = V_SOL * V_TOK;
  const FEE = 0.0125, PRIORITY = 0.001, RENT = 0.00204, SLIP = 0.10, DELAY = 1000, TP = 0.6, SL = -0.2;
  const TICK = 250, KEEP = 240, SOL_USD = 180;
  const $ = s => root.querySelector(s);
  const f = (x, d) => x.toLocaleString(T.loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");
  const sign = (x, d) => (x > 0 ? "+" : "") + f(x, d);

  let curve, hist, marks, wallet, pos, pending, log, regime, regimeLeft, rented, note;

  function reset(keepWallet) {
    const sold = REAL_TOK * (0.12 + Math.random() * 0.1);
    curve = {vTok: V_TOK - sold, vSol: K / (V_TOK - sold)};
    hist = [];
    marks = [];
    pos = null;
    pending = null;
    rented = false;
    regime = 0.4;
    regimeLeft = 0;
    if (!keepWallet) { wallet = 10; log = []; }
    for (let i = 0; i < KEEP; i++) step(true);
  }

  const price = () => curve.vSol / curve.vTok;
  const mcSol = () => price() * 1e9;
  const progress = () => (V_TOK - curve.vTok) / REAL_TOK;

  function buyOn(c, sol) {
    const net = sol * (1 - FEE);
    const out = c.vTok * net / (c.vSol + net);
    return {tokens: out, next: {vSol: c.vSol + net, vTok: c.vTok - out}};
  }
  function sellOn(c, tok) {
    const gross = c.vSol * tok / (c.vTok + tok);
    return {sol: gross * (1 - FEE), next: {vSol: c.vSol - gross, vTok: c.vTok + tok}};
  }

  // Andere Händler: Phasen mit Kaufdruck, Verkaufsdruck oder Seitwärts, dazu Rauschen.
  function step(quiet) {
    if (regimeLeft-- <= 0) {
      const r = Math.random();
      regime = r < 0.4 ? 0.5 + Math.random() * 0.8 : r < 0.7 ? -(0.4 + Math.random() * 0.9) : 0;
      regimeLeft = 20 + Math.floor(Math.random() * 60);
    }
    const flow = regime * 0.12 + (Math.random() - 0.5) * 0.9;
    if (flow > 0) curve = buyOn(curve, flow).next;
    else if (curve.vTok < V_TOK) {
      const tok = Math.min(V_TOK - curve.vTok, curve.vTok * (-flow) / curve.vSol);
      curve = sellOn(curve, tok).next;
    }
    if (progress() < 0.03) curve = buyOn(curve, 0.8).next;
    hist.push(price());
    if (hist.length > KEEP) { hist.shift(); marks.forEach(m => m.i--); marks = marks.filter(m => m.i >= 0); }
    if (quiet) return;
    if (progress() >= 0.97) {
      if (pos) sell(1, T.hand);
      note = T.migrated;
      reset(true);
      return;
    }
    if (pos) {
      const g = price() / pos.entry - 1;
      if (g >= TP) sell(1, T.target, true);
      else if (g <= SL) sell(1, T.stop, true);
    }
  }

  function addLog(text, cls) {
    log.unshift({text, cls});
    log = log.slice(0, 4);
  }

  function buy(sol) {
    if (pending) return;
    const cost = sol + PRIORITY + (rented ? 0 : RENT);
    if (cost > wallet + 1e-9) { note = T.nosol; draw(); return; }
    const want = buyOn(curve, sol).tokens;
    note = T.wait;
    pending = {kind: "buy", sol, want};
    setTimeout(() => {
      const fill = buyOn(curve, sol);
      pending = null;
      note = "";
      if (fill.tokens < want * (1 - SLIP)) {
        wallet -= PRIORITY;
        addLog(`${T.failed}: ${T.slip(f((1 - fill.tokens / want) * 100, 1))} · −${f(PRIORITY, 3)} SOL`, "loss");
        draw();
        return;
      }
      curve = fill.next;
      const rent = rented ? 0 : RENT;
      rented = true;
      wallet -= sol + PRIORITY + rent;
      const entryPrice = sol / fill.tokens;
      if (pos) {
        pos.entry = (pos.entry * pos.tokens + price() * fill.tokens) / (pos.tokens + fill.tokens);
        pos.tokens += fill.tokens;
        pos.cost += sol;
      } else {
        pos = {tokens: fill.tokens, cost: sol, entry: price()};
      }
      marks.push({i: hist.length - 1, k: "B"});
      addLog(`${T.buy} ${f(sol, 2)} SOL → ${f(fill.tokens / 1e6, 2)}${T.mio} · ${f(entryPrice * 1e9, 1)} SOL MC${rent ? " · " + T.rent : ""}`, "");
      draw();
    }, DELAY);
    draw();
  }

  // Verkäufe von Hand mit Slippage-Grenze, Ziel und Stop ohne (wie in Pump Paper).
  function sell(share, reason, auto) {
    if (!pos || (pending && !auto)) return;
    const tok = pos.tokens * share;
    const want = sellOn(curve, tok).sol;
    const run = () => {
      if (!pos) return;
      const t = Math.min(tok, pos.tokens);
      const fill = sellOn(curve, t);
      pending = null;
      note = "";
      if (!auto && fill.sol < want * (1 - SLIP)) {
        wallet -= PRIORITY;
        addLog(`${T.failed}: ${T.slip(f((1 - fill.sol / want) * 100, 1))} · −${f(PRIORITY, 3)} SOL`, "loss");
        draw();
        return;
      }
      curve = fill.next;
      const part = t / pos.tokens, cost = pos.cost * part, pnl = fill.sol - cost;
      wallet += fill.sol - PRIORITY;
      pos.tokens -= t;
      pos.cost -= cost;
      if (pos.tokens < 1) pos = null;
      marks.push({i: hist.length - 1, k: "S"});
      addLog(`${T.sold} (${reason}) ${f(fill.sol, 3)} SOL · ${sign(pnl, 3)} SOL`, pnl >= 0 ? "gain" : "loss");
      draw();
    };
    if (auto) { pending = {kind: "sell"}; setTimeout(run, DELAY); return; }
    note = T.wait;
    pending = {kind: "sell"};
    setTimeout(run, DELAY);
    draw();
  }

  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  function color(name) { return getComputedStyle(root).getPropertyValue(name).trim() || "#888"; }

  function chart() {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    let lo = Math.min(...hist), hi = Math.max(...hist);
    const lines = [];
    if (pos) { lines.push([pos.entry * (1 + TP), color("--gain")], [pos.entry * (1 + SL), color("--loss")], [pos.entry, color("--muted")]); }
    lines.forEach(([p]) => { lo = Math.min(lo, p); hi = Math.max(hi, p); });
    const pad = (hi - lo) * 0.12 || hi * 0.05;
    lo -= pad; hi += pad;
    const x = i => (i / (KEEP - 1)) * (w - 8) + 4;
    const y = p => h - 6 - ((p - lo) / (hi - lo)) * (h - 12);
    ctx.strokeStyle = color("--line"); ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, (h / 4) * g); ctx.lineTo(w, (h / 4) * g); ctx.stroke(); }
    ctx.setLineDash([5, 5]);
    for (const [p, c] of lines) { ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(0, y(p)); ctx.lineTo(w, y(p)); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = color("--gold"); ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath();
    hist.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p)) : ctx.moveTo(x(i), y(p))));
    ctx.stroke();
    ctx.font = "700 10px Archivo, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const m of marks) {
      ctx.fillStyle = m.k === "B" ? color("--gain") : color("--loss");
      ctx.beginPath(); ctx.arc(x(m.i), y(hist[m.i]), 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0b110f";
      ctx.fillText(EN ? m.k : (m.k === "B" ? "K" : "V"), x(m.i), y(hist[m.i]) + 0.5);
    }
  }

  function draw() {
    $("[data-mc]").textContent = `${f(mcSol(), 1)} SOL · ${f(mcSol() * SOL_USD, 0)} $`;
    canvas.setAttribute("aria-label", `${canvas.dataset.label || (canvas.dataset.label = canvas.getAttribute("aria-label"))} · ${$("[data-mc]").textContent}`);
    $("[data-prog]").textContent = f(progress() * 100, 0) + " %";
    $("[data-bar]").style.width = Math.min(100, progress() * 100) + "%";
    $("[data-bal]").textContent = f(wallet, 3) + " SOL";
    const busy = !!pending;
    root.querySelectorAll("[data-buy]").forEach(b => (b.disabled = busy));
    root.querySelectorAll("[data-sell]").forEach(b => (b.disabled = busy || !pos));
    if (pos) {
      const value = sellOn(curve, pos.tokens).sol, pnl = value - pos.cost, g = price() / pos.entry - 1;
      $("[data-pos]").innerHTML = `<div class="dp-row"><b class="${pnl >= 0 ? "gain" : "loss"}">${sign(pnl, 3)} SOL</b><span class="${g >= 0 ? "gain" : "loss"}">${sign(g * 100, 1)} %</span></div>
        <small>${T.cost} ${f(pos.cost, 3)} SOL · ${T.value} ${f(value, 3)} SOL · ${T.target} +60 % · ${T.stop} −20 %</small>`;
    } else {
      $("[data-pos]").innerHTML = `<small>${T.noPos}</small>`;
    }
    $("[data-note]").textContent = note || "";
    $("[data-log]").innerHTML = log.map(l => `<li class="${l.cls}">${l.text}</li>`).join("");
    chart();
  }

  root.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.buy) buy(Number(b.dataset.buy));
    if (b.dataset.sell) sell(Number(b.dataset.sell), T.hand);
    if (b.dataset.reset !== undefined) { note = ""; reset(false); draw(); }
  });

  reset(false);
  draw();
  let timer = null;
  const run = () => { if (!timer) timer = setInterval(() => { step(false); draw(); }, TICK); };
  const stop = () => { clearInterval(timer); timer = null; };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(es => es.forEach(en => (en.isIntersecting && !document.hidden ? run() : stop()))).observe(root);
  } else run();
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : run()));
  window.addEventListener("resize", chart);
})();
