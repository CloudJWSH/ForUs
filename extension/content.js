(() => {
  if (window.__pumpPaper) return;
  window.__pumpPaper = true;

  const CSS = `
:host { all: initial; }
.box { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 312px; max-height: calc(100vh - 32px); overflow: auto;
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #eaf1ec; background: #101915; border: 1px solid #2d3d35;
  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.45); font-variant-numeric: tabular-nums; }
.box.small { width: auto; }
.box.dock { position: static; width: auto; max-height: none; overflow: visible; border: 0; border-top: 1px solid #2d3d35; border-bottom: 1px solid #2d3d35;
  border-radius: 0; box-shadow: none; }
.head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #1e2b25; cursor: pointer; user-select: none; }
.box.small .head { border-bottom: 0; }
.tag { background: #f2b33d; color: #1a1304; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 5px; letter-spacing: .03em; }
.sym { font-weight: 700; font-size: 14px; }
.bal { margin-left: auto; color: #8ea398; font-size: 12px; white-space: nowrap; }
.body { padding: 10px 12px 12px; display: grid; gap: 10px; }
.box.small .body { display: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 6px; }
.row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.muted { color: #8ea398; font-size: 12px; }
.mc { font-size: 18px; font-weight: 700; }
button { font: inherit; font-weight: 600; color: #eaf1ec; background: #162119; border: 1px solid #2d3d35; border-radius: 7px; padding: 6px 8px; cursor: pointer; }
button:hover { border-color: #8ea398; }
button.buy { border-color: #3ddc8c; color: #3ddc8c; }
button.sell { border-color: #ff6b6b; color: #ff6b6b; }
button.main { background: #f2b33d; color: #1a1304; border-color: #f2b33d; }
button:disabled { opacity: .45; cursor: default; }
input { font: inherit; color: #eaf1ec; background: #0b110f; border: 1px solid #2d3d35; border-radius: 7px; padding: 6px 8px; width: 56px; }
.pos { border: 1px solid #2d3d35; border-radius: 9px; padding: 9px 10px; background: #0b110f; display: grid; gap: 6px; }
.kv { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; }
.kv b { font-weight: 600; text-align: right; }
.gain { color: #3ddc8c; } .loss { color: #ff6b6b; }
.big { font-size: 20px; font-weight: 700; }
.rules { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.rules label { display: grid; gap: 2px; color: #8ea398; font-size: 11px; }
.rules input { width: 100%; box-sizing: border-box; }
.mc span { font-size: 13px; font-weight: 400; }
.hint { border: 1px solid #f2b33d; border-radius: 9px; padding: 9px 10px; background: rgba(242,179,61,.08); display: grid; gap: 4px; }
.hint.old { border-color: #2d3d35; background: transparent; }
.scout { border: 1px solid #2d3d35; border-left: 3px solid var(--c); border-radius: 9px; padding: 8px 10px; display: grid; gap: 3px; }
.scout b { color: var(--c); text-transform: uppercase; font-size: 11px; letter-spacing: .05em; }
.msg { min-height: 16px; font-size: 12px; color: #8ea398; }
.msg.err { color: #ff6b6b; }
`;

  const host = document.createElement("div");
  const root = host.attachShadow({mode: "open"});
  root.innerHTML = `<style>${CSS}</style><div class="box" id="box"></div>`;
  const box = root.getElementById("box");

  let scout = {}, qerr = "", mint = null, q = null, st = null, hint = null, msg = "", err = false, busy = false, lastHint = 0;
  try { if (localStorage.getItem("pumpPaperSmall") === "1") box.classList.add("small"); } catch (e) {}

  function send(m) {
    return new Promise((res, rej) => {
      try {
        chrome.runtime.sendMessage(m, r => {
          if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
          r && r.ok ? res(r.data) : rej(new Error(r ? r.error : "keine Antwort"));
        });
      } catch (e) {
        rej(new Error("Erweiterung neu geladen, Seite bitte neu laden"));
      }
    });
  }

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const cls = x => x > 0 ? "gain" : x < 0 ? "loss" : "";

  function say(text, bad) {
    msg = text;
    err = !!bad;
    draw();
  }

  let port = null, lastQ = 0, drawAt = 0, drawTimer = null;

  function connect() {
    try {
      port = chrome.runtime.connect({name: "live"});
    } catch (e) {
      port = null;
      return;
    }
    port.onMessage.addListener(m => {
      if (m.q && m.q.mint === mint) {
        q = m.q;
        qerr = "";
        lastQ = Date.now();
        soon();
      }
      if (m.error) {
        qerr = m.error;
        soon();
      }
      for (const x of m.sold || []) say(`${x.reason}: $${x.symbol} verkauft für ${fmtAmt(x.amount, x.pay)}`);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(() => { connect(); if (port && mint) port.postMessage({mint}); }, 1000);
    });
  }

  function soon() {
    const wait = 250 - (Date.now() - drawAt);
    if (wait <= 0) return draw();
    if (!drawTimer) drawTimer = setTimeout(() => { drawTimer = null; draw(); }, wait);
  }

  async function refresh() {
    if (!mint) return;
    if (Date.now() - lastQ > 6000) {
      const want = mint;
      try {
        const r = await send({op: "quote", mint: want});
        if (want === mint) {
          q = r;
          qerr = "";
        }
      } catch (e) {
        if (want === mint) qerr = e.message;
      }
      if (q && st && st.positions[mint]) {
        try {
          const sold = await send({op: "check", mint});
          for (const x of sold || []) say(`${x.reason}: $${x.symbol} verkauft für ${fmtAmt(x.amount, x.pay)}`);
        } catch (e) {}
      }
    }
    if (st && st.settings.memebotPass && Date.now() - lastHint > 20000) {
      lastHint = Date.now();
      try { hint = await send({op: "hint", mint}); } catch (e) { hint = {error: e.message}; }
    }
    draw();
  }

  async function loadState() {
    try { st = await send({op: "get"}); } catch (e) { st = null; }
    draw();
  }

  async function act(m, ok) {
    if (busy) return;
    busy = true;
    draw();
    try {
      st = await send({...m, mint});
      say(ok);
    } catch (e) {
      say(e.message, true);
    }
    busy = false;
    draw();
  }

  function value(p) {
    if (!q || !st) return null;
    return sellFill(q, p.tokens, st.settings).amount;
  }

  function planOf(h) {
    const out = {};
    for (const m of h.plan || []) {
      if (m.label === "Ziel") out.tp = m.pct;
      if (m.label === "Stop danach" || (m.label === "Stop" && out.sl == null)) out.sl = m.pct;
      if (m.minutes) out.maxMin = m.minutes;
    }
    return out;
  }

  function marks() {
    if (!mint || !st) return;
    const usd = (q && q.solUsd) || st.solUsd;
    const trades = st.history.filter(h => h.mint === mint && h.mcUsd && h.side !== "fehlgeschlagen").map(h => {
      const su = h.solUsd || usd;
      return {ts: h.ts, side: h.side, mcUsd: h.mcUsd, mcSol: su ? h.mcUsd / su : null,
              text: h.side === "kauf" ? `Kauf ${fmtAmt(h.amount, h.pay)}` : `Verkauf ${fmtPct(h.ret)}`};
    });
    const lines = [];
    const p = st.positions[mint];
    if (p && q && q.quoteUsd) {
      const entry = p.entryPrice * q.supply * q.quoteUsd;
      const add = (mult, text, color) => lines.push({mcUsd: entry * mult, mcSol: usd ? entry * mult / usd : null, text, color});
      add(1, "Einstieg", "#8ea398");
      if (p.tp) add(1 + p.tp / 100, `Ziel +${p.tp} %`, "#3ddc8c");
      if (p.sl) add(1 + p.sl / 100, `Stop ${p.sl} %`, "#ff6b6b");
    }
    const key = JSON.stringify([mint, trades, lines.map(l => [Math.round(l.mcUsd), l.text])]);
    if (key === marks.last) return;
    marks.last = key;
    window.postMessage({source: "pump-paper", type: "marks", mint, trades, lines}, "*");
  }

  function anchor() {
    const b = [...document.querySelectorAll("button")].find(x => /^(Verkaufen|Sell)$/.test(x.textContent.trim()) && x.offsetParent);
    const sec = b && b.closest("section");
    const wrap = sec && sec.parentElement && sec.parentElement.parentElement;
    return wrap && wrap.parentElement && wrap.getBoundingClientRect().width > 200 ? wrap : null;
  }

  function place() {
    const a = anchor();
    if (a) {
      box.classList.add("dock");
      if (host.previousElementSibling !== a) a.after(host);
    } else {
      box.classList.remove("dock");
      if (host.parentElement !== document.documentElement) document.documentElement.appendChild(host);
    }
  }

  function draw() {
    drawAt = Date.now();
    if (!mint) { host.remove(); return; }
    place();
    marks();
    const s = st ? st.settings : DEFAULTS;
    const p = st && st.positions[mint];
    const usd = (q && q.solUsd) || (st && st.solUsd);
    const pay = q ? payOf(q) : p ? p.pay : "SOL";
    const sym = (q && q.symbol) || (p && p.symbol) || (scout[mint] && scout[mint].sym) || mint.slice(0, 6);
    const wallet = st ? `${fmtAmt(st.wallet.SOL, "SOL")} · ${fmtAmt(st.wallet.USDC, "USDC")}` : "…";
    let html = `<div class="head" id="head"><span class="tag">PAPER</span><span class="sym">$${esc(sym)}</span>
      <span class="bal">${wallet}</span></div><div class="body">`;
    if (q) {
      const mcUsd = q.quoteUsd ? mcOf(q) * q.quoteUsd : null;
      html += `<div><div class="mc">MC ${mcUsd != null ? fmtBig(mcUsd) + " $" : fmtBig(mcOf(q)) + " " + esc(q.quoteSym)}${mcUsd != null && usd ? ` <span class="muted">· ${fmtBig(mcUsd / usd)} SOL</span>` : ""}</div>
        <div class="muted">${q.phase === "kurve" ? "Bonding-Kurve" : "PumpSwap-Pool"} · gehandelt in ${esc(q.quoteSym)}${q.quoteSym !== pay ? `, du zahlst in ${pay}` : ""}<br>
        Gebühr ${fmt(feeOf(q, s) * 100, 2)} % (${s.feeOverride !== "" && s.feeOverride != null ? "von Hand" : esc(q.feeSource)}) · Kurs aus ${esc(q.source)}${q.live ? ` · <span class="gain">live</span> vor ${Math.max(0, Math.round((Date.now() - q.ts) / 1000))} s` : ""}<br>
        Ausführung nach ${fmt(Number(s.delay) || 0, 1)} s · Slippage ${fmt(Number(s.slippage) || 0, 0)} %</div>
        ${q.backup ? `<div class="msg err">Dein Solana-Zugang antwortet nicht, Kurse kommen gerade über ${esc(q.rpcHost)}.</div>` : ""}
        ${q.source !== "Blockchain" ? `<div class="msg err">Kein Solana-Zugang erreichbar, Kurs nur geschätzt von DexScreener.</div>` : ""}</div>`;
    } else {
      html += `<div class="mc">${qerr ? "Kein Kurs" : "Kurs lädt …"}</div>${qerr ? `<div class="msg err">${esc(qerr)}</div>` : ""}`;
    }

    const sc = scout[mint];
    if (sc) {
      const color = {stark: "#3ddc8c", frueh: "#7aa2ff", beobachten: "#f2b33d", raus: "#ff6b6b"}[sc.status] || "#8ea398";
      const when = sc.ts ? new Date(sc.ts).toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit"}) : "";
      html += `<div class="scout" style="--c:${color}"><div class="row"><b>Scout: ${esc(sc.status === "frueh" ? "früh" : sc.status)}</b>
        <span class="muted">${esc(sc.quelle)}${when ? " · " + when : ""}${sc.mc ? " · MC damals " + fmtBig(sc.mc) + " $" : ""}</span></div>
        ${sc.notiz ? `<span>${esc(sc.notiz)}</span>` : ""}</div>`;
    }

    if (hint && !hint.none && !hint.error && hint.mint) {
      const pl = planOf(hint);
      const left = hint.live ? ` · noch ${Math.floor(hint.left_s / 60)}:${String(hint.left_s % 60).padStart(2, "0")} min` : "";
      html += `<div class="hint ${hint.live ? "" : "old"}"><b>Memebot: ${esc(hint.strategy)} · ${esc(hint.stage)}${left}</b>
        <span class="muted">${hint.einsatz > 0 ? "Einsatz " + fmtBoth(hint.einsatz, "SOL", usd) : "ohne Einsatz: " + esc(hint.reason0 || "")}
        ${pl.sl != null ? ` · Stop ${pl.sl} %` : ""}${pl.tp != null ? ` · Ziel +${pl.tp} %` : ""}</span>
        ${hint.live && hint.einsatz > 0 && !p && q ? `<div class="row"><button class="main" id="take"${busy ? " disabled" : ""}>Hinweis übernehmen</button></div>` : ""}</div>`;
    } else if (hint && hint.error) {
      html += `<div class="muted">Memebot nicht erreichbar: ${esc(hint.error)}</div>`;
    }

    const sizes = pay === "USDC" ? s.sizesUsdc : s.sizesSol;
    html += `<div class="grid">${sizes.map(x => `<button class="buy" data-buy="${x}"${busy || !q ? " disabled" : ""}>${fmt(x, x < 1 ? 2 : 0)}</button>`).join("")}</div>
      <div class="row"><input id="amt" type="number" min="0" step="any" placeholder="Betrag in ${pay}" style="flex:1"><button class="buy" id="buyx"${busy || !q ? " disabled" : ""}>Kaufen</button></div>
      <div class="muted">Knöpfe in ${pay}${usd && sizes.length ? ` · ${fmt(sizes[0], 2)} ${pay} = ${pay === "SOL" ? fmtAmt(sizes[0] * usd, "USDC") : fmtAmt(sizes[0] / usd, "SOL")}` : ""}</div>`;

    if (p) {
      const v = value(p);
      const pnl = v == null ? null : v - p.cost;
      const g = q ? priceOf(q) / p.entryPrice - 1 : null;
      const entryUsd = q && q.quoteUsd ? p.entryPrice * q.supply * q.quoteUsd : null;
      html += `<div class="pos">
        <div class="row" style="justify-content:space-between"><span class="big ${cls(pnl)}">${pnl == null ? "–" : fmtAmt(pnl, p.pay, true)}</span>
          <span class="${cls(g)}">${fmtPct(g)} Kurs</span></div>
        <div class="muted ${cls(pnl)}" style="margin-top:-4px">${pnl == null ? "" : fmtBoth(pnl, p.pay, usd, true)}</div>
        <div class="kv"><span class="muted">Eingesetzt</span><b>${fmtBoth(p.cost, p.pay, usd)}</b>
          <span class="muted">Verkaufswert jetzt</span><b>${v == null ? "–" : fmtBoth(v, p.pay, usd)}</b>
          <span class="muted">Gas bisher</span><b>${fmtAmt(p.gas, "SOL")}</b>
          <span class="muted">Einstieg bei MC</span><b>${entryUsd != null ? fmtBig(entryUsd) + " $" : "–"}</b>
          <span class="muted">Offen seit</span><b>${Math.round((Date.now() - p.opened) / 60000)} min</b></div>
        <div class="grid">${[0.25, 0.5, 1].map(x => `<button class="sell" data-sell="${x}"${busy ? " disabled" : ""}>${x === 1 ? "Alles" : x * 100 + " %"}</button>`).join("")}</div>
        <div class="rules"><label>Ziel %<input id="tp" type="number" value="${p.tp || ""}"></label>
          <label>Stop %<input id="sl" type="number" value="${p.sl || ""}"></label>
          <label>Zeit min<input id="mx" type="number" value="${p.maxMin || ""}"></label></div>
        <div class="muted">${p.tp && entryUsd ? `Ziel bei MC ${fmtBig(entryUsd * (1 + p.tp / 100))} $` : p.tp ? "" : "kein Ziel"} · ${p.sl && entryUsd ? `Stop bei MC ${fmtBig(entryUsd * (1 + p.sl / 100))} $` : p.sl ? "" : "kein Stop"}</div>
      </div>`;
    }
    html += `<div class="msg ${err ? "err" : ""}">${esc(msg)}</div></div>`;
    const focus = root.activeElement && root.activeElement.id;
    if (focus && ["amt", "tp", "sl", "mx"].includes(focus)) return;
    box.innerHTML = html;
  }

  box.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("#head")) {
      box.classList.toggle("small");
      try { localStorage.setItem("pumpPaperSmall", box.classList.contains("small") ? "1" : "0"); } catch (x) {}
      return;
    }
    const pay = q ? payOf(q) : "SOL";
    if (t.dataset.buy) act({op: "buy", amount: Number(t.dataset.buy)}, `Gekauft für ${fmtAmt(Number(t.dataset.buy), pay)}`);
    if (t.id === "buyx") {
      const v = Number(String(root.getElementById("amt").value).replace(",", "."));
      if (v > 0) act({op: "buy", amount: v}, `Gekauft für ${fmtAmt(v, pay)}`);
    }
    if (t.dataset.sell) act({op: "sell", share: Number(t.dataset.sell)}, "Verkauft");
    if (t.id === "take" && hint) {
      const pl = planOf(hint);
      const usd = (q && q.solUsd) || (st && st.solUsd);
      const amount = q && payOf(q) === "USDC" ? (usd ? hint.einsatz * usd : 0) : hint.einsatz;
      if (!amount) return say("Kein SOL-Kurs für die Umrechnung", true);
      act({op: "buy", amount: Math.round(amount * 100) / 100}, "Hinweis übernommen").then(() => {
        if (st && st.positions[mint]) act({op: "rules", tp: pl.tp ?? s0().tp, sl: pl.sl ?? s0().sl, maxMin: pl.maxMin ?? s0().maxMin}, "Hinweis übernommen, Ziel und Stop gesetzt");
      });
    }
  });

  const s0 = () => (st ? st.settings : DEFAULTS);

  box.addEventListener("change", e => {
    const id = e.target.id;
    if (!["tp", "sl", "mx"].includes(id)) return;
    const v = String(e.target.value).replace(",", ".");
    const key = {tp: "tp", sl: "sl", mx: "maxMin"}[id];
    let n = v === "" ? 0 : Number(v);
    if (key === "sl" && n > 0) n = -n;
    act({op: "rules", [key]: n}, "Gespeichert");
  });

  box.addEventListener("focusout", () => setTimeout(draw, 0));

  chrome.storage.onChanged.addListener(c => {
    if (c.scout) {
      scout = (c.scout.newValue && c.scout.newValue.coins) || {};
      draw();
    }
    if (c.pp && c.pp.newValue) {
      st = c.pp.newValue;
      st.settings = {...DEFAULTS, ...(st.settings || {})};
      draw();
    }
  });

  function watch() {
    const m = mintFrom(location.pathname);
    if (m !== mint) {
      mint = m;
      q = null;
      hint = null;
      lastHint = 0;
      msg = "";
      draw();
      if (mint) {
        if (!port) connect();
        if (port) port.postMessage({mint});
        refresh();
      } else {
        window.postMessage({source: "pump-paper", type: "marks", mint: "", trades: [], lines: []}, "*");
      }
    }
  }

  chrome.storage.local.get("scout", r => {
    scout = (r && r.scout && r.scout.coins) || {};
    draw();
  });
  loadState();
  watch();
  setInterval(watch, 1000);
  setInterval(() => { if (!document.hidden) refresh(); }, 3000);
  setInterval(marks, 3000);
  setInterval(() => { if (mint) place(); }, 1000);
})();
