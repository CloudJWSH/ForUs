// Demo auf der Startseite: ein simulierter Coin auf einer pump.fun-Bonding-Kurve (Rechenkern kurve.js).
// Andere Händler bewegen den Kurs zufällig, du handelst mit Spielgeld nach den Regeln von Pump Paper:
// Ausführung nach 1 s zum dann gültigen Kurs, Slippage-Grenze 10 %, Priority Fee, Konto-Miete,
// Ziel und Stop ohne Slippage-Grenze. Die Regeln sind Standard oder deine Strategie aus dem Labor.
// Gekauft wird nur auf Klick. Nichts davon ist ein echter Coin.
(function () {
  const root = document.getElementById("demo");
  const P = window.PPKurve;
  if (!root || !P) return;
  const EN = document.documentElement.lang === "en";
  const T = EN ? {
    loc: "en-US", mio: " M", buy: "Buy", sold: "Sell", failed: "Failed", wait: "Executing in 1 s …",
    noPos: "No position. Buy with one of the buttons.", cost: "cost", value: "value now",
    target: "target", stop: "stop", time: "time", trail: "trailing", hand: "manual", migrated: "The curve is full: the coin migrated. The demo starts a new coin.",
    slip: d => `price moved ${d} %, more than your 10 % slippage`, rent: "incl. account rent", nosol: "Not enough SOL",
    pause: "Pause", go: "Resume", stats: (n, h, p) => `${n} ${n === 1 ? "sell" : "sells"} · ${h} hit · ${p} SOL`,
    std: "Default: target +60 %, stop −20 %", lab: "My lab strategy", noLab: "My lab strategy (none saved yet)",
    rules: r => [r.tp != null && `target +${r.tp} %`, r.sl != null && `stop −${r.sl} %`, r.trail != null && `trailing ${r.trail} %`, r.time != null && `time ${r.time} min`].filter(Boolean).join(" · ") || "no rules",
    share: (n, h, p, w) => `Pump Paper demo: ${n} ${n === 1 ? "sell" : "sells"}, ${h} hit, ${p} SOL, balance ${w} SOL of play money. Simulated coin, no real money.`,
    copied: "Copied", lineT: "Target", lineS: "Stop", side: {B: "Buy", S: "Sell", F: "Failed"},
  } : {
    loc: "de-DE", mio: " Mio.", buy: "Kauf", sold: "Verkauf", failed: "Gescheitert", wait: "Ausführung in 1 s …",
    noPos: "Keine Position. Kauf mit einem der Knöpfe.", cost: "Einsatz", value: "Wert jetzt",
    target: "Ziel", stop: "Stop", time: "Zeit", trail: "Nachziehen", hand: "von Hand", migrated: "Die Kurve ist voll, der Coin ist migriert. Die Demo startet einen neuen Coin.",
    slip: d => `Kurs um ${d} % bewegt, mehr als deine Slippage von 10 %`, rent: "mit Konto-Miete", nosol: "Nicht genug SOL",
    pause: "Pause", go: "Weiter", stats: (n, h, p) => `${n} ${n === 1 ? "Verkauf" : "Verkäufe"} · ${h} Treffer · ${p} SOL`,
    std: "Standard: Ziel +60 %, Stop −20 %", lab: "Meine Labor-Strategie", noLab: "Meine Labor-Strategie (noch keine gespeichert)",
    rules: r => [r.tp != null && `Ziel +${r.tp} %`, r.sl != null && `Stop −${r.sl} %`, r.trail != null && `Nachziehen ${r.trail} %`, r.time != null && `Zeit ${r.time} Min.`].filter(Boolean).join(" · ") || "keine Regeln",
    share: (n, h, p, w) => `Pump-Paper-Demo: ${n} ${n === 1 ? "Verkauf" : "Verkäufe"}, ${h} Treffer, ${p} SOL, Kontostand ${w} SOL Spielgeld. Simulierter Coin, kein echtes Geld.`,
    copied: "Kopiert", lineT: "Ziel", lineS: "Stop", side: {B: "Kauf", S: "Verkauf", F: "Gescheitert"},
  };
  const SLIP = 0.10, DELAY = 1000, TICK = 250, KEEP = 240, SOL_USD = 180, KEY = "pp-demo";
  const STD = {tp: 60, sl: 20, trail: null, time: null, partial: null};
  // Marktlage: Anteil der Phasen mit Kaufdruck und mit Verkaufsdruck.
  const SCEN = {normal: [0.4, 0.7], hype: [0.6, 0.8], crash: [0.2, 0.75]};
  const $ = s => root.querySelector(s);
  const f = (x, d) => x.toLocaleString(T.loc, {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/^-/, "−");
  const sign = (x, d) => (x > 0 ? "+" : "") + f(x, d);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat */ } },
  };

  // Regeln aus dem Labor (zuletzt bearbeitete Strategie), sonst Standard.
  function labRules() {
    const s = store.get("pp-lab-current", null);
    if (!s || !s.exit) return null;
    const x = s.exit;
    return {tp: x.targetPct ?? null, sl: x.stopPct ?? null, trail: x.trailingPct ?? null, time: x.timeMin ?? null, partial: x.partial?.sellPct ?? null, name: s.name};
  }

  // Kontostand, Bilanz und Verlauf bleiben im Browser, der Coin selbst startet neu.
  const saved = store.get(KEY, null);
  let wallet = saved?.wallet ?? 10, stats = saved?.stats ?? {n: 0, wins: 0, pnl: 0}, log = saved?.log ?? [];
  let opts = {rules: saved?.rules === "lab" && labRules() ? "lab" : "std", scen: SCEN[saved?.scen] ? saved.scen : "normal", sound: !!saved?.sound,
    seed: saved?.seed || Math.floor(Math.random() * 99999) + 1, zoom: saved?.zoom || KEEP};
  const persist = () => store.set(KEY, {wallet, stats, log: log.slice(0, 30), ...opts});
  const rules = () => (opts.rules === "lab" && labRules()) || STD;

  let rand, curve, hist, marks, pos, pending, regime, regimeLeft, rented, note, ticks;

  function reset(newSeed) {
    if (newSeed) opts.seed = Math.floor(Math.random() * 99999) + 1;
    rand = P.rng(opts.seed);
    curve = P.atProgress(0.12 + rand() * 0.1);
    hist = []; marks = []; pos = null; pending = null; rented = false; regime = 0.4; regimeLeft = 0; ticks = 0;
    for (let i = 0; i < KEEP; i++) step(true);
    persist();
  }

  const price = () => P.price(curve);
  const progress = () => P.progress(curve);

  // Andere Händler: Phasen mit Kaufdruck, Verkaufsdruck oder Seitwärts, dazu Rauschen.
  function step(quiet) {
    if (regimeLeft-- <= 0) {
      const r = rand(), [up, down] = SCEN[opts.scen];
      regime = r < up ? 0.5 + rand() * 0.8 : r < down ? -(0.4 + rand() * 0.9) : 0;
      regimeLeft = 20 + Math.floor(rand() * 60);
    }
    const flow = regime * 0.12 + (rand() - 0.5) * 0.9;
    if (flow > 0) curve = P.buy(curve, flow).next;
    else if (curve.vTok < P.V_TOK) {
      const tok = Math.min(P.V_TOK - curve.vTok, curve.vTok * (-flow) / curve.vSol);
      curve = P.sell(curve, tok).next;
    }
    if (progress() < 0.03) curve = P.buy(curve, 0.8).next;
    hist.push(price());
    if (hist.length > KEEP) { hist.shift(); marks.forEach(m => m.i--); marks = marks.filter(m => m.i >= 0); }
    if (quiet) return;
    ticks++;
    if (progress() >= 0.97) {
      if (pos) sell(1, T.hand, true);
      note = T.migrated;
      reset(true);
      return;
    }
    if (pos && !pending) checkRules();
  }

  // Deine Regeln für die offene Position, wie in Pump Paper: Ziel, Stop, Nachziehen und Zeit.
  function checkRules() {
    const r = rules(), g = price() / pos.entry - 1;
    pos.peak = Math.max(pos.peak, price());
    if (r.tp != null && g >= r.tp / 100 && !pos.partDone) {
      if (r.partial) { pos.partDone = true; sell(r.partial / 100, T.target, true); } else sell(1, T.target, true);
    } else if (r.sl != null && g <= -r.sl / 100) sell(1, T.stop, true);
    else if (r.trail != null && pos.peak > pos.entry && price() <= pos.peak * (1 - r.trail / 100)) sell(1, T.trail, true);
    else if (r.time != null && (ticks - pos.t0) * TICK / 60000 >= r.time) sell(1, T.time, true);
  }

  function addLog(k, amount, result, cls) {
    log.unshift({k, amount, result, cls});
    log = log.slice(0, 30);
    persist();
  }

  // Ton für Kauf und Verkauf, aus als Standard.
  let audio;
  function beep(up) {
    if (!opts.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = up ? 880 : 440;
      g.gain.setValueAtTime(0.08, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.15);
      o.connect(g).connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.16);
    } catch (e) { /* kein Ton */ }
  }

  function buy(sol) {
    if (pending) return;
    const cost = sol + P.PRIORITY + (rented ? 0 : P.RENT);
    if (cost > wallet + 1e-9) { note = T.nosol; draw(); return; }
    const want = P.buy(curve, sol).tokens;
    note = T.wait;
    pending = {kind: "buy"};
    setTimeout(() => {
      const fill = P.buy(curve, sol);
      pending = null;
      note = "";
      if (fill.tokens < want * (1 - SLIP)) {
        wallet -= P.PRIORITY;
        addLog("F", `${f(sol, 2)} SOL`, `${T.slip(f((1 - fill.tokens / want) * 100, 1))} · −${f(P.PRIORITY, 3)}`, "loss");
        draw();
        return;
      }
      curve = fill.next;
      const rent = rented ? 0 : P.RENT;
      rented = true;
      wallet -= sol + P.PRIORITY + rent;
      if (pos) {
        pos.entry = (pos.entry * pos.tokens + price() * fill.tokens) / (pos.tokens + fill.tokens);
        pos.tokens += fill.tokens;
        pos.cost += sol;
      } else {
        pos = {tokens: fill.tokens, cost: sol, entry: price(), peak: price(), t0: ticks, partDone: false};
      }
      marks.push({i: hist.length - 1, k: "B"});
      addLog("B", `${f(sol, 2)} SOL`, `${f(fill.tokens / 1e6, 2)}${T.mio} · ${f(sol / fill.tokens * 1e9, 1)} MC${rent ? " · " + T.rent : ""}`, "");
      beep(true);
      draw();
    }, DELAY);
    draw();
  }

  // Verkäufe von Hand mit Slippage-Grenze, Regeln (auto) ohne, wie in Pump Paper.
  function sell(share, reason, auto) {
    if (!pos || pending) return;
    const tok = pos.tokens * share;
    const want = P.sell(curve, tok).sol;
    pending = {kind: "sell"};
    if (!auto) note = T.wait;
    setTimeout(() => {
      pending = null;
      note = "";
      if (!pos) return draw();
      const t = Math.min(tok, pos.tokens);
      const fill = P.sell(curve, t);
      if (!auto && fill.sol < want * (1 - SLIP)) {
        wallet -= P.PRIORITY;
        addLog("F", `${f(share * 100, 0)} %`, `${T.slip(f((1 - fill.sol / want) * 100, 1))} · −${f(P.PRIORITY, 3)}`, "loss");
        draw();
        return;
      }
      curve = fill.next;
      const part = t / pos.tokens, cost = pos.cost * part, pnl = fill.sol - cost;
      wallet += fill.sol - P.PRIORITY;
      stats.n++; stats.pnl += pnl - P.PRIORITY; if (pnl > 0) stats.wins++;
      pos.tokens -= t;
      pos.cost -= cost;
      if (pos.tokens < 1) pos = null;
      marks.push({i: hist.length - 1, k: "S"});
      addLog("S", `${f(fill.sol, 3)} SOL`, `${reason} · ${sign(pnl, 3)} SOL`, pnl >= 0 ? "gain" : "loss");
      beep(false);
      draw();
    }, DELAY);
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
    const n = Math.min(opts.zoom, hist.length), off = hist.length - n;
    const view = hist.slice(off);
    let lo = Math.min(...view), hi = Math.max(...view);
    const lines = [];
    if (pos) {
      const r = rules();
      if (r.tp != null && !pos.partDone) lines.push([pos.entry * (1 + r.tp / 100), color("--gain"), T.lineT]);
      if (r.sl != null) lines.push([pos.entry * (1 - r.sl / 100), color("--loss"), T.lineS]);
      lines.push([pos.entry, color("--muted"), ""]);
    }
    lines.forEach(([p]) => { lo = Math.min(lo, p); hi = Math.max(hi, p); });
    const pad = (hi - lo) * 0.12 || hi * 0.05;
    lo -= pad; hi += pad;
    const x = i => (i / Math.max(1, n - 1)) * (w - 8) + 4;
    const y = p => h - 6 - ((p - lo) / (hi - lo)) * (h - 12);
    ctx.strokeStyle = color("--line"); ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, (h / 4) * g); ctx.lineTo(w, (h / 4) * g); ctx.stroke(); }
    ctx.font = "600 10px Archivo, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    for (const [p, c, label] of lines) {
      ctx.setLineDash([5, 5]); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(0, y(p)); ctx.lineTo(w, y(p)); ctx.stroke();
      ctx.setLineDash([]);
      if (label) { ctx.fillStyle = c; ctx.fillText(label, 6, y(p) - 2); }
    }
    ctx.strokeStyle = color("--gold"); ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath();
    view.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p)) : ctx.moveTo(x(i), y(p))));
    ctx.stroke();
    ctx.font = "700 10px Archivo, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const m of marks) {
      const i = m.i - off;
      if (i < 0) continue;
      ctx.fillStyle = m.k === "B" ? color("--gain") : color("--loss");
      ctx.beginPath(); ctx.arc(x(i), y(hist[m.i]), 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0b110f";
      ctx.fillText(EN ? m.k : (m.k === "B" ? "K" : "V"), x(i), y(hist[m.i]) + 0.5);
    }
  }

  function draw() {
    const mc = P.mcSol(curve);
    $("[data-mc]").textContent = `${f(mc, 1)} SOL · ${f(mc * SOL_USD, 0)} $`;
    canvas.setAttribute("aria-label", `${canvas.dataset.label || (canvas.dataset.label = canvas.getAttribute("aria-label"))} · ${$("[data-mc]").textContent}`);
    $("[data-prog]").textContent = f(progress() * 100, 0) + " %";
    $("[data-bar]").style.width = Math.min(100, progress() * 100) + "%";
    $("[data-bal]").textContent = f(wallet, 3) + " SOL";
    const busy = !!pending;
    root.querySelectorAll("[data-buy]").forEach(b => (b.disabled = busy));
    root.querySelectorAll("[data-sell]").forEach(b => (b.disabled = busy || !pos));
    if (pos) {
      const value = P.sell(curve, pos.tokens).sol, pnl = value - pos.cost, g = price() / pos.entry - 1;
      $("[data-pos]").innerHTML = `<div class="dp-row"><b class="${pnl >= 0 ? "gain" : "loss"}">${sign(pnl, 3)} SOL</b><span class="${g >= 0 ? "gain" : "loss"}">${sign(g * 100, 1)} %</span></div>
        <small>${T.cost} ${f(pos.cost, 3)} SOL · ${T.value} ${f(value, 3)} SOL · ${esc(T.rules(rules()))}</small>`;
    } else {
      $("[data-pos]").innerHTML = `<small>${T.noPos}</small>`;
    }
    $("[data-note]").textContent = note || "";
    $("[data-stats]").textContent = stats.n ? T.stats(stats.n, f(stats.wins / stats.n * 100, 0) + " %", sign(stats.pnl, 3)) : "";
    const body = $("[data-log] tbody");
    body.innerHTML = log.slice(0, 6).map(l => `<tr class="${l.cls}"><td>${T.side[l.k]}</td><td>${esc(l.amount)}</td><td>${esc(l.result)}</td></tr>`).join("");
    $("[data-log]").hidden = !log.length;
    chart();
  }

  // Bedienelemente: Regeln, Marktlage, Startwert, Ton, Zoom, Ergebnis teilen.
  function controls() {
    const lab = labRules();
    const sel = $("[data-rules]");
    sel.innerHTML = `<option value="std">${T.std}</option><option value="lab"${lab ? "" : " disabled"}>${esc(lab ? T.lab + (lab.name ? ": " + lab.name : "") : T.noLab)}</option>`;
    sel.value = opts.rules;
    $("[data-scen]").value = opts.scen;
    $("[data-seed]").value = opts.seed;
    const snd = $("[data-sound]");
    snd.setAttribute("aria-pressed", opts.sound);
    root.querySelectorAll("[data-zoom]").forEach(b => b.setAttribute("aria-pressed", Number(b.dataset.zoom) === opts.zoom));
  }

  root.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.buy) buy(Number(b.dataset.buy));
    if (b.dataset.sell) sell(Number(b.dataset.sell), T.hand);
    if (b.dataset.reset !== undefined) { note = ""; wallet = 10; stats = {n: 0, wins: 0, pnl: 0}; log = []; reset(true); controls(); draw(); }
    if (b.dataset.pause !== undefined) { paused = !paused; b.textContent = paused ? T.go : T.pause; b.setAttribute("aria-pressed", paused); paused ? stop() : visible && run(); }
    if (b.dataset.speed !== undefined) { fast = !fast; b.setAttribute("aria-pressed", fast); if (timer) { stop(); run(); } }
    if (b.dataset.sound !== undefined) { opts.sound = !opts.sound; persist(); controls(); beep(true); }
    if (b.dataset.zoom) { opts.zoom = Number(b.dataset.zoom); persist(); controls(); chart(); }
    if (b.dataset.copyResult !== undefined) {
      const text = T.share(stats.n, stats.n ? f(stats.wins / stats.n * 100, 0) + " %" : "–", sign(stats.pnl, 3), f(wallet, 3));
      const done = () => { const old = b.textContent; b.textContent = T.copied; setTimeout(() => (b.textContent = old), 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt("", text)); else prompt("", text);
    }
  });
  root.addEventListener("change", e => {
    if (e.target.matches("[data-rules]")) { opts.rules = e.target.value; persist(); draw(); }
    if (e.target.matches("[data-scen]")) { opts.scen = e.target.value; persist(); }
    if (e.target.matches("[data-seed]")) {
      const s = Math.round(Number(e.target.value));
      if (s >= 1 && s <= 999999) { opts.seed = s; note = ""; reset(false); draw(); } else e.target.value = opts.seed;
    }
  });
  // Labor in einem anderen Tab gespeichert: Auswahl auffrischen.
  addEventListener("storage", e => { if (e.key === "pp-lab-current") { controls(); draw(); } });

  // Tasten, solange die Demo zu sehen ist: 1–4 kaufen, Q/W/E verkaufen 25 %, 50 %, alles.
  document.addEventListener("keydown", e => {
    if (!visible || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    const btn = "1234".includes(k) && k ? root.querySelectorAll("[data-buy]")[Number(k) - 1]
      : {q: 0, w: 1, e: 2}[k] !== undefined ? root.querySelectorAll("[data-sell]")[{q: 0, w: 1, e: 2}[k]] : null;
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  });

  reset(false);
  controls();
  draw();
  let timer = null, paused = false, fast = false, visible = false;
  const run = () => { if (!timer && !paused) timer = setInterval(() => { step(false); draw(); }, fast ? TICK / 2 : TICK); };
  const stop = () => { clearInterval(timer); timer = null; };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(es => es.forEach(en => { visible = en.isIntersecting; visible && !document.hidden ? run() : stop(); })).observe(root);
  } else { visible = true; run(); }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : visible && run()));
  window.addEventListener("resize", chart);
})();
